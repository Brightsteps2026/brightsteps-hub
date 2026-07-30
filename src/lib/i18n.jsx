import { createContext, useContext, useEffect, useState } from "react";

// Translation dictionary. Add new keys here as more of the app is translated.
// Structure: translations[key] = { en: "...", fr: "..." }
const translations = {
  // Navigation
  "nav.dashboard": { en: "Dashboard", fr: "Tableau de bord" },
  "nav.students": { en: "Students", fr: "Élèves" },
  "nav.staff": { en: "Staff", fr: "Personnel" },
  "nav.attendance": { en: "Attendance", fr: "Présence" },
  "nav.portfolio": { en: "Portfolio", fr: "Portfolio" },
  "nav.assessment": { en: "Assessment", fr: "Évaluation" },
  "nav.gradebook": { en: "Gradebook", fr: "Carnet de notes" },
  "nav.planning": { en: "Planning", fr: "Planification" },
  "nav.calendar": { en: "Calendar", fr: "Calendrier" },
  "nav.admissions": { en: "Admissions", fr: "Admissions" },
  "nav.assignments": { en: "Assignments", fr: "Devoirs" },
  "nav.reports": { en: "Reports", fr: "Bulletins" },
  "nav.behavior": { en: "Behavior", fr: "Comportement" },
  "nav.resources": { en: "Resources", fr: "Ressources" },
  "nav.accreditation": { en: "Accreditation", fr: "Accréditation" },
  "nav.ai": { en: "AI Assistant", fr: "Assistant IA" },
  "nav.updates": { en: "Communication", fr: "Communication" },
  "nav.more": { en: "More", fr: "Plus" },
  "nav.allSections": { en: "All sections", fr: "Toutes les sections" },
  "nav.moreSectionsNote": {
    en: "More sections, Staff, Admissions, Finance, and others, will appear here as they're built.",
    fr: "D'autres sections, Personnel, Admissions, Finances, et autres, apparaîtront ici au fur et à mesure de leur création."
  },

  // Top bar
  "top.saving": { en: "Saving…", fr: "Enregistrement…" },
  "top.saved": { en: "Saved", fr: "Enregistré" },
  "top.loading": { en: "Loading…", fr: "Chargement…" },
  "top.menu": { en: "Menu", fr: "Menu" },
  "top.settings": { en: "Settings", fr: "Paramètres" },
  "top.language": { en: "Language", fr: "Langue" },

  // Common actions, used across many tabs
  "common.add": { en: "Add", fr: "Ajouter" },
  "common.edit": { en: "Edit", fr: "Modifier" },
  "common.remove": { en: "Remove", fr: "Retirer" },
  "common.delete": { en: "Delete", fr: "Supprimer" },
  "common.save": { en: "Save", fr: "Enregistrer" },
  "common.cancel": { en: "Cancel", fr: "Annuler" },
  "common.close": { en: "Close", fr: "Fermer" },
  "common.all": { en: "All", fr: "Tout" },
  "common.filterByGrade": { en: "Filter by grade", fr: "Filtrer par niveau" },
  "common.search": { en: "Search", fr: "Rechercher" },
  "common.attachAFile": { en: "Attach a file", fr: "Joindre un fichier" },
  "common.uploading": { en: "Uploading…", fr: "Téléversement…" },
  "common.name": { en: "Name", fr: "Nom" },
  "common.date": { en: "Date", fr: "Date" },
  "common.notes": { en: "Notes", fr: "Remarques" },
  "common.status": { en: "Status", fr: "Statut" },

  // Load error screen (shown to everyone if data fails to load)
  "loadError.title": { en: "Could not load your school's data", fr: "Impossible de charger les données de l'école" },
  "loadError.body": {
    en: "To protect your information, BrightSteps Hub will not show or save any changes until this is resolved. Please check your internet connection and reload the page. If this keeps happening, contact your administrator.",
    fr: "Pour protéger vos informations, BrightSteps Hub n'affichera ni n'enregistrera aucune modification tant que ce problème n'est pas résolu. Veuillez vérifier votre connexion internet et recharger la page. Si le problème persiste, contactez votre administrateur."
  },
  "loadError.reload": { en: "Reload", fr: "Recharger" },

  // Dashboard
  "dashboard.eyebrow": { en: "International School · Grand Bassam", fr: "École internationale · Grand Bassam" }
};

const LanguageContext = createContext({
  language: "en",
  canSwitch: false,
  setLanguage: () => {},
  t: (key) => translations[key]?.en || key
});

export function useLanguage() {
  return useContext(LanguageContext);
}

// Only parents are allowed to switch languages. Every other role always sees English,
// regardless of what may be stored on the device.
export function LanguageProvider({ role, children }) {
  const canSwitch = role === "parent";
  const [language, setLanguageState] = useState("en");

  useEffect(() => {
    if (!canSwitch) {
      setLanguageState("en");
      return;
    }
    try {
      const stored = window.localStorage.getItem("bsf-language");
      if (stored === "en" || stored === "fr") {
        setLanguageState(stored);
      }
    } catch (e) {
      // localStorage unavailable, default to English
    }
  }, [canSwitch]);

  const setLanguage = (lang) => {
    if (!canSwitch) return;
    setLanguageState(lang);
    try {
      window.localStorage.setItem("bsf-language", lang);
    } catch (e) {
      // ignore
    }
  };

  const t = (key) => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[language] || entry.en || key;
  };

  return (
    <LanguageContext.Provider value={{ language, canSwitch, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
