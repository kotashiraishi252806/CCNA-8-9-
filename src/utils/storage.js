import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const QUESTIONS_KEY = "ccna_questions";
const ATTEMPTS_KEY = "ccna_attempts";
export const NETLAB_KEY = "ccna_netlab";
const QUIZ_SESSION_KEY = "ccna_quiz_session";
const FAVORITES_KEY = "ccna_favorites";
const PERSISTED_KEYS = [QUESTIONS_KEY, ATTEMPTS_KEY, NETLAB_KEY, QUIZ_SESSION_KEY, FAVORITES_KEY];

// --- Native persistence ---
// iOS may purge WebView localStorage, so in the native app the durable copy lives
// in Preferences (UserDefaults). localStorage stays the synchronous working copy:
// initStorage() hydrates it at startup and writeItem() writes through to both.

const isNative = Capacitor.isNativePlatform();

export async function initStorage() {
  if (!isNative) return;
  await Promise.all(
    PERSISTED_KEYS.map(async (key) => {
      const { value } = await Preferences.get({ key });
      if (value !== null) {
        localStorage.setItem(key, value);
      } else {
        const local = localStorage.getItem(key);
        if (local !== null) await Preferences.set({ key, value: local });
      }
    }),
  );
}

export function writeItem(key, value) {
  localStorage.setItem(key, value);
  if (isNative) Preferences.set({ key, value });
}

export const IMPORTANCE_LEVELS = ["大", "中", "小"];
const DEFAULT_IMPORTANCE = "中";

// --- Questions ---
// Question shape (type "command"): { id, category, question, type, steps: { answers: string[] }[], importance, explanation? }
// steps is an ordered sequence of commands; most questions have a single step.
// Older data may only have `answers: string[]` (a single command's alternates) —
// normalizeQuestion() upgrades those on read.
//
// Question shape (type "table"): { id, category, question, type, table, importance, explanation? }
// table = { cells: cell[][] }, cell = { blank: boolean, text: string, answer: string }.
// Non-blank cells display `text`; blank cells are filled in by the user and graded against `answer`.

// Question shape (type "matching"): { id, category, question, type, matching, importance, explanation? }
// matching = { headers: string[], rows: { left: string, answers: string[] }[], distractors: string[][] }.
// Each row's left item is matched to one item in every answer column, so a question
// with 2 answer columns relates 3 elements (e.g. protocol → layer → port).
// headers[0] labels the left column and headers[c + 1] answer column c (may be empty).
// Column c's choices are its distinct answers plus distractors[c] (choices that
// match nothing), so one item may be the answer for several rows.
// Older data stored { pairs: { left, right }[], distractors: string[] } (one answer
// column); normalizeMatching() upgrades it on read.

export function emptyMatchingRow(answerColumns = 1) {
  return { left: "", answers: Array.from({ length: answerColumns }, () => "") };
}

function normalizeMatching(m) {
  if (Array.isArray(m?.rows) && m.rows.length > 0) {
    const columns = Math.max(1, ...m.rows.map((r) => r.answers?.length ?? 0));
    const rows = m.rows.map((r) => ({
      left: r.left ?? "",
      answers: Array.from({ length: columns }, (_, c) => r.answers?.[c] ?? ""),
    }));
    const headers = Array.from({ length: columns + 1 }, (_, c) => m.headers?.[c] ?? "");
    const distractors = Array.from({ length: columns }, (_, c) =>
      Array.isArray(m.distractors?.[c]) ? m.distractors[c] : []
    );
    return { headers, rows, distractors };
  }
  if (Array.isArray(m?.pairs) && m.pairs.length > 0) {
    return {
      headers: ["", ""],
      rows: m.pairs.map((p) => ({ left: p.left, answers: [p.right] })),
      distractors: [Array.isArray(m.distractors) ? m.distractors : []],
    };
  }
  return { headers: ["", ""], rows: [emptyMatchingRow()], distractors: [[]] };
}

export function emptyTableCell() {
  return { blank: false, text: "", answer: "" };
}

function normalizeQuestion(q) {
  const type = ["table", "matching"].includes(q.type) ? q.type : "command";
  const importance = IMPORTANCE_LEVELS.includes(q.importance) ? q.importance : DEFAULT_IMPORTANCE;

  if (type === "matching") {
    return { ...q, type, matching: normalizeMatching(q.matching), importance };
  }

  if (type === "table") {
    const table =
      q.table && Array.isArray(q.table.cells) && q.table.cells.length > 0
        ? q.table
        : { cells: [[emptyTableCell()]] };
    return { ...q, type, table, importance };
  }

  const steps =
    Array.isArray(q.steps) && q.steps.length > 0
      ? q.steps
      : [{ answers: Array.isArray(q.answers) ? q.answers : [] }];
  return { ...q, type, steps, importance };
}

export function loadQuestions() {
  try {
    const raw = localStorage.getItem(QUESTIONS_KEY);
    const questions = raw ? JSON.parse(raw) : [];
    return questions.map(normalizeQuestion);
  } catch {
    return [];
  }
}

export function saveQuestions(questions) {
  writeItem(QUESTIONS_KEY, JSON.stringify(questions));
}

