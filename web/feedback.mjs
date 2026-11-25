import { requirements } from "./checks.mjs";

export function failedRequirements(review) {
  return review.selected.filter((id) => review.results[id]?.status === "failed");
}

export function buildFeedback(review) {
  const sections = failedRequirements(review).map((id) => {
    const { label, expected, steps } = requirements[id];
    return [
      label,
      "Reproduce",
      ...steps.map((step, index) => String(index + 1) + ". " + step),
      "",
      "Expected",
      expected,
      "",
      "Actual",
      ...review.results[id].observations.map((observation) => "- " + observation)
    ].join("\n");
  });
  return sections.length ? ["Repair feedback for Candidate " + review.candidate, ...sections].join("\n\n") : "";
}
