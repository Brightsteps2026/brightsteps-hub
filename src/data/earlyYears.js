// Early-years report cards (Pre-Nursery, PreK, Kindergarten): the areas each
// report covers, in English and French. Shared by Portfolio (to tag photos)
// and TermReports (to write and print the report).

export const EY_GRADES = ["Pre-N", "PreK", "Kindergarten"];
export const isEarlyYears = (grade) => EY_GRADES.includes(grade);

// Development areas.
const AREAS_PREN = [
  { id: "psed", en: "Feeling safe and making friends", fr: "Se sentir en sécurité et se faire des amis", core: true },
  { id: "comm", en: "Talking and listening", fr: "Parler et écouter", core: true },
  { id: "gross", en: "Moving my body (gross motor)", fr: "Bouger mon corps (motricité globale)", core: true },
  { id: "fine", en: "My hands and fingers (fine motor)", fr: "Mes mains et mes doigts (motricité fine)", core: true },
  { id: "lit", en: "Early words and books", fr: "Premiers mots et livres" },
  { id: "math", en: "Early numbers", fr: "Premiers nombres" },
  { id: "world", en: "Discovering the world", fr: "Découvrir le monde" },
  { id: "create", en: "Creativity", fr: "Créativité" }
];

const AREAS_PREK_KG = [
  { id: "psed", en: "Personal, social and emotional", fr: "Développement personnel, social et émotionnel" },
  { id: "comm", en: "Communication and language", fr: "Communication et langage" },
  { id: "gross", en: "Physical development: gross motor", fr: "Développement physique : motricité globale" },
  { id: "fine", en: "Physical development: fine motor", fr: "Développement physique : motricité fine" },
  { id: "lit", en: "Early literacy", fr: "Premiers apprentissages en lecture et écriture" },
  { id: "math", en: "Early math", fr: "Premiers apprentissages en mathématiques" },
  { id: "world", en: "Understanding the world", fr: "Comprendre le monde" },
  { id: "create", en: "Creative expression", fr: "Expression créative" }
];

// Enrichment (Pre-Nursery) and specialist subjects (PreK, Kindergarten).
// `subject` is the Gradebook subject whose written comment fills it in.
const ENRICH_PREN = [
  { id: "music", subject: "Music", en: "Music and Movement", fr: "Éveil musical" },
  { id: "pe", subject: "Physical Education", en: "Movement and Physical Play", fr: "Éveil corporel" },
  { id: "art", subject: "Art", en: "Creative Art", fr: "Éveil artistique" },
  { id: "swim", subject: "Swimming", en: "Water Confidence", fr: "Aisance aquatique" }
];

const SPECIALS_PREK_KG = [
  { id: "french", subject: "French", en: "French", fr: "Français" },
  { id: "music", subject: "Music", en: "Music", fr: "Musique" },
  { id: "art", subject: "Art", en: "Art", fr: "Arts plastiques" },
  { id: "pe", subject: "Physical Education", en: "Physical Education", fr: "Éducation physique" },
  { id: "swim", subject: "Swimming", en: "Swimming", fr: "Natation" },
  { id: "tech", subject: "Technology", en: "Technology", fr: "Technologie" }
];

// Pre-Nursery only.
export const PLAY_WAYS = [
  { id: "explore", en: "Exploring", fr: "Explorer" },
  { id: "persist", en: "Keeping going", fr: "Persévérer" },
  { id: "ideas", en: "Having ideas", fr: "Avoir des idées" }
];
export const CARE = [
  { id: "eating", en: "Eating", fr: "Repas" },
  { id: "rest", en: "Rest", fr: "Repos" },
  { id: "toilet", en: "Toileting", fr: "Propreté" },
  { id: "dressing", en: "Dressing", fr: "S'habiller" }
];

// PreK and Kindergarten levels (Pre-Nursery has none).
export const EY_LEVELS = [
  { id: "beginning", en: "Beginning", fr: "Débute" },
  { id: "growing", en: "Growing", fr: "En progrès" },
  { id: "secure", en: "Secure", fr: "Acquis" }
];

export const MAX_AREA_PHOTOS = 2;

export function eyAreas(grade) {
  return grade === "Pre-N" ? AREAS_PREN : AREAS_PREK_KG;
}
export function eyEnrichment(grade) {
  return grade === "Pre-N" ? ENRICH_PREN : SPECIALS_PREK_KG;
}

// Everything a portfolio photo can be tagged with, for one grade.
export function eyPhotoTags(grade) {
  if (!isEarlyYears(grade)) return [];
  return [...eyAreas(grade), ...eyEnrichment(grade)].map((a) => ({ id: a.id, label: a.en }));
}

// What an observation can be about, for one grade (areas, then enrichment or
// specialist subjects; Pre-Nursery also has care and routines).
export function eyObservationAreas(grade) {
  if (!isEarlyYears(grade)) return [];
  return [
    ...eyAreas(grade),
    ...(grade === "Pre-N" ? [{ id: "care", en: "Care and routines", fr: "Soins et routines" }] : []),
    ...eyEnrichment(grade)
  ];
}

// Portfolio "focus area" that best matches each observation area.
export const EY_TO_PORTFOLIO_TAG = {
  psed: "Social Emotional", comm: "Literacy", gross: "Physical", fine: "Physical", lit: "Literacy",
  math: "Numeracy", world: "Inquiry", create: "Creative Arts", care: "Social Emotional",
  music: "Creative Arts", art: "Creative Arts", pe: "Physical", swim: "Physical", french: "Literacy", tech: "Inquiry"
};
