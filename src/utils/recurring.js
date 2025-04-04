function calculateRecurringDetails(currentTx, allTxns) {
  if (!currentTx.recurring || !currentTx.recurringGroupId) return null;

  const today = new Date();
  const groupId =
    typeof currentTx.recurringGroupId === 'object'
      ? currentTx.recurringGroupId._id?.toString() ||
        currentTx.recurringGroupId.toString()
      : currentTx.recurringGroupId.toString();

  // Filter all transactions from same recurring group
  const groupTxns = allTxns.filter((tx) => {
    const txGroupId =
      typeof tx.recurringGroupId === 'object'
        ? tx.recurringGroupId._id?.toString() || tx.recurringGroupId.toString()
        : tx.recurringGroupId?.toString();
    return tx.recurring && txGroupId === groupId;
  });

  const totalOccurrences = groupTxns.length;

  // Check how many of them have date <= today
  const completedOccurrences = groupTxns.filter(
    (t) => new Date(t.date) <= today
  ).length;

  const remaining = totalOccurrences - completedOccurrences;

  return {
    totalOccurrences,
    completedOccurrences,
    remaining
  };
}

// helpers/recurringUtils.js
// utils/recurringUtils.js
function generateRecurringDates(startDateStr, endDateStr, frequency) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  const result = [];
  let current = new Date(start);

  const addFrequency = (date, freq) => {
    const d = new Date(date);
    switch (freq) {
      case 'daily':
        d.setDate(d.getDate() + 1);
        break;
      case 'weekly':
        d.setDate(d.getDate() + 7);
        break;
      case 'monthly':
        d.setMonth(d.getMonth() + 1);
        break;
      case 'yearly':
        d.setFullYear(d.getFullYear() + 1);
        break;
    }
    return d;
  };

  while (current <= end) {
    result.push(new Date(current));
    current = addFrequency(current, frequency);
  }

  return result;
}
function updateRecurringDetails(transactions) {
  const today = new Date();
  const groups = {};

  // Group transactions by recurringGroupId
  transactions.forEach((tx) => {
    const groupId =
      tx.recurringGroupId?._id?.toString() || tx.recurringGroupId?.toString();
    if (!groups[groupId]) {
      groups[groupId] = [];
    }
    groups[groupId].push(tx);
  });

  // Sort each group by date ascending
  Object.values(groups).forEach((group) =>
    group.sort((a, b) => new Date(a.date) - new Date(b.date))
  );

  // Assign recurringDetails individually
  transactions.forEach((tx) => {
    const groupId =
      tx.recurringGroupId?._id?.toString() || tx.recurringGroupId?.toString();
    const groupTxns = groups[groupId];

    const totalOccurrences = groupTxns.length;

    // Find index of the current tx within the group (sorted)
    const index = groupTxns.findIndex(
      (t) => t._id.toString() === tx._id.toString()
    );
    const completedOccurrences = index + 1;
    const remaining = totalOccurrences - completedOccurrences;

    tx.recurringDetails = {
      totalOccurrences,
      completedOccurrences,
      remaining
    };
  });

  return transactions;
}

module.exports = {
  calculateRecurringDetails,
  generateRecurringDates,
  updateRecurringDetails
};
