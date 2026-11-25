# Repair Verification Assistant

Prose word count **499**. Headings and link text are included. Code blocks and setup commands are excluded.

A review workbench for a beginner with a candidate to-do app repair. Confirm the requirements, inspect browser evidence and decide what to accept.

## Project status

- **Implemented.** Two fixed candidate previews, editable scope, separate browser checks, native page reload, evidence and decisions. Candidate A loses completion after reload. Candidate B keeps it within the current tab.
- **Simulated.** Rules suggest checks from the user's request, the active list and manual reload history. The interface labels this as an AI simulation. The candidates are purpose-built examples.
- **Future work.** A live model may help interpret more varied requests. The supported checks and evaluation cases would stay explicit.

## Run locally

Use Node.js 20 or later and a current browser. Run this command from the project folder and open the printed local URL.

```sh
node serve.mjs
```

Select **Try the example** to load Candidate A and fill in both requirements. Confirm the scope and run both checks. Review the evidence and defer. Switch to Candidate B, run both checks and accept the checked scope. You can also write your own request or reproduce the behaviour in the manual preview.

## Technology and checks

HTML and CSS render the interface. Browser JavaScript manages scope and evidence. Each check drives real controls in an isolated, same-origin frame. Candidate B uses session storage. The reload check observes the next document. The local Node server serves the static files.

```sh
node --test tests/unit.test.mjs
npm install --no-save --package-lock=false playwright
npx playwright install chromium --only-shell
node --test tests/browser.test.mjs
```

The browser suite covers both candidates, manual reload, scope edits, context-sensitive suggestions and storage errors. The unit suite also checks that deleting the target or hiding a second task fails the filter check.

## Development record

| Change | Reason and check |
| --- | --- |
| Continue the A1 example with two fixed candidates. | The student selected the A1 direction. The workbench supports a controlled comparison of list behaviour and persistence. |
| Replace the walkthrough's simulated refresh with a real frame reload. | Read the target's checkbox state in a new document. The same check exposed Candidate A's defect and passed for Candidate B. |
| Ask about persistence, then let users confirm or edit scope. | A short request can leave persistence implicit. Browser tests confirmed that changing the live view changes the suggestion and editing scope clears old evidence. |
| Require passing evidence for acceptance and allow resuming a deferred review. | This is a provisional implementation choice. Checks cover failed, deferred, resumed and accepted decisions. |
| Add a first-run example and an evidence summary. | The student asked for clearer guidance and an explanation of reload. The example fills in the two requirements. A browser test follows the progress indicator from confirmation to the split outcome. |

## Authorship and AI assistance

The student's A1 work supplied the research question and the to-do example. Codex drafted the interface, rule set, candidate examples, checks and documentation. A separate Codex reviewer found cases where the rules could reverse a request to keep tasks visible or imply support for reopening a closed tab. Codex revised the rules and ran targeted checks. Student review of this revision is pending.

## Supporting material

- [System diagram and technical boundaries](docs/architecture.md)
- [Interaction walkthroughs and browser captures](docs/walkthrough.md)
