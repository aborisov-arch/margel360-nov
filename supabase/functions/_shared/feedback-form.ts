// The post-event survey. Form v2 (since 2026-09-27): five questions rated
// 1-5 stars, how they heard about us (source / source_other) and one open
// question (improvement_comment). Answers to the earlier v1 form (four
// questions rated 1-4, a comment each) keep their own columns;
// event_feedback.form_version tells the two apart.
// The survey page (website/js/feedback.js) and the admin pages
// (admin/js/admin-feedback.js, admin/js/customers.js) repeat these keys and
// labels - change them together.

export type RatingQuestion = { key: string; bg: string };

export const V2_RATINGS: readonly RatingQuestion[] = [
  { key: "organization_rating", bg: "Организация преди събитието" },
  { key: "website_rating",      bg: "Уебсайт" },
  { key: "overall_rating",      bg: "Преживяване и атмосфера" },
  { key: "cleanliness_rating",  bg: "Чистота и поддръжка" },
  { key: "team_rating",         bg: "Обслужване от екипа" },
];
export const V2_MAX = 5;

export const V1_RATINGS: readonly RatingQuestion[] = [
  { key: "experience_rating", bg: "Преживяване" },
  { key: "service_rating",    bg: "Обслужване" },
  { key: "venue_rating",      bg: "Зала" },
  { key: "rebook_rating",     bg: "Резервация отново" },
];
export const V1_MAX = 4;

export const SOURCES = ["friends", "social", "google", "other"] as const;
export const SOURCE_BG: Record<string, string> = {
  friends: "Приятели", social: "Социални мрежи", google: "Google", other: "Друго",
};

// Reputation routing for a submitted answer: "review" invites a delighted
// customer to leave a public Google review, "alert" emails the team for
// service recovery. v2: any 1-2 stars or an average of 3 or less alerts; an
// average of 4.4+ with nothing below 4 invites. v1 keeps its old rules.
export function feedbackRoute(ratings: number[], max: number): "review" | "alert" | null {
  const total = ratings.reduce((s, v) => s + v, 0);
  const min = Math.min(...ratings);
  const n = ratings.length;
  if (max === V2_MAX) {
    if (min <= 2 || total <= 3 * n) return "alert";
    if (min >= 4 && 5 * total >= 22 * n) return "review";   // average >= 4.4
    return null;
  }
  if (total >= 14) return "review";
  if (min === 1 || total <= 9) return "alert";
  return null;
}
