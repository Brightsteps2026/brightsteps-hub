import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "../LoginGate";
import { useLanguage } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";
import { CORE_GRADES, DEFAULT_SETTINGS } from "../data/constants";
import { COUNTRIES } from "../data/countries";
import { Field, Modal } from "../ui/common";

const FRAMEWORKS = ["Inquiry-based learning", "Common Core", "British National Curriculum", "Other"];

function ListEditor({ label, items, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()]);
    setDraft("");
  };
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));

  return (
    <Field label={label}>
      <div className="bsf-chiprow">
        {items.map((it, i) => (
          <span key={i} className="bsf-chip bsf-editable-chip">
            {it}
            <button type="button" onClick={() => remove(i)} aria-label={`Remove ${it}`}>×</button>
          </span>
        ))}
      </div>
      <div className="bsf-inline-add">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="bsf-btn" onClick={add}>Add</button>
      </div>
    </Field>
  );
}

function LogoUploadField({ logoUrl, onChange }) {
  const [error, setError] = useState("");
  const MAX_SIZE = 3 * 1024 * 1024; // 3MB, plenty for a logo, keeps the school's data light

  const handleFile = (fileList) => {
    setError("");
    const file = (fileList || [])[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG or JPG works best).");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("That image is too large. Please choose one under 3MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.onerror = () => setError("Could not read that file. Please try again.");
    reader.readAsDataURL(file);
  };

  return (
    <div>
      {logoUrl && <img src={logoUrl} alt="School logo preview" className="bsf-logo-preview" />}
      <div style={{ display: "flex", gap: 8 }}>
        <label className="bsf-attachment-upload">
          <Plus size={16} />
          <span>{logoUrl ? "Change logo" : "Upload logo"}</span>
          <input type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files)} />
        </label>
        {logoUrl && (
          <button type="button" className="bsf-btn bsf-btn-ghost" onClick={() => onChange("")}>
            Remove
          </button>
        )}
      </div>
      {error && <p className="bsf-formerror">{error}</p>}
    </div>
  );
}

