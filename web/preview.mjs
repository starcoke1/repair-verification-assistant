import { storageKey, targetId, witnessId } from "./preview-config.mjs";

const params = new URLSearchParams(location.search);
const candidate = params.get("candidate") === "B" ? "B" : "A";
const key = storageKey(params.get("session") || "standalone");
const preview = document.getElementById("todo-preview");
const error = document.getElementById("preview-error");
const list = document.getElementById("task-list");
const count = document.getElementById("task-count");
const filters = Array.from(preview.querySelectorAll("[data-view]"));
const labels = {
  [targetId]: "Write project abstract",
  [witnessId]: "Organise references"
};
let completed = new Set();
let view = "open";

function storageUnavailable() {
  preview.dataset.storageError = "Browser storage is unavailable for this preview.";
  error.textContent = preview.dataset.storageError;
  error.hidden = false;
}

if (candidate === "B") {
  try {
    const stored = JSON.parse(sessionStorage.getItem(key) ?? "[]");
    completed = new Set(stored.filter((id) => Object.hasOwn(labels, id)));
  } catch {
    storageUnavailable();
  }
}

function save() {
  if (candidate === "A") return;
  try {
    sessionStorage.setItem(key, JSON.stringify([...completed]));
  } catch {
    storageUnavailable();
  }
}

function render() {
  filters.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === view)));
  preview.dataset.activeView = view;
  const shown = Object.keys(labels).filter((id) => view === "all" || !completed.has(id));
  list.replaceChildren(...shown.map((id) => {
    const row = document.createElement("li");
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    const title = document.createElement("span");
    const status = document.createElement("span");
    row.dataset.taskId = id;
    checkbox.type = "checkbox";
    checkbox.checked = completed.has(id);
    title.textContent = labels[id];
    status.className = "task-state";
    status.textContent = checkbox.checked ? "Complete" : "Open";
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) completed.add(id);
      else completed.delete(id);
      save();
      render();
      const replacement = list.querySelector('[data-task-id="' + id + '"] input');
      (replacement || filters[0]).focus();
    });
    label.append(checkbox, title, status);
    row.append(label);
    return row;
  }));
  count.textContent = shown.length + (shown.length === 1 ? " task shown" : " tasks shown");
}

filters.forEach((button) => button.addEventListener("click", () => {
  view = button.dataset.view;
  render();
}));
preview.dataset.candidate = candidate;
preview.dataset.documentId = crypto.randomUUID();
render();
preview.dataset.previewReady = "";
