// The bus trip screen (Myri, 7 Nov 2026).
// Used on the bus phone (the "bus" account sees only this screen) and by the admin in School bus.
// Start a trip (morning or afternoon) -> the phone shares its location while this screen stays open,
// then tap each child On / Off. Parents get a phone notice for each tap and can follow the bus.
// Children whose parents said "not taking the bus" are shown apart, with no buttons.
// Own EN/FR switch (the driver may be French-speaking); opens in French.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { COLORS, chip, chipOn, primaryBtn, ghostBtn, pill } from "./ui/tokens";
import BusMap from "./BusMap";

const T = {
  en: {
    title: "School bus", morning: "Morning · to school", afternoon: "Afternoon · home",
    start: "Start the trip", resume: "Share location again", end: "End the trip", ended: "Trip ended",
    sharing: "Sharing the bus location · keep this screen open", notSharing: "Location not shared from this phone",
    geoOff: "The phone did not share its location. Allow location for this site in the phone settings.",
    onM: "Picked up", offM: "At school", onA: "On the bus", offA: "Dropped home",
    allSchool: "Everyone on board is at school", onBoard: "On board", toPick: "To pick up", dropped: "Off the bus",
    skipping: "Not taking the bus today", undo: "Undo", map: "Map", call: "Call",
    endWarn: (n) => `${n} child${n === 1 ? " is" : "ren are"} still marked on the bus. End the trip anyway?`,
    signOut: "Sign out", notStarted: "Trip not started", liveAt: "Last position", none: "No children on the bus list.",
    confirmUndo: "Undo this tap? The family already got a notice.",
    near: "Near this home", notNow: "Not now", away: "m away"
  },
  fr: {
    title: "Transport scolaire", morning: "Matin · vers l'école", afternoon: "Après-midi · retour",
    start: "Démarrer le trajet", resume: "Partager à nouveau la position", end: "Terminer le trajet", ended: "Trajet terminé",
    sharing: "Position du car partagée · gardez cet écran ouvert", notSharing: "Position non partagée depuis ce téléphone",
    geoOff: "Le téléphone n'a pas partagé sa position. Autorisez la localisation pour ce site dans les réglages.",
    onM: "Ramassé(e)", offM: "Arrivé(e) à l'école", onA: "Dans le car", offA: "Déposé(e)",
    allSchool: "Tous les élèves à bord sont à l'école", onBoard: "À bord", toPick: "À ramasser", dropped: "Descendus",
    skipping: "Ne prend pas le car aujourd'hui", undo: "Annuler", map: "Carte", call: "Appeler",
    endWarn: (n) => `${n} enfant${n === 1 ? " est encore marqué" : "s sont encore marqués"} dans le car. Terminer quand même ?`,
    signOut: "Se déconnecter", notStarted: "Trajet pas encore démarré", liveAt: "Dernière position", none: "Aucun enfant sur la liste du car.",
    confirmUndo: "Annuler ce pointage ? La famille a déjà reçu une notification.",
    near: "Près de cette maison", notNow: "Pas maintenant", away: "m"
  }
};

