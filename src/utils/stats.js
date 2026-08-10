export function computeOverallStats(attempts) {
  const total = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  return {
    total,
    correct,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : null,
  };
}

export function computeWrongQuestionIds(attempts) {
  // Latest attempt per question determines current mastery.
  const latestByQuestion = new Map();
  for (const a of attempts) {
    latestByQuestion.set(a.questionId, a);
  }
  return [...latestByQuestion.values()]
    .filter((a) => !a.correct)
    .map((a) => a.questionId);
}
