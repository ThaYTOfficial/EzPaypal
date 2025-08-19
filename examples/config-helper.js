const EasyPayPal = require('../src/index');

/**
 * Configuration helper to avoid example.com URLs
 */
class PayPalConfig {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://yourstore.com';
    this.brandName = options.brandName || 'Your Store';
    this.supportEmail = options.supportEmail || 'support@yourstore.com';
    
    // Initialize PayPal with your credentials
    this.paypal = new EasyPayPal(options.paypal || {});
  }

  /**
   * Get properly configured return URLs
   */
  getReturnUrls(type = 'payment') {
    return {
      return_url: `${this.baseUrl}/${type}/success`,
      cancel_url: `${this.baseUrl}/${type}/cancel`
    };
  }

  /**
   * Create payment with proper URLs
   */
  async createPayment(amount, currency = 'USD', description = 'Payment') {
    return await this.paypal.createSimplePayment(
      amount,
      currency,
      description,
      `${this.baseUrl}/payment/success`,
      `${this.baseUrl}/payment/cancel`
    );
  }

  /**
   * Create subscription with proper URLs
   */
  async createSubscription(planId, customerData) {
    const urls = this.getReturnUrls('subscription');
    
    return await this.paypal.createSubscription({
      plan_id: planId,
      subscriber: customerData,
      application_context: {
        brand_name: this.brandName,
        return_url: urls.return_url,
        cancel_url: urls.cancel_url,
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW'
      }
    });
  }

  /**
   * Create invoice with proper business details
   */
  async createInvoice(invoiceData) {
    return await this.paypal.createInvoice({
      ...invoiceData,
      invoicer: {
        name: { given_name: 'Your', surname: 'Business' },
        email_address: this.supportEmail,
        ...invoiceData.invoicer
      }
    });
  }
}

// Usage Example:
async function example() {
  const config = new PayPalConfig({
    baseUrl: 'https://mystore.com',
    brandName: 'My Awesome Store',
    supportEmail: 'billing@mystore.com',
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      mode: 'sandbox'
    }
  });

  // Now all URLs will use your domain instead of example.com
  const payment = await config.createPayment(2500, 'USD', 'Premium Product');
  console.log('Payment URLs will redirect to mystore.com!');
}

module.exports = PayPalConfig;
