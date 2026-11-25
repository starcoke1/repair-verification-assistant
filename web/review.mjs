import { requirements } from "./checks.mjs";

export function createReview(candidate, scope = []) {
  return {
    candidate,
    selected: Object.keys(requirements).filter((id) => scope.includes(id)),
    results: {},
    decision: null
  };
}

export function nextCandidate(review, candidate) {
  return review.candidate === candidate ? review : createReview(candidate, review.selected);
}

export function recordResult(review, id, outcome) {
  if (!review.selected.includes(id)) return review;
  return { ...review, results: { ...review.results, [id]: outcome }, decision: null };
}

export function canAccept(review) {
  return review.selected.length > 0 && review.selected.every((id) => review.results[id]?.status === "passed");
}
