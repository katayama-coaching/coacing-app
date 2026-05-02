const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'jpy',
          product_data: {
            name: 'AIコーチングアプリ',
          },
          unit_amount: 1980,
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      }],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: 7,
      },
      success_url: `https://coacing-app.vercel.app/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://coacing-app.vercel.app/`,
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
