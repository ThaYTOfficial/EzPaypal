const EasyPayPal = require('../src/index');

// Initialize PayPal with debug mode
const paypal = new EasyPayPal({
  clientId: process.env.PAYPAL_CLIENT_ID || 'YOUR_CLIENT_ID',
  clientSecret: process.env.PAYPAL_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
  mode: process.env.PAYPAL_MODE || 'sandbox',
  debug: true // Enable debug logging
});

// ==================== COMPREHENSIVE PAYMENT WORKFLOW ====================

async function demonstrateCompletePaymentFlow() {
  console.log('=== COMPREHENSIVE PAYMENT WORKFLOW ===\n');
  
  try {
    // 1. Check API Health
    console.log('1. Checking PayPal API Health...');
    const health = await paypal.getApiStatus();
    console.log('API Status:', health);
    console.log();

    // 2. Validate amount before processing
    const amount = 2500; // $25.00 in cents
    const currency = 'USD';
    
    console.log('2. Validating payment amount...');
    const isValidAmount = paypal.validateAmount(amount, currency);
    if (!isValidAmount) {
      throw new Error('Invalid payment amount');
    }
    console.log(`Amount validation: $${amount/100} ${currency} - ✅ Valid`);
    console.log();

    // 3. Create simple payment
    console.log('3. Creating simple payment...');
    const order = await paypal.createSimplePayment(
      amount,
      currency,
      'Premium service subscription',
      'https://yourstore.com/success',
      'https://yourstore.com/cancel'
    );
    
    console.log('Order created:', {
      id: order.id,
      status: order.status,
      amount: order.purchase_units[0].amount
    });
    
    const approveLink = order.links.find(link => link.rel === 'approve');
    console.log('Approval URL:', approveLink?.href);
    console.log();

    // 4. Simulate getting order details
    console.log('4. Retrieving order details...');
    const orderDetails = await paypal.getOrder(order.id);
    console.log('Order Details:', {
      id: orderDetails.id,
      status: orderDetails.status,
      intent: orderDetails.intent
    });
    console.log();

    // Note: In a real scenario, user would approve payment here
    // For demo, we'll show what would happen after approval

    console.log('5. [SIMULATION] After user approval, capturing payment...');
    // const captureResult = await paypal.captureOrder(order.id);
    console.log('Payment would be captured here in real scenario');
    console.log();

    return order;

  } catch (error) {
    console.error('Payment workflow error:', {
      type: error.type || 'UNKNOWN',
      message: error.message,
      requestId: error.requestId
    });
    throw error;
  }
}

// ==================== SUBSCRIPTION MANAGEMENT ====================

