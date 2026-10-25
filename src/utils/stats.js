export function computeOverallStats(attempts) {
  const total = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  return {
    total,
    correct,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : null,
  };
}

export function computeQuestionAccuracy(attempts) {
  const byQuestion = new Map();
  for (const a of attempts) {
    const entry = byQuestion.get(a.questionId) || { correct: 0, total: 0 };
    entry.total += 1;
    if (a.correct) entry.correct += 1;
    byQuestion.set(a.questionId, entry);
  }
  return byQuestion;
}

// Questions whose overall accuracy (across all attempts) is below thresholdPercent,
// ordered from lowest accuracy to highest.
export function computeLowAccuracyQuestionIds(attempts, thresholdPercent) {
  const accuracy = computeQuestionAccuracy(attempts);
  return [...accuracy.entries()]
    .filter(([, { correct, total }]) => (correct / total) * 100 < thresholdPercent)
    .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
    .map(([questionId]) => questionId);
}

export function computeWrongQuestionIds(attempts) {
  // Latest attempt per question (across all history) determines current mastery.
  const latestByQuestion = new Map();
  for (const a of attempts) {
    latestByQuestion.set(a.questionId, a);
  }
  return [...latestByQuestion.values()]
    .filter((a) => !a.correct)
    .sort((a, b) => new Date(b.answeredAt) - new Date(a.answeredAt))
    .map((a) => a.questionId);
}

// Same grouping key StatsPage uses: attempts recorded before session tracking
// was added have no sessionId, so each such attempt is its own session.
function sessionKeyOf(attempt) {
  return attempt.sessionId || attempt.id;
}

// Questions answered incorrectly within the single most recent quiz session
// (the session containing the latest-answered attempt), ignoring any earlier history.
export function computeLastSessionWrongQuestionIds(attempts) {
  if (attempts.length === 0) return [];
  const latestAttempt = attempts.reduce((latest, a) =>
    new Date(a.answeredAt) > new Date(latest.answeredAt) ? a : latest
  );
  const lastSessionKey = sessionKeyOf(latestAttempt);
  const sessionAttempts = attempts
    .filter((a) => sessionKeyOf(a) === lastSessionKey)
    .sort((a, b) => new Date(a.answeredAt) - new Date(b.answeredAt));

  const latestByQuestion = new Map();
  for (const a of sessionAttempts) {
    latestByQuestion.set(a.questionId, a);
  }
  return [...latestByQuestion.values()]
    .filter((a) => !a.correct)
    .map((a) => a.questionId);
}

// Per-question answer history, oldest to newest: Map<questionId, attempt[]>.
export function computeQuestionHistory(attempts) {
  const byQuestion = new Map();
  for (const a of attempts) {
    if (!byQuestion.has(a.questionId)) byQuestion.set(a.questionId, []);
    byQuestion.get(a.questionId).push(a);
  }
  for (const history of byQuestion.values()) {
    history.sort((a, b) => new Date(a.answeredAt) - new Date(b.answeredAt));
  }
  return byQuestion;
}

// --- Learning record (daily volume, per-session accuracy trend) ---

// One row per quiz session ("set" — a full category, wrong-only, or any other
// filtered run), oldest to newest.
export function computeSessionSummaries(attempts) {
  const bySession = new Map();
  for (const a of attempts) {
    const key = sessionKeyOf(a);
    if (!bySession.has(key)) bySession.set(key, []);
    bySession.get(key).push(a);
  }
  return [...bySession.values()]
    .map((group) => {
      const sorted = [...group].sort((a, b) => new Date(a.answeredAt) - new Date(b.answeredAt));
      const correct = sorted.filter((a) => a.correct).length;
      const total = sorted.length;
      return {
        key: sorted[0].id,
        start: sorted[0].answeredAt,
        end: sorted[sorted.length - 1].answeredAt,
        correct,
        total,
        accuracy: Math.round((correct / total) * 100),
      };
    })
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Local calendar dates from `days` ago through today, ascending, as "YYYY-MM-DD".
// Local (not UTC) so a late-night session lands on the day the user experienced it.
export function recentDateKeys(days) {
  const keys = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    keys.push(localDateKey(d));
  }
  return keys;
}

// Local calendar dates from `fromDateKey` ("YYYY-MM-DD") through today, ascending.
export function dateKeysSince(fromDateKey) {
  const [y, m, d] = fromDateKey.split("-").map(Number);
  const cur = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const keys = [];
  while (cur <= today) {
    keys.push(localDateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

// Number of questions solved per calendar day, oldest to newest.
export function computeDailyStudyCounts(attempts) {
  const byDate = new Map();
  for (const a of attempts) {
    const date = localDateKey(new Date(a.answeredAt));
    if (!byDate.has(date)) byDate.set(date, { date, count: 0 });
    byDate.get(date).count += 1;
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
