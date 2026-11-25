export const requirements = {
  filter: {
    label: "Hide completed tasks in the open list",
    expected: "The target leaves Open tasks, stays completed in All tasks, and a second open task stays visible.",
    steps: [
      "In Open tasks, mark “Write project abstract” complete.",
      "Check the two tasks in Open tasks, then switch to All tasks and find “Write project abstract”."
    ]
  },
  reload: {
    label: "Keep completion after a reload",
    expected: "The same task is still marked complete after the browser loads a new document.",
    steps: [
      "In All tasks, mark “Write project abstract” complete.",
      "Select Reload preview, open All tasks again and check the status of “Write project abstract”."
    ]
  }
};

async function assess(run) {
  try {
    return await run();
  } catch (error) {
    return { status: "error", observations: [error.message] };
  }
}

export function checkFilter(preview) {
  return assess(async () => {
    await preview.setView("open");
    const start = preview.observe();
    if (!start.targetVisible || start.targetCompleted || !start.witnessVisible) {
      throw new Error("The preview did not start with two open sample tasks.");
    }
    await preview.completeTarget();
    const open = preview.observe();
    await preview.setView("all");
    const all = preview.observe();

    const targetHidden = !open.targetVisible;
    const targetRetained = all.targetCompleted === true;
    const witnessVisible = open.witnessVisible;
    return {
      status: targetHidden && targetRetained && witnessVisible ? "passed" : "failed",
      observations: [
        targetHidden ? "The target left Open tasks." : "The target stayed visible in Open tasks.",
        targetRetained ? "The target was still complete in All tasks." : "The target was absent or open in All tasks.",
        witnessVisible ? "A second open task remained visible." : "A second open task disappeared as well."
      ]
    };
  });
}

export function checkReload(preview) {
  return assess(async () => {
    await preview.setView("all");
    await preview.completeTarget();
    const before = preview.observe();
    if (before.targetCompleted !== true) {
      throw new Error("The check could not establish a completed task before reloading.");
    }
    await preview.reload();
    await preview.setView("all");
    const after = preview.observe();
    if (!before.documentId || !after.documentId || before.documentId === after.documentId) {
      throw new Error("The browser did not expose a new preview document.");
    }
    const completed = after.targetCompleted === true;
    const observation = completed
      ? "The target task remained complete after a new document loaded."
      : after.targetVisible
        ? "The target task was open after a new document loaded."
        : "The target task was absent after a new document loaded.";
    return {
      status: completed ? "passed" : "failed",
      observations: ["The target task was marked complete before reload.", observation]
    };
  });
}
