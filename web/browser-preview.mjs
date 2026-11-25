import { storageKey, targetId, witnessId } from "./preview-config.mjs";

function whenDocumentChanges(frame, change) {
  const previous = frame.contentDocument;
  return new Promise((resolve, reject) => {
    function cleanup() {
      frame.removeEventListener("load", verify);
      clearTimeout(timer);
    }
    function verify() {
      const document = frame.contentDocument;
      if (document === previous || !document?.querySelector("[data-preview-ready]")) return;
      cleanup();
      resolve();
    }
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("The browser did not load a new task preview within five seconds."));
    }, 5_000);
    frame.addEventListener("load", verify);
    try {
      change();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export class BrowserPreview {
  constructor(frame) {
    this.frame = frame;
    this.session = null;
  }

  async open(candidate) {
    this.removeStoredState();
    this.session = crypto.randomUUID();
    const url = new URL("./preview.html", window.location.href);
    url.searchParams.set("candidate", candidate);
    url.searchParams.set("session", this.session);
    await whenDocumentChanges(this.frame, () => { this.frame.src = url.href; });
  }

  removeStoredState() {
    if (!this.session) return;
    try {
      sessionStorage.removeItem(storageKey(this.session));
    } catch {
      // The preview exposes storage failures when the candidate requires it.
    }
  }

  currentView() {
    return this.frame.contentDocument?.querySelector("[data-preview-ready]")?.dataset.activeView;
  }

  root() {
    const root = this.frame.contentDocument?.querySelector("[data-preview-ready]");
    if (!root) throw new Error("The browser preview is unavailable.");
    if (root.dataset.storageError) throw new Error(root.dataset.storageError);
    return root;
  }

  setView(view) {
    const button = this.root().querySelector('[data-view="' + view + '"]');
    if (!button) throw new Error("The browser preview did not expose the requested task list.");
    button.click();
  }

  completeTarget() {
    const checkbox = this.root().querySelector('[data-task-id="' + targetId + '"] input');
    if (!checkbox) throw new Error("The sample task could not be found.");
    if (!checkbox.checked) checkbox.click();
  }

  reload() {
    return whenDocumentChanges(this.frame, () => this.frame.contentWindow.location.reload());
  }

  observe() {
    const root = this.root();
    const task = root.querySelector('[data-task-id="' + targetId + '"] input');
    return {
      targetVisible: Boolean(task),
      targetCompleted: task?.checked ?? null,
      witnessVisible: Boolean(root.querySelector('[data-task-id="' + witnessId + '"]')),
      documentId: root.dataset.documentId
    };
  }
}

export async function withCheckPreview(container, candidate, run) {
  const frame = document.createElement("iframe");
  frame.title = "Isolated browser check";
  const preview = new BrowserPreview(frame);
  container.append(frame);
  try {
    await preview.open(candidate);
    return await run(preview);
  } finally {
    preview.removeStoredState();
    frame.remove();
  }
}
