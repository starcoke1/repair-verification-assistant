# Repair Verification Assistant

Prose word count **922**. Headings and link text are included. Code blocks and setup commands are excluded.

This workbench helps beginning web developers check a repair to a to-do app. Pick the requirements to check, see what happened in the browser and decide whether to accept the repair.

## Project status

- **Implemented.** You can edit the scope, run browser checks and decide whether to accept either of the two candidate repairs. After a reload, Candidate A forgets that the task was completed. Candidate B remembers it within the same tab.
- **Simulated.** The part labelled AI simulation uses local rules to suggest checks. The rules look at your request, the list on screen and whether you have reloaded the preview. Both candidate repairs were prepared for this demo.

### Planned model API

A model could help when someone describes a supported requirement in words the current rules miss. It could suggest one of the existing checks or ask a clarifying question, such as which list the task should disappear from. The reviewer would still confirm the scope, and the browser would still produce the test results.

I left the API for later so anyone reviewing this prototype could repeat the same cases without an account, an API key or access to a model service. The local rules handle request interpretation in this version.

## Run locally

Use Node.js 20 or later and a current browser. Run this command from the project folder and open the printed local URL.

```sh
node serve.mjs
```

Select **Try the example** to load Candidate A and fill in both requirements. Confirm the scope and run both checks. Review the evidence and defer. Switch to Candidate B, run both checks and accept the checked scope. You can also write your own request or reproduce the behaviour in the manual preview.

Select **Compare A and B** after confirming scope to run both candidates against the same requirements. Expand a result for observations. Switch to the candidate you want to review to use its own comparison results.

When a selected check fails, select **Draft repair feedback**. Edit the reproduction steps, expected behaviour or observations as needed, then select **Copy feedback** to share the text yourself.

## Technology and checks

The interface uses HTML and CSS. JavaScript tracks the confirmed scope and runs each check against the controls in an isolated, same-origin frame. The reload check reads the task state after the new document loads. Candidate B uses session storage to keep that state. A local Node server serves the files.

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
| Continue the A1 example with two fixed candidates. | Two versions of the same app make it possible to compare list behaviour and persistence under the same conditions. |
| Replace the walkthrough's simulated refresh with a real frame reload. | Read the target's checkbox state in a new document. The same check exposed Candidate A's defect and passed for Candidate B. |
| Ask about persistence, then let users confirm or edit scope. | A short request can leave persistence implicit. Browser tests confirmed that changing the live view changes the suggestion and editing scope clears old evidence. |
| Require passing results for acceptance and let the reviewer resume a deferred review. | A reviewer can come back to a candidate and accept it once the selected checks pass. Tests cover failing results, deferring, resuming and accepting. |
| Add a first-run example and an evidence summary. | The example fills in both requirements and explains what reload means here. A browser test follows the progress indicator up to the point where one check passes and the other fails. |
| Add request guidance and three selectable examples. | The examples show a list-only request, a request for both checks and one that needs clarification. Browser tests inspect the suggestions and verify that changing the request clears earlier results. |
| Add a side-by-side comparison. | Rerunning the same requirements makes it possible to see which behaviour improved. Browser tests verify that the comparison reuses the checks, keeps evidence attached to each candidate and clears when scope changes. |
| Draft editable feedback from failed checks. | The browser suite checks the draft against Candidate A's result, tests copying the edited text and verifies that switching to B clears the draft. |
| Make the current step, candidate and outcome easier to spot. | I asked for a clearer visual presentation before finalising the report. Codex adjusted the interface and reran the tests. The walkthrough screenshots show the updated interface in use. |

See the changes for [guided review](https://github.com/starcoke1/repair-verification-assistant/commit/4142cad5f525543d9c74b7f3e9d19a291ad16892), [request clarification](https://github.com/starcoke1/repair-verification-assistant/commit/a74ecb93bf367625f8a3b497ea00fc0ca65f9608), [comparison](https://github.com/starcoke1/repair-verification-assistant/commit/88b89ddfaac11a1783fa40a58c927223677a297d) and [failure feedback](https://github.com/starcoke1/repair-verification-assistant/commit/c0c2b52693726f0eb0dcd97ded5ebc9d5176081c).

## Using AI

I kept the to-do app from my A1 review because it gave me a simple way to explore how beginners check a repair before accepting it. I talked through the design with Codex and used it to help write the code, tests and documentation.

When I tried entering a request and comparing the two versions, I still had to ask what the request box was meant to take. I asked for examples and tried the flow again once they were in place. After trying the comparison, I agreed to add a draft that would let reviewers turn a failed result into feedback they could edit and send.

Codex also helped review how the rules interpreted requests about keeping tasks visible and reopening a closed tab. That review led to rule changes and tests for both cases. The feedback draft, including editing and copying, was checked in the browser suite.

## Supporting material

- [System diagram and technical boundaries](docs/architecture.md)
- [Interaction walkthroughs and browser captures](docs/walkthrough.md)
