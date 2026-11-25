import { BrowserPreview, withCheckPreview } from "./browser-preview.mjs";
import { checkFilter, checkReload, requirements } from "./checks.mjs";
import { interpretRequest } from "./intent.mjs";
import { canAccept, createReview, nextCandidate, recordResult } from "./review.mjs";

const byId = (id) => document.getElementById(id);
const request = byId("request");
const suggestion = byId("suggestion");
const scopeInputs = Array.from(byId("scope-options").querySelectorAll("input"));
const candidateButtons = Array.from(document.querySelectorAll("button[data-candidate]"));
const rows = Array.from(document.querySelectorAll("[data-check]"));
const steps = Array.from(document.querySelectorAll("[data-review-step]"));
const preview = new BrowserPreview(byId("preview-frame"));
const evaluators = { filter: checkFilter, reload: checkReload };
const resultLabels = { passed: "Passed", failed: "Failed", error: "Check error" };

let review = createReview("A");
let interpretation = null;
let hasReloaded = false;
let changingPreview = false;
let activeCheck = null;
let running = false;

function selectedInputs() {
  return scopeInputs.filter((input) => input.checked).map((input) => input.value);
}

function showList(list, items) {
  list.hidden = items.length === 0;
  list.replaceChildren(...items.map((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    return li;
  }));
}

function scopeDescription() {
  if (review.selected.length === 2) return "both selected requirements";
  return review.selected.includes("filter") ? "the list requirement" : "the reload requirement";
}

function decisionText() {
  if (running) return "The check is running in a separate browser preview.";
  if (review.decision === "accepted") return "Accepted Candidate " + review.candidate + " for " + scopeDescription() + ".";
  if (review.decision === "deferred") return "Decision deferred for Candidate " + review.candidate + ".";
  if (!review.selected.length) return "Confirm a scope to start your review.";
  if (canAccept(review)) return "All selected checks passed. You can accept the checked scope.";
  const results = review.selected.map((id) => review.results[id]?.status);
  if (results.includes("failed")) return "A selected requirement failed. Review the evidence or defer your decision.";
  if (results.includes("error")) return "A check could not finish. Review the error and try again.";
  return "Run all selected checks before accepting this candidate.";
}

function render() {
  const confirmed = review.selected.length > 0;
  const locked = running || changingPreview;
  const results = review.selected.map((id) => review.results[id]?.status);
  const settled = confirmed && results.every(Boolean);
  const stage = !confirmed ? "scope" : running || !settled ? "checks" : "decision";
  let previous = true;
  for (const step of steps) {
    const current = step.dataset.reviewStep === stage;
    if (current) {
      step.setAttribute("aria-current", "step");
      previous = false;
    } else {
      step.removeAttribute("aria-current");
    }
    step.classList.toggle("step-done", previous || (current && review.decision === "accepted"));
  }
  const summary = byId("check-summary");
  const counts = [
    ["passed", "passed"], ["failed", "failed"], ["error", "could not run"], [undefined, "not run"]
  ].map(([status, label]) => {
    const count = results.filter((result) => result === status).length;
    return count ? count + " " + label : null;
  }).filter(Boolean);
  const summaryText = counts.join(" · ");
  if (summary.textContent !== summaryText) summary.textContent = summaryText;
  summary.hidden = !confirmed;
  byId("try-example").disabled = locked;
  suggestion.hidden = interpretation === null;
  byId("question").hidden = confirmed || !interpretation?.question;
  byId("interpret").disabled = locked;
  request.disabled = locked;
  byId("reload-preview").disabled = changingPreview;
  for (const button of candidateButtons) {
    button.disabled = locked;
    button.setAttribute("aria-pressed", String(button.dataset.candidate === review.candidate));
  }
  byId("scope-options").disabled = confirmed || running;
  byId("confirm-scope").hidden = confirmed;
  byId("confirm-scope").disabled = selectedInputs().length === 0 || locked;
  byId("edit-scope").hidden = !confirmed;
  byId("edit-scope").disabled = running;
  byId("evidence-context").textContent = "Candidate " + review.candidate + (confirmed
    ? " · " + review.selected.length + (review.selected.length === 1 ? " requirement selected" : " requirements selected")
    : " · Confirm the scope to run checks.");
  byId("run-selected").disabled = !confirmed || locked;
  byId("defer").textContent = review.decision === "deferred" ? "Resume review" : "Defer decision";
  byId("defer").disabled = !confirmed || locked || review.decision === "accepted";
  byId("accept").disabled = locked || !canAccept(review) || review.decision === "accepted";
  byId("decision-message").textContent = decisionText();

  for (const row of rows) {
    const id = row.dataset.check;
    const isSelected = review.selected.includes(id);
    const result = review.results[id];
    const resultLabel = row.querySelector("[data-result]");
    const state = activeCheck === id ? "running" : result?.status;
    resultLabel.dataset.result = state || "pending";
    resultLabel.textContent = activeCheck === id ? "Running"
      : result ? resultLabels[result.status]
        : isSelected ? "Not run" : confirmed ? "Outside scope" : "Awaiting scope";
    row.querySelector("[data-expected]").textContent = requirements[id].expected;
    showList(row.querySelector("[data-observations]"), result?.observations || []);
    row.querySelector("[data-run]").disabled = !isSelected || locked;
  }
}

