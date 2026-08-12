// Lightweight markdown-like parsing for question text.
// Supported syntax: "# " = heading, "## " = sub-heading (requirements/conditions),
// "・" or "- " = list item. Everything else is plain paragraph text.

export function parseQuestionText(text) {
  const lines = String(text ?? "").split("\n");
  const blocks = [];
  let currentList = null;
  let currentParagraph = null;

  function flushList() {
    if (currentList) {
      blocks.push({ type: "list", items: currentList });
      currentList = null;
    }
  }

  function flushParagraph() {
    if (currentParagraph) {
      blocks.push({ type: "p", lines: currentParagraph });
      currentParagraph = null;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const h2Match = line.match(/^##\s+(.*)/);
    const h1Match = !h2Match && line.match(/^#\s+(.*)/);
    const listMatch = line.match(/^(?:・|-\s+)(.*)/);

    if (h2Match) {
      flushList();
      flushParagraph();
      blocks.push({ type: "h2", text: h2Match[1] });
    } else if (h1Match) {
      flushList();
      flushParagraph();
      blocks.push({ type: "h1", text: h1Match[1] });
    } else if (listMatch && listMatch[1]) {
      flushParagraph();
      if (!currentList) currentList = [];
      currentList.push(listMatch[1]);
    } else if (line.trim() === "") {
      flushList();
      flushParagraph();
    } else {
      flushList();
      if (!currentParagraph) currentParagraph = [];
      currentParagraph.push(line);
    }
  }
  flushList();
  flushParagraph();
  return blocks;
}

// A compact, single-line-ish rendering for dense list rows (markers stripped).
export function toPlainSummary(text) {
  return String(text ?? "")
    .split("\n")
    .map((l) => l.replace(/^#{1,2}\s+/, "").replace(/^(?:・|-\s+)/, "").trim())
    .filter(Boolean)
    .join(" ");
}
