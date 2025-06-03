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

  const prompt = `
You are a helpful financial assistant.Correct grammar and spelling mistakes in the user input text, then parse the transactions into structured JSON objects.

Parse the following user-entered transactions into structured JSON objects. Each object should include:
- description (string) => if you can provide description from single line thAT WOULD BE MUCH GOOD, LIKE GENERIC NOT TOO LENGHTY
- amount (number)
- type ("income" or "expense")
- categoryId (e.g. "shopping", "salary", "recharge")
- spendingType ("needs", "wants", or "savings") — follow the 50/30/20 rule.
- date (YYYY-MM-DD format, if available)

Input:
${text}

Output a JSON array like:
[
  {
    "description": "clothes",
    "amount": 120,
    "type": "expense",
    "categoryId": "shopping",
    "spendingType": "wants",
    "date": "2023-10-01"
  }
]
`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
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

    return res.status(200).json({ parsed });
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
