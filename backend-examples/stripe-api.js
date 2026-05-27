// Example Stripe API endpoints for your Node.js backend
// Add this to your existing server (e.g., at http://192.168.1.74:3001)

const express = require('express');
const Stripe = require('stripe');

// Initialize Stripe with your secret key
const stripe = Stripe('sk_test_your_stripe_secret_key_here'); // Replace with your actual secret key

const router = express.Router();

// Create payment intent
router.post('/api/payments/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency, metadata } = req.body;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Payment intent creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create customer
router.post('/api/payments/create-customer', async (req, res) => {
  try {
    const { email, name } = req.body;

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        source: 'mrktfy_app',
      },
    });

    res.json({
      id: customer.id,
      email: customer.email,
      name: customer.name,
    });
  } catch (error) {
    console.error('Customer creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create ephemeral key (for mobile SDK)
router.post('/api/payments/create-ephemeral-key', async (req, res) => {
  try {
    const { customerId } = req.body;
    const stripeVersion = req.headers['stripe-version']; // Should be passed from client

    if (!stripeVersion) {
      return res.status(400).json({ error: 'Stripe version header required' });
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: stripeVersion }
    );

    res.json({
      ephemeralKey: ephemeralKey.secret,
    });
  } catch (error) {
    console.error('Ephemeral key creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Confirm subscription payment (webhook handler)
router.post('/api/payments/confirm-subscription', async (req, res) => {
  try {
    const { paymentIntentId, tier, billingInterval } = req.body;

    // Retrieve payment intent to confirm it's successful
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not successful' });
    }

    // Here you would:
    // 1. Update user's subscription in your database
    // 2. Set subscription end date based on billing interval
    // 3. Send confirmation email
    // 4. Log the transaction

    console.log(`Payment confirmed: ${paymentIntentId} for ${tier} (${billingInterval})`);

    res.json({
      success: true,
      subscriptionUpdated: true,
    });
  } catch (error) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe webhook handler (for real-time payment notifications)
router.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = 'whsec_your_webhook_secret_here'; // Replace with your webhook secret

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.log(`Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('PaymentIntent was successful!', paymentIntent.id);
      
      // Update subscription in database
      // Send confirmation email
      break;
    
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('Payment failed:', failedPayment.id);
      
      // Notify user of payment failure
      break;
    
    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      console.log('Invoice payment succeeded:', invoice.id);
      
      // Handle recurring payment success
      break;
    
    case 'invoice.payment_failed':
      const failedInvoice = event.data.object;
      console.log('Invoice payment failed:', failedInvoice.id);
      
      // Handle recurring payment failure
      break;
    
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.send({ received: true });
});

// Get payment methods for a customer
router.get('/api/payments/payment-methods/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    res.json({
      paymentMethods: paymentMethods.data,
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
