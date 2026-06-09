const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Agar koi field missing hai toh error dena
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing required payment fields' });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  
  // HMAC-SHA256 se khud ka signature generate karna security ke liye
  const generated_signature = crypto
    .createHmac('sha256', secret)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest('hex');

  // Dono signature match karke verify karna
  if (generated_signature === razorpay_signature) {
    return res.status(200).json({ status: 'success', message: 'Payment verified successfully' });
  } else {
    return res.status(400).json({ status: 'failure', message: 'Signature mismatch. Invalid payment!' });
  }
};