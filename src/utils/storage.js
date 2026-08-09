const QUESTIONS_KEY = "ccna_questions";
const ATTEMPTS_KEY = "ccna_attempts";

// --- Questions ---
// Question shape: { id, category, question, steps: { answers: string[] }[], explanation? }
// steps is an ordered sequence of commands; most questions have a single step.
// Older data may only have `answers: string[]` (a single command's alternates) —
// normalizeQuestion() upgrades those on read.

function normalizeQuestion(q) {
  if (Array.isArray(q.steps) && q.steps.length > 0) return q;
  const answers = Array.isArray(q.answers) ? q.answers : [];
  return { ...q, steps: [{ answers }] };
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
  localStorage.setItem(QUESTIONS_KEY, JSON.stringify(questions));
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
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
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
