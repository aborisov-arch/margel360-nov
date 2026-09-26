// Reward for a completed post-event survey: a one-time MG- code worth this
// many percent off the HALL RENT only — the venue base, never drinks, add-ons
// or extra guests (the same scope every promo code gets at booking).
// Used by submit-feedback (mints the code, emails it) and
// send-feedback-request (the invitation copy). The public survey page
// repeats the number: website/js/feedback.js REWARD_PERCENT + the static
// defaults in website/feedback.html — change all of them together.
export const FEEDBACK_DISCOUNT_PERCENT = 5;
