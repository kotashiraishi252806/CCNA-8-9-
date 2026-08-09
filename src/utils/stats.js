export function computeCategoryStats(attempts, categories) {
  const byCategory = Object.fromEntries(
    categories.map((c) => [c, { total: 0, correct: 0 }])
  );
  for (const a of attempts) {
    if (!byCategory[a.category]) byCategory[a.category] = { total: 0, correct: 0 };
    byCategory[a.category].total += 1;
    if (a.correct) byCategory[a.category].correct += 1;
  }
  return Object.entries(byCategory).map(([category, { total, correct }]) => ({
    category,
    total,
    correct,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : null,
  }));
}

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
