const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const EasyPayPal = require('../src/index');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== SECURITY MIDDLEWARE ====================

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ==================== PAYPAL INITIALIZATION ====================

const paypal = new EasyPayPal({
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  mode: process.env.PAYPAL_MODE || 'sandbox',
  debug: process.env.NODE_ENV === 'development'
});

// ==================== DATABASE SIMULATION ====================
// In production, use a real database like PostgreSQL, MongoDB, etc.

const orders = new Map();
const subscriptions = new Map();
const invoices = new Map();
const customers = new Map();

// ==================== UTILITY FUNCTIONS ====================

const generateCustomerId = () => `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const logActivity = (action, data, userId = 'system') => {
  console.log(`[${new Date().toISOString()}] ${action}:`, {
    user: userId,
    data: typeof data === 'object' ? JSON.stringify(data, null, 2) : data
  });
};

const handleError = (res, error, context = 'operation') => {
  logActivity(`ERROR in ${context}`, {
    type: error.type,
    message: error.message,
    status: error.status,
    requestId: error.requestId
  });

  res.status(error.status || 500).json({
    success: false,
    error: {
      type: error.type || 'UNKNOWN_ERROR',
      message: error.message,
      timestamp: new Date().toISOString(),
      requestId: error.requestId
    }
  });
};

// ==================== HEALTH & STATUS ENDPOINTS ====================

app.get('/health', async (req, res) => {
  try {
    const paypalHealth = await paypal.getApiStatus();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'running',
        paypal: paypalHealth.status,
        database: 'simulated',
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

app.get('/api/status', async (req, res) => {
  try {
    const health = await paypal.getApiStatus();
    const currencies = paypal.getSupportedCurrencies();
    
    res.json({
      success: true,
      data: {
        paypal: health,
        currencies: currencies.slice(0, 10), // Show first 10
        totalCurrencies: currencies.length,
        statistics: {
          totalOrders: orders.size,
          totalSubscriptions: subscriptions.size,
          totalInvoices: invoices.size,
          totalCustomers: customers.size
        }
      }
    });
  } catch (error) {
    handleError(res, error, 'status check');
  }
});

// ==================== PAYMENT ENDPOINTS ====================

// Create payment order
app.post('/api/payments/create', async (req, res) => {
  try {
    const { amount, currency = 'USD', description = 'Payment', customerId } = req.body;

    // Validation
    if (!amount || !paypal.validateAmount(amount, currency)) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Invalid payment amount'
        }
      });
    }

    // Create customer if doesn't exist
    let customer = customerId ? customers.get(customerId) : null;
    if (!customer) {
      const newCustomerId = generateCustomerId();
      customer = {
        id: newCustomerId,
        createdAt: new Date().toISOString(),
        orders: []
      };
      customers.set(newCustomerId, customer);
      customerId = newCustomerId;
    }

    // Create PayPal order
    const order = await paypal.createSimplePayment(
      amount,
      currency,
      description,
      `${req.protocol}://${req.get('host')}/api/payments/success`,
      `${req.protocol}://${req.get('host')}/api/payments/cancel`
    );

    // Store order
    const orderData = {
      id: order.id,
      customerId,
      amount,
      currency,
      description,
      status: 'created',
      paypalOrder: order,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    orders.set(order.id, orderData);
    customer.orders.push(order.id);

    logActivity('PAYMENT_CREATED', { orderId: order.id, amount, currency }, customerId);

    res.json({
      success: true,
      data: {
        orderId: order.id,
        customerId,
        amount: paypal.formatCurrency(amount, currency),
        approveUrl: order.links.find(link => link.rel === 'approve')?.href,
        status: order.status
      }
    });

  } catch (error) {
    handleError(res, error, 'payment creation');
  }
});

