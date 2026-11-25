const deletion = /\b(delete|erase|permanently remove)\b|删除|彻底移除/i;
const allViews = /\b(every|all)\s+(the\s+)?(views|lists)\b|所有视图|所有列表/i;
const filterWords = /\b(hid(e|ing)|disappear|filter|no longer (appear|show))\w*\b|隐藏|消失|筛选|不再显示/i;
const keepVisible = /\b(do not|don't|never)\s+hid(e|ing)\b|\b(keep|remain|stay)[^.?!。！？]*\bvisible\b|不要隐藏|不隐藏|继续显示|保持可见/i;
const openWords = /\b(open|active|pending|incomplete|unfinished)\s+(task(s)?|list|view)\b|未完成/i;
const reloadWords = /\b(reload|refresh|persist)\w*\b|刷新|重载|持久|保留完成/i;
const beyondReload = /\b(reopen|reopening|after closing)\b|\bclos(e|ing)\b[^.?!。！？]*\b(tab|browser)\b|关闭(?:标签页|浏览器)|重新打开/i;
const skipReload = /(?:\b(no need|skip|ignore|exclude|do not check|don't check)\b[^.!?。！？;；]*\b(reload|refresh|persist)\w*\b)|(?:\b(reload|refresh)\w*\s+(?:is\s+)?(?:not needed|optional)\b)|(?:不用|无需|不需要|不必|跳过)[^。！？;；]*(?:刷新|重载|持久|保存)/i;

export function interpretRequest(request, context) {
  const text = request.trim();
  if (!text) {
    return { suggested: [], reasons: [], question: "Which behaviour would you like to verify?" };
  }
  if (deletion.test(text) || allViews.test(text)) {
    return {
      suggested: [],
      reasons: [],
      question: "This example checks hiding a task in Open tasks while keeping its record. Is that the behaviour you want?"
    };
  }
  if (keepVisible.test(text)) {
    return {
      suggested: [],
      reasons: [],
      question: "I read this as keeping tasks visible. If you meant hiding completed tasks from Open tasks, select the list check."
    };
  }

  const suggested = [];
  const reasons = [];
  let question = "";
  const filterRequested = filterWords.test(text);
  if (filterRequested && (openWords.test(text) || context.view === "open")) {
    suggested.push("filter");
    reasons.push(openWords.test(text)
      ? "Your request names the open list."
      : "Open tasks was visible when you asked for a task to disappear.");
  } else if (filterRequested) {
    question = "Should the task disappear only from Open tasks and stay visible in All tasks?";
  }

  const explicitlySkipped = skipReload.test(text);
  if (!explicitlySkipped && beyondReload.test(text)) {
    question ||= "This preview verifies a reload in the same browser tab. Would that be sufficient for this review?";
  } else if (!explicitlySkipped && reloadWords.test(text)) {
    suggested.push("reload");
    reasons.push("Your request mentions keeping the result across a reload.");
  } else if (!explicitlySkipped && context.recentlyReloaded && suggested.length) {
    suggested.push("reload");
    reasons.push("You reloaded the preview during this review, so the session may need a reload check.");
    question ||= "Should this repair also preserve completion after a reload?";
  } else if (!explicitlySkipped && suggested.includes("filter")) {
    question ||= "Should this repair also preserve completion after a reload?";
  } else if (explicitlySkipped) {
    reasons.push("Your request puts the reload check outside this scope.");
  }
  if (!suggested.length && !question) {
    question = "I could not match this to a supported check. Choose a check if it matches the behaviour you meant.";
  }
  return { suggested, reasons, question };
}
