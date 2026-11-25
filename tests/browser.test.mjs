import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { startServer } from "../serve.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.REPAIR_PLAYWRIGHT_MODULE || "playwright");
let server;
let browser;

before(async () => {
  server = await startServer();
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  await server?.close();
});

async function openWorkbench(t, options = {}, setup) {
  const page = await browser.newPage(options);
  page.setDefaultTimeout(8_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(async () => {
    await page.close();
    assert.deepEqual(errors, []);
  });
  await setup?.(page);
  await page.goto(server.url);
  await page.locator("#preview-frame").contentFrame().locator("[data-preview-ready]").waitFor();
  return page;
}

async function confirmBoth(page) {
  await page.getByRole("button", { name: "Interpret request" }).click();
  await page.getByRole("checkbox", { name: /Keep completion after a reload/ }).check();
  await page.getByRole("button", { name: "Confirm scope" }).click();
}

const status = (page, id) => page.locator('[data-check="' + id + '"] [data-result]');

test("comparison runs both candidates against one scope and keeps evidence tied to its candidate", async (t) => {
  const page = await openWorkbench(t, { viewport: { width: 1440, height: 1050 } });
  const compare = page.getByRole("button", { name: "Compare A and B" });
  const accept = page.getByRole("button", { name: "Accept checked scope" });
  const table = page.getByRole("table", { name: "Candidate comparison" });
  assert.ok(await compare.isDisabled());
  await confirmBoth(page);
  await compare.click();
  const reloadRow = table.getByRole("row", { name: /Keep completion after a reload/ });
  await reloadRow.getByText("Failed in A, passed in B", { exact: true }).waitFor();
  assert.equal(await table.getByRole("row").count(), 3);
  await reloadRow.getByText("Failed", { exact: true }).click();
  await reloadRow.getByText("The target task was open after a new document loaded.").waitFor();
  await expectStatus(page, "reload", "Failed");
  assert.ok(await accept.isDisabled());
  await capture(page, "candidate-comparison.png");

  await page.getByRole("button", { name: "Candidate B" }).click();
  await page.getByText("Candidate B loaded.").waitFor();
  await expectStatus(page, "reload", "Passed");
  assert.ok(await accept.isEnabled());
  await accept.click();
  await page.getByText("Accepted Candidate B for both selected requirements.").waitFor();

  await page.getByRole("button", { name: "Edit scope" }).click();
  await table.waitFor({ state: "hidden" });
  await page.getByRole("checkbox", { name: /Keep completion after a reload/ }).uncheck();
  await page.getByRole("button", { name: "Confirm scope" }).click();
  await compare.click();
  await table.getByText("Passed in both", { exact: true }).waitFor();
  assert.equal(await table.getByRole("row").count(), 2);
  await page.setViewportSize({ width: 320, height: 800 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await capture(page, "comparison-narrow.png");
});

test("request examples show the supported scope and invalidate earlier evidence", async (t) => {
  const page = await openWorkbench(t, { viewport: { width: 390, height: 850 } });
  const list = page.getByRole("checkbox", { name: /Hide completed tasks/ });
  const reload = page.getByRole("checkbox", { name: /Keep completion after a reload/ });
  await page.getByText("This demo checks task visibility and completion after a reload in the same tab.").waitFor();
  await page.getByRole("button", { name: "List only", exact: true }).click();
  assert.equal(await list.isChecked(), true);
  assert.equal(await reload.isChecked(), false);
  await page.getByRole("button", { name: "Confirm scope" }).click();
  await page.getByRole("button", { name: "Run selected checks" }).click();
  await expectStatus(page, "filter", "Passed");
  await page.getByRole("button", { name: "Ask a vague request" }).click();
  await page.getByText("Should this repair also preserve completion after a reload?").waitFor();
  await expectStatus(page, "filter", "Awaiting scope");
  await page.getByRole("button", { name: "List and reload" }).click();
  assert.equal(await reload.isChecked(), true);
  await capture(page, "request-examples.png");
});

test("the guided example explains reload and shows progress from scope to decision", async (t) => {
  const page = await openWorkbench(t, { viewport: { width: 1440, height: 1050 } });
  const stage = () => page.locator('[aria-current="step"]').textContent();
  await capture(page, "guided-start.png");
  await page.getByRole("button", { name: "Try the example" }).click();
  assert.match(await stage(), /Confirm scope/);
  assert.ok(await page.getByRole("checkbox", { name: /Keep completion after a reload/ }).isChecked());
  await page.getByText("A completed task should still be marked complete when the page loads again.").waitFor();
  await page.getByRole("button", { name: "Confirm scope" }).click();
  assert.match(await stage(), /Run checks/);
  await page.getByRole("button", { name: "Run selected checks" }).click();
  await expectStatus(page, "reload", "Failed");
  await page.getByText("1 passed · 1 failed", { exact: true }).waitFor();
  assert.match(await stage(), /Make a decision/);
  await page.setViewportSize({ width: 390, height: 850 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await capture(page, "guided-mobile.png");
});

async function expectStatus(page, id, expected) {
  await status(page, id).filter({ hasText: new RegExp("^" + expected + "$") }).waitFor();
}

async function capture(page, name) {
  if (!process.env.REPAIR_SCREENSHOT_DIR) return;
  await mkdir(process.env.REPAIR_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: join(process.env.REPAIR_SCREENSHOT_DIR, name), fullPage: true });
}

test("known partial repair fails a real reload while the revised repair is accepted", async (t) => {
  const page = await openWorkbench(t, { viewport: { width: 1440, height: 1050 } });
  const preview = page.locator("#preview-frame").contentFrame();
  const acceptance = page.getByRole("button", { name: "Accept checked scope" });
  await confirmBoth(page);
  await page.getByRole("button", { name: "Run list check" }).click();
  await expectStatus(page, "filter", "Passed");
  await expectStatus(page, "reload", "Not run");
  assert.ok(await acceptance.isDisabled());
  await page.getByRole("button", { name: "Run reload check" }).click();
  await expectStatus(page, "reload", "Failed");
  await page.getByText("The target task was open after a new document loaded.").waitFor();
  assert.ok(await acceptance.isDisabled());
  assert.equal(await preview.getByRole("checkbox", { name: "Write project abstract" }).isChecked(), false);
  await page.getByRole("button", { name: "Defer decision" }).click();
  await page.getByText("Decision deferred for Candidate A.").waitFor();
  await capture(page, "candidate-a-failed.png");

  await page.getByRole("button", { name: "Candidate B" }).click();
  await expectStatus(page, "filter", "Not run");
  await expectStatus(page, "reload", "Not run");
  await page.getByRole("button", { name: "Run selected checks" }).click();
  await expectStatus(page, "filter", "Passed");
  await expectStatus(page, "reload", "Passed");
  await page.getByRole("button", { name: "Defer decision" }).click();
  await page.getByRole("button", { name: "Resume review" }).click();
  await acceptance.click();
  await page.getByText("Accepted Candidate B for both selected requirements.").waitFor();
  await capture(page, "candidate-b-accepted.png");
});

test("manual preview reload navigates and preserves only the working candidate", async (t) => {
  const page = await openWorkbench(t);
  const preview = page.locator("#preview-frame").contentFrame();
  for (const candidate of ["A", "B"]) {
    await page.getByRole("button", { name: "Candidate " + candidate }).click();
    const root = preview.locator('[data-preview-ready][data-candidate="' + candidate + '"]');
    await root.waitFor();
    const documentId = await root.getAttribute("data-document-id");
    const target = preview.getByRole("checkbox", { name: "Write project abstract" });
    await target.click();
    await target.waitFor({ state: "hidden" });
    await preview.getByRole("button", { name: "All tasks" }).click();
    assert.equal(await target.isChecked(), true);
    await page.getByRole("button", { name: "Reload preview" }).click();
    await preview.locator('[data-preview-ready]:not([data-document-id="' + documentId + '"])').waitFor();
    await preview.getByRole("button", { name: "All tasks" }).click();
    assert.equal(await target.isChecked(), candidate === "B");
  }
});

test("correcting a scope invalidates old evidence and the narrow layout fits", async (t) => {
  const page = await openWorkbench(t, { viewport: { width: 390, height: 850 } });
  await confirmBoth(page);
  await page.getByRole("button", { name: "Run list check" }).click();
  await expectStatus(page, "filter", "Passed");
  await page.getByRole("button", { name: "Edit scope" }).click();
  await page.getByRole("checkbox", { name: /Keep completion after a reload/ }).uncheck();
  await page.setViewportSize({ width: 1100, height: 930 });
  await capture(page, "scope-correction.png");
  await page.getByRole("button", { name: "Confirm scope" }).click();
  await expectStatus(page, "filter", "Not run");
  await expectStatus(page, "reload", "Outside scope");
  await page.getByRole("button", { name: "Run selected checks" }).click();
  await expectStatus(page, "filter", "Passed");
  await page.getByRole("button", { name: "Accept checked scope" }).click();
  await page.getByText("Accepted Candidate A for the list requirement.").waitFor();
  await capture(page, "scope-list-only-accepted.png");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await page.locator("#preview-frame").contentFrame().locator("body").evaluate(() => {
      return document.documentElement.scrollWidth <= innerWidth;
    }));
  }
});

test("the same request is interpreted using the actual view and manual reload history", async (t) => {
  const page = await openWorkbench(t);
  const preview = page.locator("#preview-frame").contentFrame();
  const interpret = page.getByRole("button", { name: "Interpret request" });
  const list = page.getByRole("checkbox", { name: /Hide completed tasks/ });
  const reload = page.getByRole("checkbox", { name: /Keep completion after a reload/ });
  await interpret.click();
  assert.equal(await list.isChecked(), true);
  assert.equal(await reload.isChecked(), false);
  await preview.getByRole("button", { name: "All tasks" }).click();
  await interpret.click();
  assert.equal(await list.isChecked(), false);
  await page.getByText("Should the task disappear only from Open tasks and stay visible in All tasks?").waitFor();
  await page.getByRole("button", { name: "Reload preview" }).click();
  await page.getByText("A new preview document loaded.").waitFor();
  await interpret.click();
  assert.equal(await list.isChecked(), true);
  assert.equal(await reload.isChecked(), true);
});

test("storage unavailable is reported as a check error with no acceptance", async (t) => {
  const page = await openWorkbench(t, {}, (page) => page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
  }));
  await confirmBoth(page);
  await page.getByRole("button", { name: "Candidate B" }).click();
  await page.getByRole("button", { name: "Run reload check" }).click();
  await expectStatus(page, "reload", "Check error");
  await page.getByText("Browser storage is unavailable for this preview.", { exact: true }).waitFor();
  assert.ok(await page.getByRole("button", { name: "Accept checked scope" }).isDisabled());
});
