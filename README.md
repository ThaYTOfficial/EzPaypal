# Easy PayPal API

A simple and intuitive Node.js wrapper for PayPal's REST API that makes integrating PayPal payments into your applications effortless.

## Features

- 🚀 **Easy to use** - Simple, intuitive API design
- 💳 **One-time payments** - Create and capture payments with minimal code
- 🔄 **Subscriptions** - Full subscription management (create, update, cancel)
- 🔐 **Secure** - Built-in authentication and token management
- 📦 **TypeScript support** - Full TypeScript definitions included
- 🪝 **Webhooks** - Easy webhook signature verification
- 💰 **Refunds** - Process refunds with ease
- 🌍 **Multi-currency** - Support for multiple currencies
- 🧪 **Sandbox & Live** - Works with both sandbox and production environments

## Installation

```bash
npm install easy-paypal-api
```

## Quick Start

### Environment Setup

Create a `.env` file in your project root:

```env
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox  # or 'live' for production
PAYPAL_WEBHOOK_ID=your_webhook_id_optional
```

### Basic Payment Example

```javascript
const EasyPayPal = require('easy-paypal-api');

// Initialize PayPal client
const paypal = new EasyPayPal({
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
  mode: 'sandbox' // or 'live'
});

// Create a simple payment
async function createPayment() {
  try {
    const order = await paypal.createSimplePayment(
      5000, // Amount in cents ($50.00)
      'USD',
      'Payment for premium service',
      'https://yoursite.com/success',
      'https://yoursite.com/cancel'
    );

    console.log('Payment created:', order.id);
    console.log('Approval URL:', order.links.find(link => link.rel === 'approve').href);
    
    return order;
  } catch (error) {
    console.error('Payment creation failed:', error.message);
  }
}

// Capture the payment after user approval
async function capturePayment(orderId) {
  try {
    const result = await paypal.captureOrder(orderId);
    console.log('Payment captured successfully:', result);
    return result;
  } catch (error) {
    console.error('Payment capture failed:', error.message);
  }
}
```

## API Reference

### Constructor

```javascript
const paypal = new EasyPayPal(options)
```

**Options:**
- `clientId` (string): Your PayPal client ID
- `clientSecret` (string): Your PayPal client secret
- `mode` (string): 'sandbox' or 'live' (default: 'sandbox')

### Payment Methods

#### `createOrder(orderData)`

Create a new payment order.

```javascript
const order = await paypal.createOrder({
  intent: 'CAPTURE',
  purchase_units: [{
    amount: {
      currency_code: 'USD',
      value: '100.00'
    },
    description: 'Digital product purchase'
  }],
  payment_source: {
    paypal: {
      experience_context: {
        return_url: 'https://yoursite.com/success',
        cancel_url: 'https://yoursite.com/cancel'
      }
    }
  }
});
```

#### `createSimplePayment(amount, currency, description, returnUrl, cancelUrl)`

Create a simple payment with minimal configuration.

```javascript
const order = await paypal.createSimplePayment(
  2500,    // $25.00 in cents
  'USD',
  'Product purchase',
  'https://yoursite.com/success',
  'https://yoursite.com/cancel'
);
```

#### `captureOrder(orderId)`

Capture an approved payment order.

```javascript
const result = await paypal.captureOrder('ORDER_ID');
```

#### `getOrder(orderId)`

Get order details.

```javascript
const order = await paypal.getOrder('ORDER_ID');
```

#### `refund(captureId, refundData)`

Process a refund.

```javascript
const refund = await paypal.refund('CAPTURE_ID', {
  amount: {
    value: '25.00',
    currency_code: 'USD'
  },
  note_to_payer: 'Refund for cancelled order'
});
```

### Subscription Methods

#### `createProduct(productData)`

Create a product for subscriptions.

```javascript
const product = await paypal.createProduct({
  name: 'Premium Subscription',
  description: 'Monthly premium features',
  type: 'SERVICE',
  category: 'SOFTWARE'
});
```

#### `createSubscriptionPlan(planData)`

Create a subscription billing plan.

```javascript
const plan = await paypal.createSubscriptionPlan({
  product_id: 'PROD_ID',
  name: 'Monthly Premium',
  description: 'Premium features billed monthly',
  billing_cycles: [{
    frequency: {
      interval_unit: 'MONTH',
      interval_count: 1
    },
    tenure_type: 'REGULAR',
    sequence: 1,
    total_cycles: 0, // Infinite
    pricing_scheme: {
      fixed_price: {
        value: '29.99',
        currency_code: 'USD'
      }
    }
  }],
  payment_preferences: {
    auto_bill_outstanding: true,
    payment_failure_threshold: 3
  }
});
```

#### `createSubscription(subscriptionData)`

Create a subscription.

```javascript
const subscription = await paypal.createSubscription({
  plan_id: 'PLAN_ID',
  subscriber: {
    name: {
      given_name: 'John',
      surname: 'Doe'
    },
    email_address: 'customer@example.com'
  },
  application_context: {
    brand_name: 'Your Company',
    return_url: 'https://yoursite.com/subscription/success',
    cancel_url: 'https://yoursite.com/subscription/cancel'
  }
});
```

