# 🎨 PayPal API Customization Guide

The `easy-paypal-api` package is fully customizable! No more hardcoded `example.com` URLs or generic brand names. Everything can be configured to match your business.

## 🚀 Quick Start

### Method 1: Environment Variables (Recommended)

Create a `.env` file:

```env
# Basic setup
PAYPAL_CLIENT_ID=your_actual_client_id
PAYPAL_CLIENT_SECRET=your_actual_client_secret
PAYPAL_MODE=sandbox

# Your branding
PAYPAL_BRAND_NAME=My Awesome Store
PAYPAL_BASE_URL=https://mystore.com
PAYPAL_SUPPORT_EMAIL=support@mystore.com
```

Then use without any hardcoded values:

```javascript
const EasyPayPal = require('easy-paypal-api');

// Everything automatically configured from environment!
const paypal = new EasyPayPal();

// Creates payment with YOUR brand name and URLs
const order = await paypal.createSimplePayment(2500, 'USD', 'Premium service');
```

### Method 2: Direct Configuration

```javascript
const paypal = new EasyPayPal({
  // Credentials
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
  mode: 'sandbox',

  // Your branding (no more "Your Store"!)
  brandName: 'TechCorp Solutions',
  businessName: 'TechCorp LLC',
  supportEmail: 'billing@techcorp.com',

  // Your URLs (no more example.com!)
  baseUrl: 'https://techcorp.com',
  returnUrl: 'https://techcorp.com/payment/success',
  cancelUrl: 'https://techcorp.com/payment/cancel',

  // Defaults
  defaultCurrency: 'USD',
  defaultLocale: 'en-US'
});
```

## 📋 All Customization Options

| Option | Environment Variable | Description | Default |
|--------|---------------------|-------------|---------|
| **Credentials** | | | |
| `clientId` | `PAYPAL_CLIENT_ID` | PayPal Client ID | Required |
| `clientSecret` | `PAYPAL_CLIENT_SECRET` | PayPal Client Secret | Required |
| `mode` | `PAYPAL_MODE` | 'sandbox' or 'live' | `'sandbox'` |
| **Branding** | | | |
| `brandName` | `PAYPAL_BRAND_NAME` | Shows in PayPal checkout | `'Your Store'` |
| `businessName` | `PAYPAL_BUSINESS_NAME` | For invoices/formal docs | `'Your Business'` |
| `supportEmail` | `PAYPAL_SUPPORT_EMAIL` | Customer support email | `'support@yourstore.com'` |
| **URLs** | | | |
| `baseUrl` | `PAYPAL_BASE_URL` | Your website URL | `'https://yourstore.com'` |
| `returnUrl` | `PAYPAL_RETURN_URL` | Success redirect | `{baseUrl}/payment/success` |
| `cancelUrl` | `PAYPAL_CANCEL_URL` | Cancel redirect | `{baseUrl}/payment/cancel` |
| **Defaults** | | | |
| `defaultCurrency` | `PAYPAL_DEFAULT_CURRENCY` | Default currency | `'USD'` |
| `defaultLocale` | `PAYPAL_DEFAULT_LOCALE` | PayPal interface language | `'en-US'` |
| `defaultCountry` | `PAYPAL_DEFAULT_COUNTRY` | Default country | `'US'` |
| **Experience** | | | |
| `landingPage` | - | 'LOGIN' or 'BILLING' | `'LOGIN'` |
| `userAction` | - | 'PAY_NOW' or 'CONTINUE' | `'PAY_NOW'` |
| `shippingPreference` | - | Shipping options | `'NO_SHIPPING'` |
| **Advanced** | | | |
| `timeout` | `PAYPAL_TIMEOUT` | Request timeout (ms) | `30000` |
| `retryAttempts` | `PAYPAL_RETRY_ATTEMPTS` | Retry failed requests | `3` |
| `debug` | `PAYPAL_DEBUG` | Enable debug logging | `false` |
| `maxRequestsPerMinute` | - | Rate limit | `1000` |
| `webhookId` | `PAYPAL_WEBHOOK_ID` | Webhook verification | `null` |

## 🏢 Business Address (For Invoices)