async function demonstrateSubscriptionWorkflow() {
  console.log('=== SUBSCRIPTION MANAGEMENT WORKFLOW ===\n');
  
  try {
    // 1. Create product
    console.log('1. Creating subscription product...');
    const product = await paypal.createProduct({
      name: 'Premium SaaS Platform',
      description: 'Advanced features and priority support',
      type: 'SERVICE',
      category: 'SOFTWARE',
      image_url: 'https://example.com/product-image.jpg',
      home_url: 'https://example.com/premium'
    });
    
    console.log('Product created:', {
      id: product.id,
      name: product.name,
      status: product.status
    });
    console.log();

    // 2. Create subscription plan with trial
    console.log('2. Creating subscription plan with trial period...');
    const plan = await paypal.createSubscriptionPlan({
      product_id: product.id,
      name: 'Premium Monthly with 7-day Trial',
      description: 'Monthly billing with 7-day free trial',
      status: 'ACTIVE',
      billing_cycles: [
        // Trial period
        {
          frequency: { interval_unit: 'DAY', interval_count: 7 },
          tenure_type: 'TRIAL',
          sequence: 1,
          total_cycles: 1,
          pricing_scheme: { fixed_price: { value: '0.00', currency_code: 'USD' } }
        },
        // Regular billing
        {
          frequency: { interval_unit: 'MONTH', interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 2,
          total_cycles: 0, // Infinite
          pricing_scheme: { fixed_price: { value: '49.99', currency_code: 'USD' } }
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: { value: '0.00', currency_code: 'USD' },
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3
      }
    });
    
    console.log('Subscription plan created:', {
      id: plan.id,
      name: plan.name,
      status: plan.status
    });
    console.log();

    // 3. Create subscription
    console.log('3. Creating subscription for customer...');
    const subscription = await paypal.createSubscription({
      plan_id: plan.id,
      subscriber: {
        name: { given_name: 'John', surname: 'Developer' },
        email_address: 'john.developer@example.com'
      },
      application_context: {
        brand_name: 'Premium SaaS',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: {
          payer_selected: 'PAYPAL',
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
        },
        return_url: 'https://yourstore.com/subscription/success',
        cancel_url: 'https://yourstore.com/subscription/cancel'
      }
    });
    
    console.log('Subscription created:', {
      id: subscription.id,
      status: subscription.status,
      plan_id: subscription.plan_id
    });
    
    const subscribeLink = subscription.links.find(link => link.rel === 'approve');
    console.log('Subscribe URL:', subscribeLink?.href);
    console.log();

    // 4. Demonstrate plan management
    console.log('4. Demonstrating plan management...');
    
    // Update plan pricing
    console.log('   - Updating plan pricing...');
    // const priceUpdate = await paypal.updateSubscriptionPlanPricing(plan.id, {
    //   value: '59.99',
    //   currency_code: 'USD'
    // });
    console.log('   - Plan pricing update would be applied here');
    
    // Get subscription details
    const subDetails = await paypal.getSubscription(subscription.id);
    console.log('   - Subscription details retrieved:', {
      status: subDetails.status,
      plan_id: subDetails.plan_id
    });
    console.log();

    return { product, plan, subscription };

  } catch (error) {
    console.error('Subscription workflow error:', {
      type: error.type || 'UNKNOWN',
      message: error.message,
      details: error.details
    });
    throw error;
  }
}

// ==================== INVOICE MANAGEMENT ====================

async function demonstrateInvoiceWorkflow() {
  console.log('=== INVOICE MANAGEMENT WORKFLOW ===\n');
  
  try {
    // 1. Create invoice
    console.log('1. Creating professional invoice...');
    const invoiceNumber = paypal.generateReferenceId('INV');
    
    const invoice = await paypal.createInvoice({
      detail: {
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        currency_code: 'USD',
        note: 'Thank you for choosing our premium services.',
        term: 'Payment due within 30 days',
        memo: 'Professional services consultation',
        payment_term: { term_type: 'NET_30' }
      },
      invoicer: {
        name: { given_name: 'Your', surname: 'Business' },
        address: {
          address_line_1: '123 Business Street',
          address_line_2: 'Suite 100',
          admin_area_2: 'San Francisco',
          admin_area_1: 'CA',
          postal_code: '94102',
          country_code: 'US'
        },
        email_address: 'billing@yourbusiness.com'
      },
      primary_recipients: [{
        billing_info: {
          name: { given_name: 'Client', surname: 'Company' },
          address: {
            address_line_1: '456 Client Avenue',
            admin_area_2: 'Los Angeles',
            admin_area_1: 'CA',
            postal_code: '90210',
            country_code: 'US'
          },
          email_address: 'accounts@clientcompany.com'
        }
      }],
      items: [
        {
          name: 'Premium Consultation',
          description: 'Strategic business consultation - 10 hours',
          quantity: '10',
          unit_amount: { currency_code: 'USD', value: '150.00' }
        },
        {
          name: 'Implementation Support',
          description: 'Technical implementation support - 5 hours',
          quantity: '5',
          unit_amount: { currency_code: 'USD', value: '200.00' }
        }
      ],
      configuration: {
        partial_payment: { allow_partial_payment: true },
        allow_tip: false,
        tax_calculated_after_discount: true,
        tax_inclusive: false
      }
    });
    
    console.log('Invoice created:', {
      id: invoice.id,
      invoice_number: invoice.detail.invoice_number,
      status: invoice.status
    });
    console.log();

    // 2. Send invoice
    console.log('2. Sending invoice to client...');
    const sendResult = await paypal.sendInvoice(invoice.id, {
      send_to_recipient: true,
      send_to_invoicer: true // Send copy to self
    });
    
    console.log('Invoice sent successfully');
    console.log();

    // 3. List invoices
    console.log('3. Retrieving invoice list...');
    const invoiceList = await paypal.listInvoices({
      page_size: 5,
      total_required: true
    });
    
    console.log('Invoice list retrieved:', {
      total_items: invoiceList.total_items,
      total_pages: invoiceList.total_pages
    });
    console.log();

    return invoice;

  } catch (error) {
    console.error('Invoice workflow error:', {
      type: error.type || 'UNKNOWN',
      message: error.message
    });
    throw error;
  }
}

// ==================== WEBHOOK MANAGEMENT ====================

async function demonstrateWebhookManagement() {
  console.log('=== WEBHOOK MANAGEMENT ===\n');
  
  try {
    // 1. Create comprehensive webhook
    console.log('1. Creating comprehensive webhook...');
    const webhook = await paypal.createWebhook({
      url: 'https://yourapi.com/webhooks/paypal',
      event_types: [
        { name: 'CHECKOUT.ORDER.APPROVED' },
        { name: 'CHECKOUT.ORDER.COMPLETED' },
        { name: 'PAYMENT.CAPTURE.COMPLETED' },
        { name: 'PAYMENT.CAPTURE.DENIED' },
        { name: 'BILLING.SUBSCRIPTION.CREATED' },
        { name: 'BILLING.SUBSCRIPTION.ACTIVATED' },
        { name: 'BILLING.SUBSCRIPTION.CANCELLED' },
        { name: 'BILLING.SUBSCRIPTION.SUSPENDED' },
        { name: 'INVOICING.INVOICE.PAID' },
        { name: 'INVOICING.INVOICE.CANCELLED' }
      ]
    });
    
    console.log('Webhook created:', {
      id: webhook.id,
      url: webhook.url,
      events: webhook.event_types.length
    });
    console.log();

    // 2. List all webhooks
    console.log('2. Listing all webhooks...');
    const webhooks = await paypal.listWebhooks();
    
    console.log('Webhooks found:', webhooks.webhooks.length);
    webhooks.webhooks.forEach((wh, index) => {
      console.log(`   ${index + 1}. ${wh.url} (${wh.event_types.length} events)`);
    });
    console.log();

    return webhook;

  } catch (error) {
    console.error('Webhook management error:', {
      type: error.type || 'UNKNOWN',
      message: error.message
    });
    throw error;
  }
}

// ==================== UTILITY DEMONSTRATIONS ====================

function demonstrateUtilities() {
  console.log('=== UTILITY FUNCTIONS ===\n');

  // 1. Currency formatting
  console.log('1. Currency formatting examples:');
  console.log('   $25.00:', paypal.formatCurrency(2500, 'USD'));
  console.log('   €30.50:', paypal.formatCurrency(3050, 'EUR'));
  console.log('   £15.99:', paypal.formatCurrency(1599, 'GBP'));
  console.log();

  // 2. Amount validation
  console.log('2. Amount validation examples:');
  console.log('   $10.00 USD:', paypal.validateAmount(1000, 'USD') ? '✅ Valid' : '❌ Invalid');
  console.log('   $0.50 USD:', paypal.validateAmount(50, 'USD') ? '✅ Valid' : '❌ Invalid');
  console.log('   €5.00 EUR:', paypal.validateAmount(500, 'EUR') ? '✅ Valid' : '❌ Invalid');
  console.log();

  // 3. Reference ID generation
  console.log('3. Reference ID generation:');
  console.log('   Payment ID:', paypal.generateReferenceId('PAY'));
  console.log('   Order ID:', paypal.generateReferenceId('ORD'));
  console.log('   Invoice ID:', paypal.generateReferenceId('INV'));
  console.log();

  // 4. Supported currencies
  console.log('4. Supported currencies:');
  const currencies = paypal.getSupportedCurrencies();
  console.log(`   ${currencies.length} currencies supported:`, currencies.join(', '));
  console.log();

  // 5. Webhook event formatting
  console.log('5. Webhook event formatting example:');
  const sampleWebhook = {
    id: 'WH-123456789',
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource_type: 'capture',
    summary: 'Payment captured',
    resource: { id: 'CAPTURE-123', status: 'COMPLETED' },
    create_time: new Date().toISOString(),
    event_version: '1.0',
    resource_version: '2.0'
  };
  
  const formattedEvent = paypal.formatWebhookEvent(sampleWebhook);
  console.log('   Formatted webhook:', JSON.stringify(formattedEvent, null, 2));
  console.log();
}

// ==================== MAIN EXECUTION ====================

async function runComprehensiveDemo() {
  console.log('🚀 EASY PAYPAL API - COMPREHENSIVE REAL IMPLEMENTATION DEMO\n');
  console.log('This demo showcases all real PayPal API implementations.\n');
  
  try {
    // Run all workflows
    await demonstrateCompletePaymentFlow();
    await demonstrateSubscriptionWorkflow();
    await demonstrateInvoiceWorkflow();
    await demonstrateWebhookManagement();
    demonstrateUtilities();
    
    console.log('✅ ALL WORKFLOWS COMPLETED SUCCESSFULLY!');
    console.log('📖 Check the console output above for detailed results.');
    console.log('🔧 Remember to replace placeholder credentials with real ones for actual usage.');
    
  } catch (error) {
    console.error('❌ DEMO FAILED:', error.message);
    console.error('📋 Error Details:', {
      type: error.type,
      status: error.status,
      requestId: error.requestId
    });
  }
}

// ==================== ERROR HANDLING EXAMPLE ====================

async function demonstrateErrorHandling() {
  console.log('=== ERROR HANDLING EXAMPLES ===\n');
  
  try {
    // Intentionally create invalid payment
    console.log('1. Testing invalid payment amount...');
    await paypal.createSimplePayment(
      50, // Below minimum ($1.00)
      'USD',
      'Invalid amount test'
    );
  } catch (error) {
    console.log('   Caught error:', {
      type: error.type,
      message: error.message,
      status: error.status
    });
  }

  try {
    // Test invalid order ID
    console.log('2. Testing invalid order lookup...');
    await paypal.getOrder('INVALID_ORDER_ID');
  } catch (error) {
    console.log('   Caught error:', {
      type: error.type,
      message: error.message,
      status: error.status
    });
  }

  console.log('Error handling demonstration complete.\n');
}

// Export for testing
module.exports = {
  demonstrateCompletePaymentFlow,
  demonstrateSubscriptionWorkflow,
  demonstrateInvoiceWorkflow,
  demonstrateWebhookManagement,
  demonstrateUtilities,
  demonstrateErrorHandling,
  runComprehensiveDemo
};

// Run demo if called directly
if (require.main === module) {
  runComprehensiveDemo();
}