export function addQuestion(question) {
  const questions = loadQuestions();
  const newQuestion = { ...question, id: crypto.randomUUID() };
  questions.push(newQuestion);
  saveQuestions(questions);
  return newQuestion;
}

export function updateQuestion(id, updates) {
  const questions = loadQuestions();
  const next = questions.map((q) => (q.id === id ? { ...q, ...updates } : q));
  saveQuestions(next);
}

export function deleteQuestion(id) {
  const questions = loadQuestions().filter((q) => q.id !== id);
  saveQuestions(questions);
  saveFavoriteIds(loadFavoriteIds().filter((favoriteId) => favoriteId !== id));
}

export function getCategories() {
  const questions = loadQuestions();
  // numeric: true so "2章" comes before "10章".
  return [...new Set(questions.map((q) => q.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ja", { numeric: true })
  );
}

// --- Favorites ---
// An array of question ids. A favorite's answer history comes from the attempts,
// so unfavoriting and favoriting again loses nothing.

export function loadFavoriteIds() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavoriteIds(ids) {
  writeItem(FAVORITES_KEY, JSON.stringify(ids));
}

// Returns the updated ids.
export function toggleFavorite(id) {
  const ids = loadFavoriteIds();
  const next = ids.includes(id) ? ids.filter((favoriteId) => favoriteId !== id) : [...ids, id];
  saveFavoriteIds(next);
  return next;
}

// --- Attempts / progress ---
// Attempt shape: { id, questionId, category, correct, userAnswer, answeredAt }

export function loadAttempts() {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAttempts(attempts) {
  writeItem(ATTEMPTS_KEY, JSON.stringify(attempts));
}

export function recordAttempt(attempt) {
  const attempts = loadAttempts();
  const newAttempt = {
    ...attempt,
    id: crypto.randomUUID(),
    answeredAt: new Date().toISOString(),
  };
  attempts.push(newAttempt);
  saveAttempts(attempts);
  return newAttempt;
}

export function clearAttempts() {
  saveAttempts([]);
}

// --- In-progress quiz session ---
// Saved after every change so a closed tab/app can resume where it left off.
// Shape: { sessionId, questionIds, currentIndex, correctCount, mistakeIds,
//          userAnswer, tableAnswers, submitted, lastResult }

export function loadQuizSession() {
  try {
    const raw = localStorage.getItem(QUIZ_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveQuizSession(session) {
  writeItem(QUIZ_SESSION_KEY, JSON.stringify(session));
}

export function clearQuizSession() {
  localStorage.removeItem(QUIZ_SESSION_KEY);
  if (isNative) Preferences.remove({ key: QUIZ_SESSION_KEY });
}

// --- Answer normalization / grading ---

export function normalizeAnswer(str) {
  return String(str ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function checkAnswer(userAnswer, acceptedAnswers) {
  const normalizedUser = normalizeAnswer(userAnswer);
  if (!normalizedUser) return false;
  return acceptedAnswers.some((a) => normalizeAnswer(a) === normalizedUser);
}

// Grades a multi-line answer against an ordered sequence of steps.
// Each line the user typed corresponds to one step, in order.
export function checkSteps(userText, steps) {
  const userLines = String(userText ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const stepResults = steps.map((step, index) => {
    const userLine = userLines[index] ?? "";
    const correct = userLine ? checkAnswer(userLine, step.answers) : false;
    return { index, userLine, correct, expected: step.answers };
  });

  const correct =
    userLines.length === steps.length && stepResults.every((r) => r.correct);

  return { correct, stepResults, userLines };
}

// Grades a fill-in-the-blank table. `userValues` maps "row-col" keys (for each
// blank cell) to the text the user typed.
export function checkTable(userValues, table) {
  const blanks = [];
  table.cells.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell.blank) blanks.push({ row: r, col: c, key: `${r}-${c}`, expected: cell.answer });
    });
  });

  const cellResults = blanks.map(({ row, col, key, expected }) => {
    const userValue = userValues?.[key] ?? "";
    const correct = userValue ? checkAnswer(userValue, [expected]) : false;
    return { row, col, key, userValue, correct, expected };
  });

  const correct = blanks.length > 0 && cellResults.every((r) => r.correct);

  return { correct, cellResults };
}

// The choices of answer column `col`: each distinct answer once, plus distractors.
export function matchingChoices(matching, col) {
  return [
    ...new Set([...matching.rows.map((r) => r.answers[col]), ...(matching.distractors[col] ?? [])].filter(Boolean)),
  ];
}

// Grades a matching question. `userValues` maps "row-col" keys (col = answer
// column index) to the choice the user picked.
export function checkMatching(userValues, matching) {
  const cellResults = [];
  matching.rows.forEach((row, r) => {
    row.answers.forEach((expected, c) => {
      const key = `${r}-${c}`;
      const userValue = userValues?.[key] ?? "";
      cellResults.push({ row: r, col: c, key, userValue, correct: userValue === expected, expected });
    });
  });
  const correct = cellResults.length > 0 && cellResults.every((r) => r.correct);
  return { correct, cellResults };
}
