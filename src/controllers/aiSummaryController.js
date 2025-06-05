const axios = require('axios');

const getTop6ExpenseSummary = async (req, res) => {
  const { topSpends } = req.body;

  const prompt = `The user has spent the most this month in these categories:

${topSpends.map((s) => `- ${s.category}: ₹${s.totalAmount}`).join('\n')}

You are a smart, witty financial coach.

The user has spent most of their money this month on:
${topSpends.map((s) => `- ${s.category}: ₹${s.totalAmount}`).join('\n')}

Based on this, give ONE funny-but-actionable money-saving suggestion. Be direct. Use simple English. Don't repeat the categories or numbers.

Make it funny, in short user should feel like they are getting advice from a friend who is honest but cares.

`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a smart financial assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const summary = response.data.choices[0].message.content.trim();
    return res.json({ summary });
  } catch (error) {
    console.error(
      'Error generating summary:',
      error.response?.data || error.message
    );
    return res.status(500).json({ error: 'Failed to generate summary' });
  }
};
const parseTransactionsFromText = async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ message: 'Invalid input text.' });
  }

  // 🟡 Split lines for fallback regex-based parsing
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line);

  // 🟡 Regex fallback for numbers (amount) and dates
  const amountRegex = /([-+]?\d+(?:\.\d+)?)/;
  const dateRegex =
    /(\d{1,2}(st|nd|rd|th)?\s+\w+|\w+\s+\d{1,2}|20\d{2}-\d{2}-\d{2})/i;

  // 🟡 Pre-parse to ensure fallback minimum data
  const fallbackParsed = lines.map((line) => {
    const amountMatch = line.match(amountRegex);
    const dateMatch = line.match(dateRegex);

    const amount = amountMatch ? parseFloat(amountMatch[0]) : 0;

    let date;
    if (dateMatch) {
      const parsedDate = new Date(dateMatch[0]);
      if (!isNaN(parsedDate)) {
        date = parsedDate.toISOString().split('T')[0];
      } else {
        date = new Date().toISOString().split('T')[0];
      }
    } else {
      date = new Date().toISOString().split('T')[0];
    }

    const fallbackDesc = line
      .replace(amountMatch ? amountMatch[0] : '', '')
      .replace(dateMatch ? dateMatch[0] : '', '')
      .trim();

    return {
      description: fallbackDesc || 'Unknown',
      amount,
      date
    };
  });

  // 🟡 Compose enhanced prompt for GPT with fallback pre-parsed data
  const prompt = `
You are a smart financial assistant. The user entered messy transaction text. Here’s a pre-parsed fallback for each line:

${JSON.stringify(fallbackParsed, null, 2)}

✅ Your job:
- Review these fallback parsed entries.
- If they’re already good, confirm them.
- If you see a better amount, description, or date, adjust them.
- Fill in:
  - type: "income" or "expense"
  - categoryId: if possible
  - spendingType: "needs" | "wants" | "savings"

✅ Final output as a JSON array, like:
[
  {
    "description": "...",
    "amount": ...,
    "type": "...",
    "categoryId": "...",
    "spendingType": "...",
    "date": "YYYY-MM-DD"
  }
]

Here’s the user’s text:
${text}

Output:
`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a smart financial assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data.choices[0].message.content;
    const match = content.match(/\[.*\]/s);
    const parsed = match ? JSON.parse(match[0]) : [];

    // 🟡 Final fallback fill to ensure no missing fields
    const enhanced = parsed.map((txn, idx) => ({
      description:
        txn.description || fallbackParsed[idx].description || 'Unknown',
      amount: txn.amount ?? fallbackParsed[idx].amount ?? 0,
      type: txn.type || 'expense',
      categoryId: txn.categoryId || 'uncategorized',
      spendingType: txn.spendingType || 'needs',
      date:
        txn.date ||
        fallbackParsed[idx].date ||
        new Date().toISOString().split('T')[0]
    }));

    return res.status(200).json({ parsed: enhanced });
  } catch (error) {
    console.error(
      'Error parsing transactions:',
      error.response?.data || error.message
    );
    return res.status(500).json({ error: 'AI failed to parse text.' });
  }
};

module.exports = {
  getTop6ExpenseSummary,
  parseTransactionsFromText
};
