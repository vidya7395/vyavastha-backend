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

module.exports = {
  getTop6ExpenseSummary
};
