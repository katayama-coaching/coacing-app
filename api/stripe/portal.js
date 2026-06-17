const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const baseUrl = (process.env.BASE_URL || 'https://coacing-app.vercel.app').replace(/\/$/, '');
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/`,
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);
    res.status(500).json({ error: error.message });
  }
};