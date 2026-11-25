import test from "node:test";
import assert from "node:assert/strict";
import { checkFilter, checkReload } from "../web/checks.mjs";
import { interpretRequest } from "../web/intent.mjs";
import { canAccept, createReview, nextCandidate, recordResult } from "../web/review.mjs";

const outcome = (status) => ({ status, observations: [] });

function samplePreview({
  persist = true, hideWitness = false, removeTarget = false, realReload = true, seedVisible = true
} = {}) {
  let view = "open";
  let completed = false;
  let documentId = "before";
  let reloadCount = 0;
  return {
    async setView(value) { view = value; },
    async completeTarget() { completed = true; },
    async reload() {
      reloadCount += 1;
      if (!persist) completed = false;
      if (realReload) documentId = "after";
    },
    observe() {
      const displayTarget = seedVisible && (view === "all" || !completed) && !(removeTarget && completed);
      return {
        targetVisible: displayTarget,
        targetCompleted: displayTarget ? completed : null,
        witnessVisible: !hideWitness || !completed,
        documentId
      };
    },
    get reloadCount() { return reloadCount; }
  };
}

test("filter verification checks hiding, retention and a second open task", async () => {
  assert.equal((await checkFilter(samplePreview())).status, "passed");
  assert.equal((await checkFilter(samplePreview({ hideWitness: true }))).status, "failed");
  assert.equal((await checkFilter(samplePreview({ removeTarget: true }))).status, "failed");
  assert.equal((await checkFilter(samplePreview({ seedVisible: false }))).status, "error");
});

test("persistence is measured after a reload and missing navigation is an error", async () => {
  const working = samplePreview();
  assert.equal((await checkReload(working)).status, "passed");
  assert.equal(working.reloadCount, 1);
  assert.equal((await checkReload(samplePreview({ persist: false }))).status, "failed");
  assert.equal((await checkReload(samplePreview({ realReload: false }))).status, "error");
});

test("the same ambiguous request gets a different scope suggestion from observed context", () => {
  const request = "Make completed tasks disappear";
  const open = interpretRequest(request, { view: "open", recentlyReloaded: false });
  const all = interpretRequest(request, { view: "all", recentlyReloaded: false });
  const reloaded = interpretRequest(request, { view: "open", recentlyReloaded: true });
  assert.deepEqual(open.suggested, ["filter"]);
  assert.ok(open.question);
  assert.deepEqual(all.suggested, []);
  assert.ok(all.question);
  assert.deepEqual(reloaded.suggested, ["filter", "reload"]);
});

test("explicit intent, exclusions and unsupported requests remain selectable", () => {
  const context = { view: "open", recentlyReloaded: true };
  assert.deepEqual(interpretRequest("完成任务后从未完成列表隐藏，刷新后仍保留完成状态", context).suggested, ["filter", "reload"]);
  assert.deepEqual(interpretRequest("Hide completed tasks in the open list. No need to check refresh.", context).suggested, ["filter"]);
  assert.deepEqual(interpretRequest("Delete completed tasks permanently", context).suggested, []);
  assert.deepEqual(interpretRequest("Add calendar sync", context).suggested, []);
  assert.deepEqual(interpretRequest("Keep completed tasks visible in the open list", context).suggested, []);
  assert.deepEqual(interpretRequest("Do not hide completed tasks", context).suggested, []);
  assert.deepEqual(interpretRequest("Keep completion after I close and reopen the tab", context).suggested, []);
  assert.deepEqual(interpretRequest("Hide completed tasks in the open list and keep completion after closing the tab", context).suggested, ["filter"]);
});

test("acceptance is limited to confirmed scope with current passing evidence", () => {
  let review = createReview("A", ["filter", "reload", "filter", "unknown"]);
  assert.deepEqual(review.selected, ["filter", "reload"]);
  assert.equal(canAccept(review), false);
  review = recordResult(review, "filter", outcome("passed"));
  assert.equal(canAccept(review), false);
  review = recordResult(review, "reload", outcome("failed"));
  assert.equal(canAccept(review), false);
  const next = nextCandidate(review, "B");
  assert.deepEqual(next.results, {});
  assert.equal(canAccept(next), false);
  const narrower = createReview("B", ["filter"]);
  assert.equal(recordResult(narrower, "reload", outcome("passed")), narrower);
  assert.equal(canAccept(recordResult(narrower, "filter", outcome("passed"))), true);
  assert.equal(canAccept(createReview("B", [])), false);
});
