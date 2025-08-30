const cron = require('node-cron');
const Transaction = require('../model/transaction');

// 🕛 Run daily at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('⏰ Running recurring transaction cron job...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // ✅ Only process open-ended recurring transactions
    const recurringTransactions = await Transaction.find({
      recurring: true,
      nextOccurrence: { $lte: today },
      recurringEndDate: { $exists: false } // 🔐 Prevent picking pre-generated recurrences
    });

    if (!recurringTransactions.length) {
      console.log('📭 No recurring transactions to process today.');
      return;
    }

    let processedCount = 0;

    for (const txn of recurringTransactions) {
      // ✅ 1. Create a one-time transaction copy
      await Transaction.create({
        amount: txn.amount,
        date: txn.nextOccurrence,
        description: txn.description,
        type: txn.type,
        category: txn.category,
        user: txn.user,
        spendingType: txn.spendingType,
        recurring: false
      });

      // ✅ 2. Calculate nextOccurrence
      const next = new Date(txn.nextOccurrence);

      switch (txn.recurringFrequency) {
        case 'daily':
          next.setDate(next.getDate() + 1);
          break;
        case 'weekly':
          next.setDate(next.getDate() + 7);
          break;
        case 'monthly':
          next.setMonth(next.getMonth() + 1);
          break;
        case 'yearly':
          next.setFullYear(next.getFullYear() + 1);
          break;
        default:
          console.warn(
            `⚠️ Unknown frequency "${txn.recurringFrequency}" for transaction ${txn._id}`
          );
          continue; // Skip invalid frequency
      }

      // ✅ 3. Save updated nextOccurrence
      txn.nextOccurrence = next;
      await txn.save();

      processedCount++;
      console.log(
        `✅ Processed recurring txn ID: ${
          txn._id
        } | Next on: ${next.toDateString()}`
      );
    }

    console.log(
      `🎉 Cron job completed. ${processedCount} recurring transactions processed.`
    );
  } catch (err) {
    console.error('❌ Cron job failed:', err.message);
  }
});