#### `getSubscription(subscriptionId)`

Get subscription details.

```javascript
const subscription = await paypal.getSubscription('SUBSCRIPTION_ID');
```

#### `cancelSubscription(subscriptionId, reason)`

Cancel a subscription.

```javascript
await paypal.cancelSubscription('SUBSCRIPTION_ID', 'Customer requested cancellation');
```

### Webhook Methods

#### `verifyWebhook(headers, body, webhookId)`

Verify webhook signature for security.

```javascript
const isValid = await paypal.verifyWebhook(
  req.headers,
  req.body,
  'YOUR_WEBHOOK_ID'
);

if (isValid) {
  // Process webhook
  console.log('Webhook verified:', req.body.event_type);
}
```

### Utility Methods

#### `formatCurrency(amount, currency)`

Format amount for PayPal API.

```javascript
const formatted = paypal.formatCurrency(2500, 'USD'); // { currency_code: 'USD', value: '25.00' }
```

## Express.js Integration

Here's a complete Express.js example:

```javascript
const express = require('express');
const EasyPayPal = require('easy-paypal-api');

const app = express();
app.use(express.json());

const paypal = new EasyPayPal({
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  mode: process.env.PAYPAL_MODE || 'sandbox'
});

// Create payment
app.post('/api/create-payment', async (req, res) => {
  try {
    const { amount, currency = 'USD', description = 'Payment' } = req.body;
    
    const order = await paypal.createSimplePayment(
      Math.round(amount * 100), // Convert to cents
      currency,
      description,
      `${req.protocol}://${req.get('host')}/success`,
      `${req.protocol}://${req.get('host')}/cancel`
    );

    res.json({
      success: true,
      orderId: order.id,
      approveUrl: order.links.find(link => link.rel === 'approve')?.href
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Capture payment
app.post('/api/capture/:orderId', async (req, res) => {
  try {
    const result = await paypal.captureOrder(req.params.orderId);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook endpoint
app.post('/webhook/paypal', async (req, res) => {
  try {
    const isValid = await paypal.verifyWebhook(
      req.headers,
      req.body,
      process.env.PAYPAL_WEBHOOK_ID
    );
    
    if (isValid) {
      // Process webhook event
      console.log('Webhook event:', req.body.event_type);
      res.status(200).send('OK');
    } else {
      res.status(400).send('Invalid signature');
    }
  } catch (error) {
    res.status(500).send('Error');
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Error Handling

The library throws descriptive errors that you can catch and handle:

```javascript
try {
  const order = await paypal.createOrder(orderData);
} catch (error) {
  if (error.message.includes('INVALID_REQUEST')) {
    console.error('Invalid request data:', error.message);
  } else if (error.message.includes('AUTHENTICATION_FAILURE')) {
    console.error('PayPal authentication failed:', error.message);
  } else {
    console.error('PayPal API error:', error.message);
  }
}
```

## Webhook Events

Common webhook events you can handle:

- `CHECKOUT.ORDER.APPROVED` - Order approved by customer
- `PAYMENT.CAPTURE.COMPLETED` - Payment captured successfully
- `PAYMENT.CAPTURE.DENIED` - Payment capture failed
- `BILLING.SUBSCRIPTION.CREATED` - Subscription created
- `BILLING.SUBSCRIPTION.ACTIVATED` - Subscription activated
- `BILLING.SUBSCRIPTION.CANCELLED` - Subscription cancelled

## Testing

The library includes comprehensive test coverage. Run tests with:

```bash
npm test
```

For development:

```bash
npm run dev
```

## TypeScript Support

Full TypeScript support is included:

```typescript
import EasyPayPal from 'easy-paypal-api';

const paypal = new EasyPayPal({
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
  mode: 'sandbox'
});

const order: CreatedOrder = await paypal.createSimplePayment(
  2500,
  'USD',
  'Test payment'
);
```

## Configuration

### Environment Variables

- `PAYPAL_CLIENT_ID` - Your PayPal REST API client ID
- `PAYPAL_CLIENT_SECRET` - Your PayPal REST API client secret
- `PAYPAL_MODE` - 'sandbox' for testing, 'live' for production
- `PAYPAL_WEBHOOK_ID` - Your webhook ID for signature verification

### PayPal Developer Setup

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/)
2. Create a new application
3. Get your Client ID and Client Secret
4. Configure webhook endpoints if needed

## Examples

Check out the `examples/` directory for more comprehensive examples:

- `examples/basic-payment.js` - Simple payment flow
- `examples/express-integration.js` - Full Express.js server
- `examples/subscriptions.js` - Subscription management

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.

## Support

- [PayPal Developer Documentation](https://developer.paypal.com/docs/)
- [GitHub Issues](https://github.com/yourusername/easy-paypal-api/issues)

---

Made with ❤️ for the developer community
