import { useState, useEffect, useRef } from "react";
import { BRIGHTSTEPS_LOGO_DATA_URI, usesOldBuiltinLogo, DEFAULT_SETTINGS, emptyData, syncGlobalsFromSettings } from "./constants";
import { nextStudentIdNumber } from "../lib/format";

const STORAGE_KEY = "brightsteps-hub-data";

// Three-way merge used when saving. Everyone shares one saved copy of the
// school data, so before saving we fetch the latest copy and keep other
// people's changes (new messages, attendance, notes) instead of overwriting
// them with our older copy. "base" is what this screen last loaded, "mine" is
// what we want to save, "theirs" is what is saved right now.
const isPlainObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

const isIdList = (v) => Array.isArray(v) && v.every((x) => isPlainObj(x) && x.id !== undefined && x.id !== null);

function mergeSchoolValue(base, mine, theirs) {
  if (mine === base) return theirs === undefined ? mine : theirs;
  if (theirs === undefined || base === undefined) return mine;
  if (isPlainObj(mine) && isPlainObj(theirs) && isPlainObj(base)) {
    const out = {};
    const keys = new Set([...Object.keys(mine), ...Object.keys(theirs)]);
    keys.forEach((k) => {
      const inMine = Object.prototype.hasOwnProperty.call(mine, k);
      const inBase = Object.prototype.hasOwnProperty.call(base, k);
      if (!inMine) {
        if (!inBase) out[k] = theirs[k]; // someone else added it
        return; // we removed it
      }
      const v = mergeSchoolValue(base[k], mine[k], theirs[k]);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }
  if (isIdList(mine) && isIdList(theirs) && isIdList(base)) {
    const baseById = new Map(base.map((x) => [x.id, x]));
    const theirsById = new Map(theirs.map((x) => [x.id, x]));
    const mineIds = new Set(mine.map((x) => x.id));
    const out = [];
    mine.forEach((x) => {
      const b = baseById.get(x.id);
      // Someone else deleted it and we didn't change it: keep it deleted.
      if (b !== undefined && !theirsById.has(x.id) && (x === b || JSON.stringify(x) === JSON.stringify(b))) return;
      const v = mergeSchoolValue(b, x, theirsById.get(x.id));
      if (v !== undefined) out.push(v);
    });
    theirs.forEach((x) => {
      if (!mineIds.has(x.id) && !baseById.has(x.id)) out.push(x); // added by someone else
    });
    return out;
  }
  return mine;
}

function useSchoolData() {
  const [data, setData] = useState(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Set when a save did not reach the database. The change stays on screen
  // and the top bar offers to try again, instead of wrongly saying "Saved".
  const [saveError, setSaveError] = useState(false);
  const unsavedRef = useRef(null);
  // What this screen last loaded or saved, used to work out what we changed.
  const baseRef = useRef(null);
  // Which copy of the school data baseRef is (used to refuse out-of-date saves).
  const versionRef = useRef(null);
  const savingRef = useRef(false);

  const fetchLatest = async () => {
    const res = await window.storage.get(STORAGE_KEY, true);
    if (!res || !res.value) return null;
    versionRef.current = res.version || null;
    const parsed = { ...emptyData, ...JSON.parse(res.value) };
    if (!parsed.settings) parsed.settings = DEFAULT_SETTINGS;
    return parsed;
  };

  // Pick up other people's changes (new messages etc.) when the Hub is
  // reopened or brought back to the front, and every minute while visible.
  useEffect(() => {
    if (!loaded || loadError) return;
    const refresh = async () => {
      // Never replace a change that has not been saved yet.
      if (document.hidden || savingRef.current || unsavedRef.current) return;
      try {
        const latest = await fetchLatest();
        if (!latest || savingRef.current || unsavedRef.current) return;
        if (!latest.settings.branding) latest.settings.branding = DEFAULT_SETTINGS.branding;
        if (!latest.settings.branding.logoUrl || usesOldBuiltinLogo(latest.settings.branding.logoUrl)) {
          latest.settings = { ...latest.settings, branding: { ...latest.settings.branding, logoUrl: BRIGHTSTEPS_LOGO_DATA_URI } };
        }
        syncGlobalsFromSettings(latest.settings);
        baseRef.current = latest;
        setData(latest);
      } catch (e) {
        console.error("Refresh failed", e);
      }
    };
    const id = setInterval(refresh, 60 * 1000);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, loadError]);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, true);
        if (res) versionRef.current = res.version || null;
        if (res && res.value) {
          const parsed = { ...emptyData, ...JSON.parse(res.value) };
          if (!parsed.settings) parsed.settings = DEFAULT_SETTINGS;
          if (!parsed.settings.branding) parsed.settings.branding = DEFAULT_SETTINGS.branding;
          if (!parsed.settings.branding.logoUrl || usesOldBuiltinLogo(parsed.settings.branding.logoUrl)) {
            parsed.settings = { ...parsed.settings, branding: { ...parsed.settings.branding, logoUrl: BRIGHTSTEPS_LOGO_DATA_URI } };
          }
          syncGlobalsFromSettings(parsed.settings);

          // Rename the old "Pre Nursery" grade name to the new "Pre-N" everywhere it is saved.
          let renamedGrade = false;
          if (parsed.settings && parsed.settings.grades && parsed.settings.grades.includes("Pre Nursery")) {
            parsed.settings = {
              ...parsed.settings,
              grades: parsed.settings.grades.map((g) => (g === "Pre Nursery" ? "Pre-N" : g))
            };
            renamedGrade = true;
          }
          parsed.students = (parsed.students || []).map((s) => {
            if (s.grade === "Pre Nursery") { renamedGrade = true; return { ...s, grade: "Pre-N" }; }
            return s;
          });
          if (renamedGrade) {
            syncGlobalsFromSettings(parsed.settings);
          }

          // Give every existing student a student ID number if they don't have one yet.
          let studentsChanged = false;
          const assignedSoFar = (parsed.students || []).map((s) => s.studentIdNumber).filter(Boolean);
          parsed.students = (parsed.students || []).map((s) => {
            if (s.studentIdNumber) return s;
            const newIdNumber = nextStudentIdNumber(assignedSoFar);
            assignedSoFar.push(newIdNumber);
            studentsChanged = true;
            return { ...s, studentIdNumber: newIdNumber };
          });

          baseRef.current = parsed;
          setData(parsed);
          if (studentsChanged || renamedGrade) {
            window.storage.set(STORAGE_KEY, JSON.stringify(parsed), true, versionRef.current).catch((e) => {
              console.error("Failed to save backfilled student ID numbers", e);
            });
          }
        }
        // No saved row yet is fine (brand new school), that is not an error.
        setLoaded(true);
      } catch (e) {
        // A real failure to reach storage. Do NOT mark this as loaded with
        // an empty dataset, that would risk a later save overwriting real
        // data with nothing. Show a blocking error instead.
        console.error("Failed to load school data", e);
        setLoadError(true);
      }
    })();
  }, []);

  // Saves the whole school data. Returns true when it reached the database,
  // false when it did not (the top bar then shows "Not saved").
  const persist = async (next) => {
    if (loadError) {
      // Refuse to save if we never confirmed we loaded the real data first.
      console.error("Refusing to save: data was never successfully loaded.");
      return false;
    }
    syncGlobalsFromSettings(next.settings);
    setData(next);
    unsavedRef.current = next;
    setSaving(true);
    savingRef.current = true;
    try {
      // Merge with the latest saved copy so we don't wipe out changes other
      // people made since this screen was loaded. If the latest copy can't be
      // read, don't save at all: saving an old copy could undo their work.
      // If someone else saves at the same moment, the database refuses this save;
      // read their copy, combine again and retry (up to 4 times).
      let toSave = next;
      for (let attempt = 1; ; attempt++) {
        const latest = await fetchLatest();
        toSave = latest && baseRef.current ? mergeSchoolValue(baseRef.current, next, latest) : next;
        try {
          await window.storage.set(STORAGE_KEY, JSON.stringify(toSave), true, versionRef.current);
          break;
        } catch (err) {
          if (!err?.stale || attempt >= 4) throw err;
          await new Promise((r) => setTimeout(r, 150 * attempt));
        }
      }
      baseRef.current = toSave;
      if (unsavedRef.current === next) unsavedRef.current = null;
      setSaveError(false);
      if (toSave !== next) {
        syncGlobalsFromSettings(toSave.settings);
        setData(toSave);
      }
      return true;
    } catch (e) {
      console.error("Save failed", e);
      setSaveError(true);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // Try the last change that did not save again.
  const retrySave = () => (unsavedRef.current ? persist(unsavedRef.current) : Promise.resolve(true));

  return { data, persist, loaded, saving, loadError, saveError, retrySave };
}

export { useSchoolData };
