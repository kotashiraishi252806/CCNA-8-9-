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
