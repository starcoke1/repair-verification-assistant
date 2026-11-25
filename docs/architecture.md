# System architecture

```mermaid
flowchart TB
    accTitle: Repair verification architecture
    accDescr: The workbench sends a request and preview context to a rule-based simulation. Confirmed scope drives isolated browser checks. Actual observations return to the workbench for a human decision.
    user[Beginner reviewer]
    ui[Workbench and scope]
    preview[Manual task preview]
    rules[Rule-based AI simulation]
    runner[Browser check runner]
    isolated[Isolated candidate preview]
    storage[Tab session storage B]
    future[Live model planned option]

    user -->|request and confirmation| ui
    ui -->|evidence and choices| user
    ui -->|select and reload| preview
    preview -->|active view| ui
    ui -->|request and context| rules
    rules -->|suggestions and question| ui
    ui -->|candidate and checks| runner
    runner -->|clicks and reload| isolated
    isolated -->|DOM and document ID| runner
    runner -->|observations and status| ui
    preview <-->|completion state| storage
    isolated <-->|isolated completion state| storage
    future -.->|optional interpretation| ui

    classDef simulated fill:#fff1d9,stroke:#9d6f23,color:#49300b
    classDef planned fill:#f4f5f4,stroke:#68736d,stroke-dasharray:5 4,color:#26332c
    class rules simulated
    class future planned
```

## Boundaries

- **Implemented.** The workbench, editable scope, task previews, check runner and decisions run in the browser. A local HTTP server supplies the files. The previews and workbench share an origin so the runner can inspect the preview's task controls.
- **Simulated.** The request interpreter uses bounded rules. It considers the request, the active task view and whether the reviewer used manual reload. The candidate repairs are fixed examples.
- **Observed evidence.** The list check measures membership and completion in the rendered task list. The reload check compares the state of the target task across two actual browser documents. Check frames use separate storage keys and remove their test state on completion.
- **Review scope.** Session storage supports reload of the current tab. Visual presentation can be assessed using the manual preview. Acceptance covers the selected requirements and current candidate.
- **Candidate comparison.** The runner executes each confirmed check for both candidates. The workbench keeps the observations under their respective candidates and clears the comparison when the reviewer changes scope.
- **Planned option.** A model could propose check IDs and clarifying questions. The browser runner would still derive evidence from the candidate application.
