const Razorpay = require('razorpay');

module.exports = async (req, res) => {
  // Sirf POST requests allow karne ke liye
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, receipt } = req.body;

    // Check karna ki amount kam se kam 100 paise (1 Rupee) ho
    if (!amount || amount < 100) {
      return res.status(400).json({ error: 'Amount must be at least 100 paise' });
    }

    // Razorpay instance initialize karna environment variables se
    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // Razorpay ke server par order create karna
    const order = await instance.orders.create({
      amount: amount, // amount paise mein (Jaise 10 INR = 1000 paise)
      currency: 'INR',
      receipt: receipt || 'wallpaper_payout_rcpt'
    });

    // Success response frontend ko bhejna
    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    console.error('Razorpay Error:', error);
    return res.status(500).json({ error: 'Razorpay API failed to create order' });
  }
};