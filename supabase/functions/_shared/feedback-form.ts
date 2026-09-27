// The post-event survey. Form v3 (since 2026-09-27): five questions rated
// 1-6 stars, how they heard about us (source / source_other) and one open
// question (improvement_comment). v2 asked the same five questions on a 1-5
// scale (live for a few hours on 2026-09-27) and shares their columns. Answers
// to the first form, v1 (four questions rated 1-4, a comment each), keep their
// own columns. event_feedback.form_version tells them apart: never average
// answers of different versions together.
// The survey page (website/js/feedback.js) and the admin pages
// (admin/js/admin-feedback.js, admin/js/customers.js) repeat these keys,
// labels and scales - change them together.

export type RatingQuestion = { key: string; bg: string };

// The five questions of forms v3 and v2.
export const RATINGS: readonly RatingQuestion[] = [
  { key: "organization_rating", bg: "Организация преди събитието" },
  { key: "website_rating",      bg: "Уебсайт" },
  { key: "overall_rating",      bg: "Преживяване и атмосфера" },
  { key: "cleanliness_rating",  bg: "Чистота и поддръжка" },
  { key: "team_rating",         bg: "Обслужване от екипа" },
];

export const V1_RATINGS: readonly RatingQuestion[] = [
  { key: "experience_rating", bg: "Преживяване" },
  { key: "service_rating",    bg: "Обслужване" },
  { key: "venue_rating",      bg: "Зала" },
  { key: "rebook_rating",     bg: "Резервация отново" },
];

// Every form version: its questions and top rating (stars). `bg` names a
// superseded version in the Bulgarian team views; the current one has none.
export type SurveyForm = { version: number; max: number; questions: readonly RatingQuestion[]; bg: string };
export const FORMS: readonly SurveyForm[] = [
  { version: 3, max: 6, questions: RATINGS,    bg: "" },
  { version: 2, max: 5, questions: RATINGS,    bg: "анкета 1–5" },
  { version: 1, max: 4, questions: V1_RATINGS, bg: "стара анкета" },
];
export const CURRENT_FORM = 3;
// An answer's form (event_feedback.form_version is NOT NULL, default 1).
export const formOf = (version: unknown): SurveyForm =>
  FORMS.find(f => f.version === Number(version)) ?? FORMS[FORMS.length - 1];

export const SOURCES = ["friends", "social", "google", "other"] as const;
export const SOURCE_BG: Record<string, string> = {
  friends: "Приятели", social: "Социални мрежи", google: "Google", other: "Друго",
};

// Reputation routing for a submitted answer: "review" invites a delighted
// customer to leave a public Google review, "alert" emails the team for
// service recovery. v3 (1-6): any 1-2 stars or an average of 3.5 or less
// alerts; an average of 5.25+ with nothing below 5 invites (for five answers:
// all 5-6 stars, at least two of them 6). v2 (1-5): the same bars on its scale
// - any 1-2 or an average of 3 or less alerts, 4.4+ with nothing below 4
// invites. v1 keeps its old rules.
export function feedbackRoute(ratings: number[], max: number): "review" | "alert" | null {
  const total = ratings.reduce((s, v) => s + v, 0);
  const min = Math.min(...ratings);
  const n = ratings.length;
  if (max === 6) {
    if (min <= 2 || 2 * total <= 7 * n) return "alert";     // average <= 3.5
    if (min >= 5 && 4 * total >= 21 * n) return "review";   // average >= 5.25
    return null;
  }
  if (max === 5) {
    if (min <= 2 || total <= 3 * n) return "alert";
    if (min >= 4 && 5 * total >= 22 * n) return "review";   // average >= 4.4
    return null;
  }
  if (total >= 14) return "review";
  if (min === 1 || total <= 9) return "alert";
  return null;
}
