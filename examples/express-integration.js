const express = require('express');
const EasyPayPal = require('../src/index');

const app = express();
app.use(express.json());

// Initialize PayPal
const paypal = new EasyPayPal({
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  mode: process.env.PAYPAL_MODE || 'sandbox'
});

// Store for demo purposes - use a database in production
const orders = new Map();

// Create payment endpoint
app.post('/api/create-payment', async (req, res) => {
  try {
    const { amount, currency = 'USD', description = 'Payment' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const order = await paypal.createSimplePayment(
      Math.round(amount * 100), // Convert to cents
      currency,
      description,
      `${req.protocol}://${req.get('host')}/api/payment/success`,
      `${req.protocol}://${req.get('host')}/api/payment/cancel`
    );

    // Store order for later reference
    orders.set(order.id, {
      id: order.id,
      amount,
      currency,
      description,
      status: 'created',
      createdAt: new Date()
    });

    // Return approval URL to frontend
    const approveLink = order.links.find(link => link.rel === 'approve');
    
    res.json({
      success: true,
      orderId: order.id,
      approveUrl: approveLink?.href
    });

  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment'
    });
  }
});

// Capture payment endpoint
app.post('/api/capture-payment/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orders.has(orderId)) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const result = await paypal.captureOrder(orderId);
    
    // Update order status
    const order = orders.get(orderId);
    order.status = 'completed';
    order.capturedAt = new Date();
    order.captureResult = result;

    res.json({
      success: true,
      orderId,
      captureId: result.purchase_units?.[0]?.payments?.captures?.[0]?.id,
      status: result.status
    });

  } catch (error) {
    console.error('Payment capture error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to capture payment'
    });
  }
});

// Get order status
app.get('/api/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const localOrder = orders.get(orderId);
    const paypalOrder = await paypal.getOrder(orderId);

    res.json({
      success: true,
      localOrder,
      paypalOrder
    });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get order details'
    });
  }
});

// Success page (user redirected here after approval)
app.get('/api/payment/success', async (req, res) => {
  const { token: orderId } = req.query;
  
  res.send(`
    <html>
      <body>
        <h2>Payment Approved!</h2>
        <p>Order ID: ${orderId}</p>
        <p>You can now complete the payment.</p>
        <button onclick="capturePayment('${orderId}')">Complete Payment</button>
        
        <div id="result"></div>
        
        <script>
          async function capturePayment(orderId) {
            try {
              const response = await fetch('/api/capture-payment/' + orderId, {
                method: 'POST'
              });
              const result = await response.json();
              
              if (result.success) {
                document.getElementById('result').innerHTML = 
                  '<h3 style="color: green;">Payment Completed Successfully!</h3>' +
                  '<p>Capture ID: ' + result.captureId + '</p>';
              } else {
                document.getElementById('result').innerHTML = 
                  '<h3 style="color: red;">Payment Failed</h3>';
              }
            } catch (error) {
              console.error(error);
              document.getElementById('result').innerHTML = 
                '<h3 style="color: red;">Error processing payment</h3>';
            }
          }
        </script>
      </body>
    </html>
  `);
});

// Cancel page
app.get('/api/payment/cancel', (req, res) => {
  res.send(`
    <html>
      <body>
        <h2>Payment Cancelled</h2>
        <p>Your payment was cancelled. You can try again if needed.</p>
        <a href="/">Go back to home</a>
      </body>
    </html>
  `);
});

// Webhook endpoint for PayPal notifications
app.post('/api/webhook/paypal', async (req, res) => {
  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    
    if (!webhookId) {
      console.warn('PayPal webhook ID not configured');
      return res.status(200).send('OK');
    }

    // Verify webhook signature
    const isValid = await paypal.verifyWebhook(req.headers, req.body, webhookId);
    
    if (!isValid) {
      console.error('Invalid webhook signature');
      return res.status(400).send('Invalid signature');
    }

    const { event_type, resource } = req.body;
    
    console.log('PayPal webhook received:', event_type);
    
    // Handle different webhook events
    switch (event_type) {
      case 'CHECKOUT.ORDER.APPROVED':
        console.log('Order approved:', resource.id);
        // Update your database here
        break;
        
      case 'PAYMENT.CAPTURE.COMPLETED':
        console.log('Payment captured:', resource.id);
        // Update your database here
        break;
        
      case 'PAYMENT.CAPTURE.DENIED':
        console.log('Payment denied:', resource.id);
        // Handle denied payment
        break;
        
      default:
        console.log('Unhandled webhook event:', event_type);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('Error');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PayPal integration server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
