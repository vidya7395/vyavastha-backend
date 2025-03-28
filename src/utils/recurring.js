const calculateRecurringDetails = (tx, allTxns) => {
  if (
    !tx.recurring ||
    !tx.recurringStartDate ||
    !tx.recurringEndDate ||
    !tx.recurringFrequency
  ) {
    return null;
  }

  const freq = tx.recurringFrequency;
  const start = new Date(tx.recurringStartDate);
  const end = new Date(tx.recurringEndDate);

  // Build list of expected occurrences
  const expectedDates = [];
  let current = new Date(start);

  while (current <= end) {
    expectedDates.push(current.toISOString().split('T')[0]);

    switch (freq) {
      case 'daily':
        current.setDate(current.getDate() + 1);
        break;
      case 'weekly':
        current.setDate(current.getDate() + 7);
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + 1);
        break;
      case 'yearly':
        current.setFullYear(current.getFullYear() + 1);
        break;
      default:
        break;
    }
  }

  // Filter user's all transactions to get matching ones for this recurring group
  const recurringTxs = allTxns.filter(
    (t) =>
      t.recurring &&
      t.recurringFrequency === tx.recurringFrequency &&
      new Date(t.recurringStartDate).toISOString() ===
        new Date(tx.recurringStartDate).toISOString() &&
      new Date(t.recurringEndDate).toISOString() ===
        new Date(tx.recurringEndDate).toISOString() &&
      t.amount === tx.amount &&
      t.description === tx.description &&
      t.category.toString() === tx.category.toString()
  );

  const completedDates = recurringTxs.map(
    (t) => new Date(t.date).toISOString().split('T')[0]
  );

  const completedOccurrences = expectedDates.filter((date) =>
    completedDates.includes(date)
  ).length;

  return {
    totalOccurrences: expectedDates.length,
    completedOccurrences,
    remaining: expectedDates.length - completedOccurrences
  };
};

module.exports = { calculateRecurringDetails };