// Capture payment
app.post('/api/payments/:orderId/capture', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const orderData = orders.get(orderId);
    if (!orderData) {
      return res.status(404).json({
        success: false,
        error: { type: 'NOT_FOUND', message: 'Order not found' }
      });
    }

    const result = await paypal.captureOrder(orderId);
    
    // Update order status
    orderData.status = 'completed';
    orderData.capturedAt = new Date().toISOString();
    orderData.captureResult = result;
    orderData.updatedAt = new Date().toISOString();

    logActivity('PAYMENT_CAPTURED', { orderId, captureId: result.id }, orderData.customerId);

    res.json({
      success: true,
      data: {
        orderId,
        captureId: result.purchase_units?.[0]?.payments?.captures?.[0]?.id,
        status: result.status,
        amount: result.purchase_units?.[0]?.payments?.captures?.[0]?.amount
      }
    });

  } catch (error) {
    handleError(res, error, 'payment capture');
  }
});

// Process refund
app.post('/api/payments/:captureId/refund', async (req, res) => {
  try {
    const { captureId } = req.params;
    const { amount, note = 'Refund processed' } = req.body;

    const refundData = {
      note_to_payer: note
    };

    if (amount) {
      refundData.amount = paypal.formatCurrency(amount, 'USD'); // Default USD, should be dynamic
    }

    const result = await paypal.refund(captureId, refundData);

    logActivity('REFUND_PROCESSED', { captureId, refundId: result.id });

    res.json({
      success: true,
      data: {
        refundId: result.id,
        status: result.status,
        amount: result.amount
      }
    });

  } catch (error) {
    handleError(res, error, 'refund processing');
  }
});

// ==================== SUBSCRIPTION ENDPOINTS ====================

// Create subscription plan
app.post('/api/subscriptions/plans', async (req, res) => {
  try {
    const { productName, planName, price, interval = 'MONTH', trialDays = 0 } = req.body;

    // Create product first
    const product = await paypal.createProduct({
      name: productName,
      description: `Product for ${planName}`,
      type: 'SERVICE',
      category: 'SOFTWARE'
    });

    // Create billing cycles
    const billing_cycles = [];

    // Add trial if specified
    if (trialDays > 0) {
      billing_cycles.push({
        frequency: { interval_unit: 'DAY', interval_count: trialDays },
        tenure_type: 'TRIAL',
        sequence: 1,
        total_cycles: 1,
        pricing_scheme: { fixed_price: { value: '0.00', currency_code: 'USD' } }
      });
    }

    // Add regular billing
    billing_cycles.push({
      frequency: { interval_unit: interval, interval_count: 1 },
      tenure_type: 'REGULAR',
      sequence: trialDays > 0 ? 2 : 1,
      total_cycles: 0, // Infinite
      pricing_scheme: { fixed_price: paypal.formatCurrency(price, 'USD') }
    });

    const plan = await paypal.createSubscriptionPlan({
      product_id: product.id,
      name: planName,
      description: `${planName} subscription plan`,
      billing_cycles,
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 3
      }
    });

    logActivity('SUBSCRIPTION_PLAN_CREATED', { planId: plan.id, productId: product.id });

    res.json({
      success: true,
      data: {
        planId: plan.id,
        productId: product.id,
        name: plan.name,
        status: plan.status,
        billing_cycles: plan.billing_cycles.length
      }
    });

  } catch (error) {
    handleError(res, error, 'subscription plan creation');
  }
});

// Create subscription
app.post('/api/subscriptions/create', async (req, res) => {
  try {
    const { planId, customerEmail, customerName } = req.body;

    const subscription = await paypal.createSubscription({
      plan_id: planId,
      subscriber: {
        name: {
          given_name: customerName?.split(' ')[0] || 'Customer',
          surname: customerName?.split(' ')[1] || 'Name'
        },
        email_address: customerEmail
      },
      application_context: {
        brand_name: 'Your SaaS Platform',
        return_url: `${req.protocol}://${req.get('host')}/api/subscriptions/success`,
        cancel_url: `${req.protocol}://${req.get('host')}/api/subscriptions/cancel`
      }
    });

    // Store subscription
    subscriptions.set(subscription.id, {
      id: subscription.id,
      planId,
      customerEmail,
      customerName,
      status: subscription.status,
      createdAt: new Date().toISOString()
    });

    logActivity('SUBSCRIPTION_CREATED', { subscriptionId: subscription.id, planId });

    res.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        status: subscription.status,
        approveUrl: subscription.links.find(link => link.rel === 'approve')?.href
      }
    });

  } catch (error) {
    handleError(res, error, 'subscription creation');
  }
});

