import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const QUESTIONS_KEY = "ccna_questions";
const ATTEMPTS_KEY = "ccna_attempts";
export const NETLAB_KEY = "ccna_netlab";
const PERSISTED_KEYS = [QUESTIONS_KEY, ATTEMPTS_KEY, NETLAB_KEY];

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

export function emptyTableCell() {
  return { blank: false, text: "", answer: "" };
}

function normalizeQuestion(q) {
  const type = q.type === "table" ? "table" : "command";
  const importance = IMPORTANCE_LEVELS.includes(q.importance) ? q.importance : DEFAULT_IMPORTANCE;

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
}

export function getCategories() {
  const questions = loadQuestions();
  return [...new Set(questions.map((q) => q.category).filter(Boolean))].sort();
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