function clearReview({ keepInterpretation = false } = {}) {
  review = createReview(review.candidate);
  if (!keepInterpretation) interpretation = null;
  byId("scope-message").textContent = "";
  render();
}

byId("request-form").addEventListener("submit", (event) => {
  event.preventDefault();
  clearReview();
  interpretation = interpretRequest(request.value, {
    view: preview.currentView(),
    recentlyReloaded: hasReloaded
  });
  byId("question").textContent = interpretation.question;
  showList(byId("reasons"), interpretation.reasons);
  for (const input of scopeInputs) input.checked = interpretation.suggested.includes(input.value);
  render();
});

byId("try-example").addEventListener("click", async () => {
  request.value = "Hide completed tasks from the open list. Keep completion after a reload.";
  if (review.candidate !== "A") {
    review = nextCandidate(review, "A");
    await loadCandidate("A");
  }
  byId("request-form").requestSubmit();
  byId("confirm-scope").focus();
});

request.addEventListener("input", () => {
  if (interpretation) clearReview();
});
for (const input of scopeInputs) input.addEventListener("change", render);
byId("confirm-scope").addEventListener("click", () => {
  review = createReview(review.candidate, selectedInputs());
  byId("scope-message").textContent = "Confirmed. Use Edit scope to change your requirements.";
  render();
  byId("run-selected").focus();
});
byId("edit-scope").addEventListener("click", () => {
  clearReview({ keepInterpretation: true });
  byId("scope-message").textContent = "Reconfirm the scope before running checks again.";
  scopeInputs[0].focus();
});

async function loadCandidate(candidate) {
  changingPreview = true;
  hasReloaded = false;
  byId("preview-message").textContent = "Loading Candidate " + candidate + "…";
  render();
  try {
    await preview.open(candidate);
    byId("preview-message").textContent = "Candidate " + candidate + " loaded.";
  } catch (error) {
    byId("preview-message").textContent = error.message;
  } finally {
    changingPreview = false;
    render();
  }
}

for (const button of candidateButtons) {
  button.addEventListener("click", () => {
    if (review.candidate === button.dataset.candidate) return;
    review = nextCandidate(review, button.dataset.candidate);
    void loadCandidate(review.candidate);
  });
}

byId("reload-preview").addEventListener("click", async () => {
  changingPreview = true;
  render();
  try {
    await preview.reload();
    hasReloaded = true;
    byId("preview-message").textContent = "A new preview document loaded.";
  } catch (error) {
    byId("preview-message").textContent = error.message;
  } finally {
    changingPreview = false;
    render();
  }
});

async function runChecks(ids) {
  if (running || changingPreview || ids.some((id) => !review.selected.includes(id))) return;
  running = true;
  for (const id of ids) {
    activeCheck = id;
    render();
    let result;
    try {
      result = await withCheckPreview(byId("isolated-checks"), review.candidate, evaluators[id]);
    } catch (error) {
      result = { status: "error", observations: [error.message] };
    }
    review = recordResult(review, id, result);
  }
  activeCheck = null;
  running = false;
  render();
}

for (const trigger of document.querySelectorAll("[data-run]")) {
  trigger.addEventListener("click", () => void runChecks([trigger.dataset.run]));
}
byId("run-selected").addEventListener("click", () => void runChecks(review.selected));
byId("defer").addEventListener("click", () => {
  review = { ...review, decision: review.decision === "deferred" ? null : "deferred" };
  render();
});
byId("accept").addEventListener("click", () => {
  if (!canAccept(review)) return;
  review = { ...review, decision: "accepted" };
  render();
});

void loadCandidate(review.candidate);