```javascript
const paypal = new EasyPayPal({
  // ... other options
  address: {
    line1: '123 Business Street',
    line2: 'Suite 500',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94105',
    country: 'US'
  }
});
```

Or via environment:

```env
PAYPAL_ADDRESS_LINE1=123 Business Street
PAYPAL_ADDRESS_LINE2=Suite 500
PAYPAL_ADDRESS_CITY=San Francisco
PAYPAL_ADDRESS_STATE=CA
PAYPAL_ADDRESS_POSTAL=94105
PAYPAL_ADDRESS_COUNTRY=US
```

## 📝 Custom Templates

Customize messages and descriptions with template variables:

```javascript
const paypal = new EasyPayPal({
  templates: {
    paymentDescription: 'Purchase from {{businessName}} - {{amount}} {{currency}}',
    invoiceNote: 'Thank you for choosing {{businessName}}!',
    refundNote: 'Refund processed by {{businessName}} support.'
  }
});

// Use templates
const description = paypal.processTemplate(
  paypal.config.templates.paymentDescription,
  { businessName: 'TechCorp', amount: '$25.00', currency: 'USD' }
);
// Result: "Purchase from TechCorp - $25.00 USD"
```

## 🌍 Multi-Environment Setup

Perfect for dev/staging/production:

```javascript
const { PayPalEnvironmentManager } = require('./examples/full-customization');

const paypalManager = new PayPalEnvironmentManager()
  .configure('development', {
    clientId: process.env.PAYPAL_DEV_CLIENT_ID,
    clientSecret: process.env.PAYPAL_DEV_CLIENT_SECRET,
    mode: 'sandbox',
    brandName: 'Dev Store',
    baseUrl: 'http://localhost:3000',
    debug: true
  })
  .configure('production', {
    clientId: process.env.PAYPAL_PROD_CLIENT_ID,
    clientSecret: process.env.PAYPAL_PROD_CLIENT_SECRET,
    mode: 'live',
    brandName: 'My Awesome Store',
    baseUrl: 'https://mystore.com'
  });

// Use environment-specific instance
const paypal = paypalManager.get('production');
```

## 🎯 Dynamic URL Generation

Generate URLs dynamically based on context:

```javascript
// Default URLs based on configuration
const urls = paypal.getReturnUrls('checkout');
// Returns: 
// {
//   return_url: 'https://mystore.com/checkout/success',
//   cancel_url: 'https://mystore.com/checkout/cancel'
// }

// Override for specific use case
const customUrls = paypal.getReturnUrls('subscription', {
  returnUrl: 'https://mystore.com/subscription/welcome',
  cancelUrl: 'https://mystore.com/subscription/cancelled'
});
```

## ✅ Before & After Comparison

### ❌ Before (Hardcoded)
- Brand name: "Your Company Name"
- Return URL: "https://example.com/return"  
- Cancel URL: "https://example.com/cancel"
- Support email: "customer@example.com"

### ✅ After (Customized)
- Brand name: "Your Actual Business Name"
- Return URL: "https://yourdomain.com/payment/success"
- Cancel URL: "https://yourdomain.com/payment/cancel"  
- Support email: "support@yourdomain.com"

## 🛠 Configuration Validation

Validate your configuration before use:

```javascript
const { validateConfiguration } = require('./examples/full-customization');

const config = {
  clientId: 'test',
  clientSecret: 'test',
  baseUrl: 'invalid-url', // This will fail validation
  defaultCurrency: 'INVALID' // This will fail too
};

const errors = validateConfiguration(config);
if (errors.length > 0) {
  console.error('Configuration errors:', errors);
}
```

## 📖 Complete Examples

Check out these files for complete working examples:

- `examples/full-customization.js` - Complete customization showcase
- `examples/basic-payment.js` - Simple payment with custom URLs
- `examples/express-integration.js` - Full Express.js server
- `examples/production-server.js` - Production-ready server

## 🚀 Ready to Use!

1. Copy `.env.example` to `.env`
2. Fill in your actual values (no more example.com!)
3. Initialize PayPal with your configuration
4. All methods now use YOUR branding and URLs automatically

Your PayPal integration will look professional and match your brand perfectly! 🎉