// Cancel subscription
app.post('/api/subscriptions/:subscriptionId/cancel', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { reason = 'Customer requested cancellation' } = req.body;

    await paypal.cancelSubscription(subscriptionId, reason);

    // Update local record
    const subscription = subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date().toISOString();
    }

    logActivity('SUBSCRIPTION_CANCELLED', { subscriptionId, reason });

    res.json({
      success: true,
      data: { subscriptionId, status: 'cancelled' }
    });

  } catch (error) {
    handleError(res, error, 'subscription cancellation');
  }
});

// ==================== INVOICE ENDPOINTS ====================

// Create and send invoice
app.post('/api/invoices/create', async (req, res) => {
  try {
    const { customerEmail, items, dueDate = 30 } = req.body;

    const invoice = await paypal.createInvoice({
      detail: {
        invoice_number: paypal.generateReferenceId('INV'),
        invoice_date: new Date().toISOString().split('T')[0],
        payment_term: { term_type: `NET_${dueDate}` }
      },
      primary_recipients: [{
        billing_info: {
          email_address: customerEmail
        }
      }],
      items: items.map(item => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity.toString(),
        unit_amount: paypal.formatCurrency(item.unitPrice, 'USD')
      }))
    });

    // Send invoice automatically
    await paypal.sendInvoice(invoice.id);

    // Store invoice
    invoices.set(invoice.id, {
      id: invoice.id,
      customerEmail,
      items,
      status: 'sent',
      createdAt: new Date().toISOString()
    });

    logActivity('INVOICE_CREATED_AND_SENT', { invoiceId: invoice.id, customerEmail });

    res.json({
      success: true,
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.detail.invoice_number,
        status: 'sent',
        viewUrl: invoice.links?.find(link => link.rel === 'self')?.href
      }
    });

  } catch (error) {
    handleError(res, error, 'invoice creation');
  }
});

// ==================== WEBHOOK ENDPOINTS ====================

// PayPal webhook handler
app.post('/api/webhooks/paypal', async (req, res) => {
  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    
    if (!webhookId) {
      console.warn('PayPal webhook ID not configured');
      return res.status(200).send('OK');
    }

    // Verify webhook signature
    const isValid = await paypal.verifyWebhook(req.headers, req.body, webhookId);
    
    if (!isValid) {
      logActivity('WEBHOOK_VERIFICATION_FAILED', { headers: req.headers });
      return res.status(400).send('Invalid signature');
    }

    const event = paypal.formatWebhookEvent(req.body);
    logActivity('WEBHOOK_RECEIVED', event);

    // Handle different events
    switch (event.eventType) {
      case 'CHECKOUT.ORDER.APPROVED':
        // Update order status
        const order = orders.get(event.resource.id);
        if (order) {
          order.status = 'approved';
          order.updatedAt = new Date().toISOString();
        }
        break;

      case 'PAYMENT.CAPTURE.COMPLETED':
        // Payment captured successfully
        logActivity('PAYMENT_COMPLETED_VIA_WEBHOOK', { captureId: event.resource.id });
        break;

      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        // Subscription activated
        const subscription = subscriptions.get(event.resource.id);
        if (subscription) {
          subscription.status = 'active';
          subscription.activatedAt = new Date().toISOString();
        }
        break;

      case 'INVOICING.INVOICE.PAID':
        // Invoice paid
        const invoice = invoices.get(event.resource.id);
        if (invoice) {
          invoice.status = 'paid';
          invoice.paidAt = new Date().toISOString();
        }
        break;

      default:
        logActivity('UNHANDLED_WEBHOOK', { eventType: event.eventType });
    }

    res.status(200).send('OK');
  } catch (error) {
    logActivity('WEBHOOK_PROCESSING_ERROR', error.message);
    res.status(500).send('Error');
  }
});