const hm = (iso) => (iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "");
const homeUrl = (r) => (r.home_lat != null && r.home_lng != null ? `https://www.google.com/maps?q=${r.home_lat},${r.home_lng}` : r.home_link && /^https:\/\//i.test(r.home_link) ? r.home_link : null);
// Distance in metres between two points.
const metres = (a, b) => {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const NEAR_M = 150;
const card = { background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 14, marginBottom: 10 };

export default function BusRun({ standalone = false, onSignOut }) {
  // Bus phone: French by default, with an FR/EN switch. Admin screen: always English (staff screens are English only).
  const [lang, setLang] = useState(() => { if (!standalone) return "en"; try { return localStorage.getItem("bs-bus-lang") || "fr"; } catch { return "fr"; } });
  const L = T[lang];
  const [trip, setTrip] = useState(() => (new Date().getHours() < 12 ? "morning" : "afternoon"));
  const [run, setRun] = useState(null);
  const [path, setPath] = useState([]);
  const [sharing, setSharing] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const watch = useRef(null);
  const lastSent = useRef(0);
  const lastPos = useRef(null);
  const wake = useRef(null);
  const [pos, setPos] = useState(null);          // for driver mode on the bus phone
  const [dismissed, setDismissed] = useState({}); // child id -> time "Not now" was pressed

  const switchLang = (l) => { setLang(l); try { localStorage.setItem("bs-bus-lang", l); } catch { /* not needed */ } };

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("bus_run_list", { p_trip: trip });
    if (error) { setMsg(error.message); return; }
    setRun(data);
    if (data?.trip?.id) {
      const p = await supabase.rpc("bus_trip_path", { p_trip_id: data.trip.id });
      setPath((p.data || []).map((x) => [x.lat, x.lng]));
    } else setPath([]);
  }, [trip]);

  useEffect(() => { setRun(null); load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const stopSharing = useCallback(() => {
    if (watch.current != null) navigator.geolocation?.clearWatch(watch.current);
    watch.current = null;
    try { wake.current?.release(); } catch { /* ignore */ }
    wake.current = null;
    setSharing(false);
  }, []);
  useEffect(() => stopSharing, [stopSharing]);
  useEffect(() => { stopSharing(); }, [trip, stopSharing]);

  const startSharing = async (tripId) => {
    setGeoError("");
    if (!navigator.geolocation) { setGeoError(L.geoOff); return; }
    try { wake.current = await navigator.wakeLock?.request("screen"); } catch { /* screen lock not supported */ }
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        lastPos.current = { lat, lng };
        setPos({ lat, lng });
        const now = Date.now();
        if (now - lastSent.current < 15000) return;   // every 15 seconds at most
        lastSent.current = now;
        supabase.rpc("bus_post_position", { p_trip_id: tripId, p_lat: lat, p_lng: lng });
        setPath((p) => [...p, [lat, lng]]);
      },
      () => { setGeoError(L.geoOff); },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
    );
    setSharing(true);
  };
  // The screen lock is released when the phone screen turns off; take it again when it comes back.
  useEffect(() => {
    const again = async () => { if (sharing && document.visibilityState === "visible") { try { wake.current = await navigator.wakeLock?.request("screen"); } catch { /* ignore */ } } };
    document.addEventListener("visibilitychange", again);
    return () => document.removeEventListener("visibilitychange", again);
  }, [sharing]);

  const start = async () => {
    setBusy("start"); setMsg("");
    const { data: id, error } = await supabase.rpc("bus_start_trip", { p_trip: trip });
    setBusy("");
    if (error) { setMsg(error.message); return; }
    await startSharing(id);
    load();
  };

  const end = async () => {
    const still = (run?.riders || []).filter((r) => r.on_at && !r.off_at).length;
    if (!window.confirm(still ? L.endWarn(still) : `${L.end}?`)) return;
    await supabase.rpc("bus_end_trip", { p_trip_id: run.trip.id });
    stopSharing();
    load();
  };

  const mark = async (r, kind) => {
    setBusy(r.student_id + kind);
    const p = lastPos.current;
    const { error } = await supabase.rpc("bus_mark", { p_trip_id: run.trip.id, p_student: r.student_id, p_kind: kind, p_lat: p?.lat ?? null, p_lng: p?.lng ?? null });
    setBusy("");
    if (error) setMsg(error.message);
    load();
  };

  const unmark = async (r, kind) => {
    if (!window.confirm(L.confirmUndo)) return;
    await supabase.rpc("bus_unmark", { p_trip_id: run.trip.id, p_student: r.student_id, p_kind: kind });
    load();
  };

  const allAtSchool = async () => {
    const list = (run?.riders || []).filter((r) => r.on_at && !r.off_at);
    if (!list.length || !window.confirm(`${L.allSchool} (${list.length})?`)) return;
    setBusy("all");
    for (const r of list) {
      // eslint-disable-next-line no-await-in-loop
      await supabase.rpc("bus_mark", { p_trip_id: run.trip.id, p_student: r.student_id, p_kind: "off", p_lat: lastPos.current?.lat ?? null, p_lng: lastPos.current?.lng ?? null });
    }
    setBusy("");
    load();
  };

  const riders = run?.riders || [];
  const going = riders.filter((r) => !r.skip);
  const skipping = riders.filter((r) => r.skip);
  const t = run?.trip;
  const live = t && !t.ended_at;
  const onBoard = going.filter((r) => r.on_at && !r.off_at).length;
  const toPick = going.filter((r) => !r.on_at).length;
  const dropped = going.filter((r) => r.off_at).length;
  const isMorning = trip === "morning";
  const homes = going.map((r) => ({ lat: r.home_lat, lng: r.home_lng, label: r.name, done: isMorning ? !!r.on_at : !!r.off_at }));
  // Driver mode (bus phone only, no assistant on board): the child whose home the bus is next to,
  // shown at the top with one big button, so the driver taps once while stopped.
  const nearest = (() => {
    if (!standalone || !live || !pos) return null;
    let best = null;
    going.forEach((r) => {
      if (r.home_lat == null || r.home_lng == null) return;
      const pending = isMorning ? !r.on_at : r.on_at && !r.off_at;
      if (!pending || (dismissed[r.student_id] && Date.now() - dismissed[r.student_id] < 5 * 60 * 1000)) return;
      const d = metres(pos, { lat: r.home_lat, lng: r.home_lng });
      if (d <= NEAR_M && (!best || d < best.d)) best = { r, d };
    });
    return best;
  })();
  const busPos = sharing && lastPos.current ? lastPos.current : t?.last_lat != null ? { lat: t.last_lat, lng: t.last_lng } : null;

  const tile = (label, value) => (
    <div style={{ flex: "1 1 80px", background: COLORS.surface2, borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontSize: 12, color: COLORS.muted }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );

  return (
    <div style={{ padding: standalone ? "14px 14px 40px" : 0, maxWidth: 720, margin: "0 auto", fontFamily: "'Work Sans', system-ui, sans-serif", color: COLORS.ink }}>
      {standalone && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <img src="/logo.png" alt="" style={{ width: 34, height: 34, objectFit: "contain" }} />
          <strong style={{ fontSize: 17, color: COLORS.brand }}>{L.title}</strong>
          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button style={lang === "fr" ? chipOn : chip} onClick={() => switchLang("fr")}>FR</button>
            <button style={lang === "en" ? chipOn : chip} onClick={() => switchLang("en")}>EN</button>
            {onSignOut && <button style={chip} onClick={() => { stopSharing(); onSignOut(); }}>{L.signOut}</button>}
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button style={{ ...(isMorning ? chipOn : chip), flex: 1 }} onClick={() => setTrip("morning")}>{L.morning}</button>
        <button style={{ ...(!isMorning ? chipOn : chip), flex: 1 }} onClick={() => setTrip("afternoon")}>{L.afternoon}</button>
      </div>

      {nearest && (
        <div style={{ ...card, border: `3px solid ${COLORS.brand}`, padding: 18, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 13, color: COLORS.muted }}>{L.near} · {Math.round(nearest.d)} {L.away}</p>
          <p style={{ margin: "6px 0 2px", fontSize: 30, fontWeight: 700, lineHeight: 1.15 }}>{nearest.r.name}</p>
          <p style={{ margin: "0 0 14px", fontSize: 14, color: COLORS.muted }}>{nearest.r.grade}</p>
          <button
            style={{ ...primaryBtn, width: "100%", minHeight: 84, fontSize: 24, background: isMorning ? COLORS.brand : COLORS.ok }}
            disabled={busy === nearest.r.student_id + (isMorning ? "on" : "off")}
            onClick={() => mark(nearest.r, isMorning ? "on" : "off")}>
            {isMorning ? L.onM : L.offA}
          </button>
          <button style={{ ...ghostBtn, marginTop: 10 }} onClick={() => setDismissed({ ...dismissed, [nearest.r.student_id]: Date.now() })}>{L.notNow}</button>
        </div>
      )}

      <div style={card}>
        {!t || t.ended_at ? (
          <>
            <p style={{ margin: "0 0 10px", fontSize: 14, color: COLORS.muted }}>{t?.ended_at ? `${L.ended} · ${hm(t.ended_at)}` : L.notStarted}</p>
            <button style={{ ...primaryBtn, width: "100%", minHeight: 52, fontSize: 17 }} disabled={busy === "start"} onClick={start}>{L.start}</button>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: sharing ? COLORS.ok : COLORS.warn }}>
              {sharing ? `● ${L.sharing}` : L.notSharing}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!sharing && <button style={{ ...primaryBtn, flex: "1 1 180px" }} onClick={() => startSharing(t.id)}>{L.resume}</button>}
              <button style={{ ...ghostBtn, flex: "1 1 140px" }} onClick={end}>{L.end}</button>
            </div>
          </>
        )}
        {geoError && <p style={{ ...pill("bad"), display: "block", whiteSpace: "normal", marginTop: 10, padding: "8px 10px" }}>{geoError}</p>}
        {msg && <p style={{ fontSize: 13, color: COLORS.bad, margin: "8px 0 0" }}>{msg}</p>}
      </div>

      {t && (
        <div style={card}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {tile(L.toPick, toPick)}{tile(L.onBoard, onBoard)}{tile(L.dropped, dropped)}
          </div>
          <BusMap bus={busPos} path={path} homes={homes} height={standalone ? 220 : 280} />
          {t.last_at && <p style={{ fontSize: 12, color: COLORS.muted, margin: "6px 0 0" }}>{L.liveAt}: {hm(t.last_at)}</p>}
        </div>
      )}

      {live && isMorning && onBoard > 0 && (
        <button style={{ ...primaryBtn, width: "100%", minHeight: 48, marginBottom: 10, background: COLORS.ok }} disabled={busy === "all"} onClick={allAtSchool}>
          {L.allSchool} ({onBoard})
        </button>
      )}

      {!riders.length && run && <div style={card}><p style={{ margin: 0, color: COLORS.muted }}>{L.none}</p></div>}

      {going.map((r) => {
        const url = homeUrl(r);
        const onLabel = isMorning ? L.onM : L.onA;
        const offLabel = isMorning ? L.offM : L.offA;
        return (
          <div key={r.student_id} style={{ ...card, borderColor: r.off_at ? COLORS.line : r.on_at ? COLORS.ok : COLORS.line, background: r.off_at ? COLORS.surface2 : "#fff" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 16 }}>{r.name}</strong>
                <div style={{ fontSize: 13, color: COLORS.muted }}>{r.grade} · {r.zone}{r.home_note ? ` · ${r.home_note}` : ""}</div>
                <div style={{ fontSize: 13, marginTop: 2 }}>
                  {r.on_at && <span>{onLabel} {hm(r.on_at)}</span>}
                  {r.off_at && <span> · {offLabel} {hm(r.off_at)}</span>}
                </div>
              </div>
              <span style={{ display: "flex", gap: 6 }}>
                {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...chip, textDecoration: "none" }}>{L.map}</a>}
                {r.phones?.[0] && <a href={`tel:${r.phones[0].replace(/\s/g, "")}`} style={{ ...chip, textDecoration: "none" }}>{L.call}</a>}
              </span>
            </div>
            {live && (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {!r.on_at && <button style={{ ...primaryBtn, flex: 1, minHeight: 48 }} disabled={busy === r.student_id + "on"} onClick={() => mark(r, "on")}>{onLabel}</button>}
                {r.on_at && !r.off_at && <button style={{ ...primaryBtn, flex: 1, minHeight: 48, background: COLORS.ok }} disabled={busy === r.student_id + "off"} onClick={() => mark(r, "off")}>{offLabel}</button>}
                {(r.on_at || r.off_at) && <button style={{ ...ghostBtn, minHeight: 48 }} onClick={() => unmark(r, r.off_at ? "off" : "on")}>{L.undo}</button>}
              </div>
            )}
          </div>
        );
      })}

      {skipping.length > 0 && (
        <div style={{ ...card, background: COLORS.surface2 }}>
          <p style={{ margin: "0 0 6px", fontWeight: 600 }}>{L.skipping} · {skipping.length}</p>
          {skipping.map((r) => (
            <p key={r.student_id} style={{ margin: "4px 0", fontSize: 14 }}>{r.name} <span style={{ color: COLORS.muted }}>· {r.zone}{r.skip_note ? ` · ${r.skip_note}` : ""}</span></p>
          ))}
        </div>
      )}
    </div>
  );
}