function SettingsModal({ data, persist, onClose }) {
  const { signOut, profile, updateProfileLocal } = useAuth();
  const { t } = useLanguage();
  const settings = data.settings || DEFAULT_SETTINGS;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [profileFullName, setProfileFullName] = useState(profile?.full_name || "");
  const [profilePhone, setProfilePhone] = useState(profile?.phone || "");
  const [profileNationality, setProfileNationality] = useState(profile?.nationality || "");
  const [profileStatus, setProfileStatus] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const saveMyProfile = async () => {
    setProfileStatus("");
    if (!profileFullName.trim()) {
      setProfileStatus("settings.enterName");
      return;
    }
    setProfileSaving(true);
    const patch = { full_name: profileFullName.trim(), phone: profilePhone.trim(), nationality: profileNationality.trim() };
    const { error } = await supabase.from("profiles").update(patch).eq("id", profile.id);
    setProfileSaving(false);
    if (error) {
      console.error("Could not save profile", error);
      setProfileStatus("settings.saveFailed");
    } else {
      setProfileStatus("settings.saved");
      updateProfileLocal(patch);
    }
  };

  const changePassword = async () => {
    setPasswordStatus("");
    if (newPassword.length < 8) {
      setPasswordStatus("settings.passwordTooShort");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus("settings.passwordMismatch");
      return;
    }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordStatus("settings.passwordFailed");
    } else {
      setPasswordStatus("settings.passwordUpdated");
      setNewPassword("");
      setConfirmPassword("");
    }
  };
  const update = (patch) => persist({ ...data, settings: { ...settings, ...patch } });
  const updateBranding = (patch) => {
    update({ branding: { ...settings.branding, ...patch } });
    // The logo needs to be visible on the login screen, before anyone signs
    // in. Rather than exposing the whole shared dataset to do that, it lives
    // in its own small, separate row that only ever holds this one thing.
    if (patch.logoUrl !== undefined && window.storage) {
      window.storage.set("brightsteps-hub-logo", patch.logoUrl || "", true).catch(() => {
        alert("The logo for the login screen could not be saved. Please try again.");
      });
    }
  };
  const updateYear = (patch) => update({ academicYear: { ...settings.academicYear, ...patch } });

  const isParent = profile?.role === "parent";
  const isAdmin = profile?.role === "admin";

  return (
    <Modal title={isAdmin ? "School settings" : t("settings.account")} onClose={onClose}>
      {isAdmin && (
        <>
      <h3 className="bsf-subheading">Curriculum framework</h3>
      <Field label="Framework">
        <select value={settings.curriculumFramework} onChange={(e) => update({ curriculumFramework: e.target.value })}>
          {FRAMEWORKS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </Field>

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Grade structure</h3>
      <p className="bsf-muted" style={{ margin: "0 0 8px" }}>
        The ten school grades (Pre-N to Grade 7) are always included. Add any extra grade below.
      </p>
      <ListEditor
        label="Extra grade levels"
        items={(settings.grades || []).filter((g) => !CORE_GRADES.includes(g))}
        onChange={(extra) => update({ grades: [...CORE_GRADES, ...extra] })}
        placeholder="e.g. Grade 8"
      />

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Assessment scale</h3>
      <ListEditor
        label="Levels, low to high"
        items={settings.assessmentLevels}
        onChange={(assessmentLevels) => update({ assessmentLevels })}
        placeholder="e.g. Mastered"
      />

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">School branding</h3>
      <Field label="Primary color">
        <input type="color" value={settings.branding.primaryColor} onChange={(e) => updateBranding({ primaryColor: e.target.value })} className="bsf-colorinput" />
      </Field>
      <Field label="School logo">
        <LogoUploadField
          logoUrl={settings.branding.logoUrl}
          onChange={(dataUrl) => updateBranding({ logoUrl: dataUrl })}
        />
      </Field>
      <Field label="Mission statement">
        <textarea rows={2} value={settings.branding.mission} onChange={(e) => updateBranding({ mission: e.target.value })} />
      </Field>
      <Field label="Slogan">
        <input value={settings.branding.slogan} onChange={(e) => updateBranding({ slogan: e.target.value })} />
      </Field>

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Languages</h3>
      <ListEditor
        label="Languages used at school"
        items={settings.languages}
        onChange={(languages) => update({ languages })}
        placeholder="e.g. Spanish"
      />

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Academic calendar</h3>
      <div className="bsf-two-col">
        <Field label="Year start">
          <input type="date" value={settings.academicYear.startDate} onChange={(e) => updateYear({ startDate: e.target.value })} />
        </Field>
        <Field label="Year end">
          <input type="date" value={settings.academicYear.endDate} onChange={(e) => updateYear({ endDate: e.target.value })} />
        </Field>
      </div>

      <p className="bsf-muted" style={{ marginTop: 12, marginBottom: 8 }}>
        Terms are used to break attendance and report totals down by period, not just the whole year.
      </p>
      {(settings.terms || DEFAULT_SETTINGS.terms).map((term, i) => {
        const updateTerm = (patch) => {
          const nextTerms = [...(settings.terms || DEFAULT_SETTINGS.terms)];
          nextTerms[i] = { ...nextTerms[i], ...patch };
          update({ terms: nextTerms });
        };
        const removeTerm = () => {
          const nextTerms = (settings.terms || DEFAULT_SETTINGS.terms).filter((_, idx) => idx !== i);
          update({ terms: nextTerms });
        };
        return (
          <div key={i} className="bsf-termrow">
            <input
              value={term.name}
              onChange={(e) => updateTerm({ name: e.target.value })}
              className="bsf-termname"
              placeholder="Term name"
            />
            <input type="date" value={term.startDate} onChange={(e) => updateTerm({ startDate: e.target.value })} />
            <input type="date" value={term.endDate} onChange={(e) => updateTerm({ endDate: e.target.value })} />
            <button className="bsf-iconbtn" onClick={removeTerm} aria-label="Remove term"><Trash2 size={16} /></button>
          </div>
        );
      })}
      <button
        type="button"
        className="bsf-btn bsf-btn-ghost"
        onClick={() => update({ terms: [...(settings.terms || DEFAULT_SETTINGS.terms), { name: `Term ${(settings.terms || []).length + 1}`, startDate: "", endDate: "" }] })}
      >
        <Plus size={16} /> Add term
      </button>

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Report card templates</h3>
      <ListEditor
        label="Templates"
        items={settings.reportCardTemplates}
        onChange={(reportCardTemplates) => update({ reportCardTemplates })}
        placeholder="e.g. Early Years Narrative Report"
      />

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">User roles</h3>
      <ListEditor
        label="Roles"
        items={settings.roles}
        onChange={(roles) => update({ roles })}
        placeholder="e.g. Coordinator"
      />
      <p className="bsf-muted" style={{ marginTop: 6 }}>Roles are a reference list for now. Real logins and permissions come with hosting.</p>
        </>
      )}

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">{t("settings.myProfile")}</h3>
      <Field label={t("settings.fullName")}>
        <input value={profileFullName} onChange={(e) => setProfileFullName(e.target.value)} />
      </Field>
      <Field label={t("settings.phone")}>
        <input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder={t("common.optional")} />
      </Field>
      <Field label={t("settings.nationality")}>
        <select value={profileNationality} onChange={(e) => setProfileNationality(e.target.value)}>
          <option value="">{t("settings.preferNotToSay")}</option>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      {profileStatus && <p className={profileStatus === "settings.saved" ? "bsf-muted" : "bsf-formerror"}>{t(profileStatus)}</p>}
      <button className="bsf-btn bsf-btn-block bsf-btn-ghost" onClick={saveMyProfile} disabled={profileSaving}>
        {profileSaving ? t("top.saving") : t("settings.saveProfile")}
      </button>

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">{t("settings.account")}</h3>
      {profile?.email && <p className="bsf-muted">{t("settings.signedInAs")} {profile.email}</p>}

      <Field label={t("settings.newPassword")}>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t("settings.passwordPlaceholder")} />
      </Field>
      <Field label={t("settings.confirmPassword")}>
        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      </Field>
      {passwordStatus && <p className={passwordStatus === "settings.passwordUpdated" ? "bsf-muted" : "bsf-formerror"}>{t(passwordStatus)}</p>}
      <button className="bsf-btn bsf-btn-block bsf-btn-ghost" onClick={changePassword} disabled={passwordSaving || !newPassword}>
        {passwordSaving ? t("settings.updating") : t("settings.updatePassword")}
      </button>

      {isAdmin && (
        <>
          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Activity Log</h3>
          <p className="bsf-muted" style={{ marginBottom: 12 }}>
            A record of who changed what, and when, across the whole Hub. Keeps the most recent 500 changes.
          </p>
          <div className="bsf-activitylog">
            {(!data.activityLog || data.activityLog.length === 0) && <p className="bsf-empty">No activity recorded yet.</p>}
            {[...(data.activityLog || [])].reverse().slice(0, 100).map((entry) => (
              <div key={entry.id} className="bsf-activityrow">
                <div className="bsf-row-head">
                  <strong>{entry.actorName}</strong>
                  <span className="bsf-muted">{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <p className="bsf-muted" style={{ margin: 0 }}>
                  {entry.actorRole} · updated {entry.areas.join(", ")}
                </p>
              </div>
            ))}
            {data.activityLog && data.activityLog.length > 100 && (
              <p className="bsf-muted" style={{ marginTop: 8 }}>Showing the 100 most recent changes of {data.activityLog.length} recorded.</p>
            )}
          </div>
        </>
      )}

      <button
        className="bsf-btn bsf-btn-block"
        style={{ background: "#801524", marginTop: 10 }}
        onClick={() => { onClose(); signOut(); }}
      >
        {t("settings.signOut")}
      </button>
    </Modal>
  );
}

export { SettingsModal };