// ==================== ADMIN ENDPOINTS ====================

// Get dashboard statistics
app.get('/api/admin/stats', (req, res) => {
  try {
    const totalRevenue = Array.from(orders.values())
      .filter(order => order.status === 'completed')
      .reduce((sum, order) => sum + order.amount, 0);

    const activeSubscriptions = Array.from(subscriptions.values())
      .filter(sub => sub.status === 'active').length;

    const pendingInvoices = Array.from(invoices.values())
      .filter(inv => inv.status === 'sent').length;

    res.json({
      success: true,
      data: {
        totalOrders: orders.size,
        completedOrders: Array.from(orders.values()).filter(o => o.status === 'completed').length,
        totalRevenue: totalRevenue / 100, // Convert back to dollars
        totalSubscriptions: subscriptions.size,
        activeSubscriptions,
        totalInvoices: invoices.size,
        pendingInvoices,
        totalCustomers: customers.size
      }
    });
  } catch (error) {
    handleError(res, error, 'admin statistics');
  }
});

// List recent orders
app.get('/api/admin/orders', (req, res) => {
  try {
    const recentOrders = Array.from(orders.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20)
      .map(order => ({
        id: order.id,
        customerId: order.customerId,
        amount: order.amount / 100,
        currency: order.currency,
        status: order.status,
        createdAt: order.createdAt
      }));

    res.json({
      success: true,
      data: recentOrders
    });
  } catch (error) {
    handleError(res, error, 'order listing');
  }
});

// ==================== SUCCESS/CANCEL PAGES ====================

app.get('/api/payments/success', (req, res) => {
  const { token: orderId } = req.query;
  
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Payment Approved</title></head>
      <body>
        <h2>✅ Payment Approved!</h2>
        <p>Order ID: ${orderId}</p>
        <button onclick="capturePayment('${orderId}')">Complete Payment</button>
        <div id="result"></div>
        <script>
          async function capturePayment(orderId) {
            try {
              const response = await fetch('/api/payments/' + orderId + '/capture', {
                method: 'POST'
              });
              const result = await response.json();
              
              if (result.success) {
                document.getElementById('result').innerHTML = 
                  '<h3 style="color: green;">✅ Payment Completed!</h3>' +
                  '<p>Capture ID: ' + result.data.captureId + '</p>';
              } else {
                document.getElementById('result').innerHTML = 
                  '<h3 style="color: red;">❌ Payment Failed</h3>';
              }
            } catch (error) {
              document.getElementById('result').innerHTML = 
                '<h3 style="color: red;">❌ Error processing payment</h3>';
            }
          }
        </script>
      </body>
    </html>
  `);
});

app.get('/api/payments/cancel', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Payment Cancelled</title></head>
      <body>
        <h2>❌ Payment Cancelled</h2>
        <p>Your payment was cancelled.</p>
        <a href="/">Return to Home</a>
      </body>
    </html>
  `);
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      type: 'NOT_FOUND',
      message: 'Endpoint not found',
      path: req.path
    }
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logActivity('GLOBAL_ERROR', { error: error.message, stack: error.stack });
  
  res.status(500).json({
    success: false,
    error: {
      type: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    }
  });
});

// ==================== SERVER STARTUP ====================

app.listen(PORT, () => {
  console.log(`🚀 PayPal API Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 API status: http://localhost:${PORT}/api/status`);
  console.log(`📈 Admin stats: http://localhost:${PORT}/api/admin/stats`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💳 PayPal mode: ${process.env.PAYPAL_MODE || 'sandbox'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
