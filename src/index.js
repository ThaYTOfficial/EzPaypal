const axios = require('axios');
require('dotenv').config();

/**
 * Easy PayPal API - A simple wrapper for PayPal's REST API
 * Supports payments, subscriptions, webhooks, and more
 */
class EasyPayPal {
  constructor(options = {}) {
    this.clientId = options.clientId || process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = options.clientSecret || process.env.PAYPAL_CLIENT_SECRET;
    this.mode = options.mode || process.env.PAYPAL_MODE || 'sandbox';
    
    if (!this.clientId || !this.clientSecret) {
      throw new Error('PayPal Client ID and Client Secret are required');
    }
    
    this.baseURL = this.mode === 'live' 
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
    
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get access token from PayPal
   */
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post(
        `${this.baseURL}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // Refresh 1 minute early
      
      return this.accessToken;
    } catch (error) {
      throw new Error(`Failed to get PayPal access token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Make authenticated API request
   */
  async makeRequest(method, endpoint, data = null) {
    const token = await this.getAccessToken();
    
    const config = {
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      throw new Error(`PayPal API error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create a payment order
   * @param {Object} orderData - Payment order details
   * @returns {Object} Created order
   */
  async createOrder(orderData) {
    const defaultOrder = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: '100.00'
        }
      }],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            brand_name: 'Your Company Name',
            locale: 'en-US',
            landing_page: 'LOGIN',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: 'https://example.com/return',
            cancel_url: 'https://example.com/cancel'
          }
        }
      }
    };

    const order = { ...defaultOrder, ...orderData };
    return await this.makeRequest('POST', '/v2/checkout/orders', order);
  }

  /**
   * Capture payment for an order
   * @param {string} orderId - Order ID to capture
   * @returns {Object} Capture result
   */
  async captureOrder(orderId) {
    return await this.makeRequest('POST', `/v2/checkout/orders/${orderId}/capture`);
  }

  /**
   * Get order details
   * @param {string} orderId - Order ID
   * @returns {Object} Order details
   */
  async getOrder(orderId) {
    return await this.makeRequest('GET', `/v2/checkout/orders/${orderId}`);
  }

  /**
   * Create a subscription plan
   * @param {Object} planData - Subscription plan details
   * @returns {Object} Created plan
   */
  async createSubscriptionPlan(planData) {
    const defaultPlan = {
      product_id: 'PROD-XXXXXXXXXXXXXXXXXXXX',
      name: 'Basic Plan',
      description: 'Basic subscription plan',
      status: 'ACTIVE',
      billing_cycles: [{
        frequency: {
          interval_unit: 'MONTH',
          interval_count: 1
        },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 12,
        pricing_scheme: {
          fixed_price: {
            value: '10.00',
            currency_code: 'USD'
          }
        }
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: {
          value: '0.00',
          currency_code: 'USD'
        },
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3
      },
      taxes: {
        percentage: '0.00',
        inclusive: false
      }
    };

    const plan = { ...defaultPlan, ...planData };
    return await this.makeRequest('POST', '/v1/billing/plans', plan);
  }

  /**
   * Create a subscription
   * @param {Object} subscriptionData - Subscription details
   * @returns {Object} Created subscription
   */
  async createSubscription(subscriptionData) {
    const defaultSubscription = {
      plan_id: 'P-XXXXXXXXXXXXXXXXXXXXXXXXXX',
      start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Start tomorrow
      quantity: '1',
      shipping_amount: {
        currency_code: 'USD',
        value: '0.00'
      },
      subscriber: {
        name: {
          given_name: 'John',
          surname: 'Doe'
        },
        email_address: 'customer@example.com'
      },
      application_context: {
        brand_name: 'Your Company Name',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: {
          payer_selected: 'PAYPAL',
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
        },
        return_url: 'https://example.com/return',
        cancel_url: 'https://example.com/cancel'
      }
    };

    const subscription = { ...defaultSubscription, ...subscriptionData };
    return await this.makeRequest('POST', '/v1/billing/subscriptions', subscription);
  }

  /**
   * Get subscription details
   * @param {string} subscriptionId - Subscription ID
   * @returns {Object} Subscription details
   */
  async getSubscription(subscriptionId) {
    return await this.makeRequest('GET', `/v1/billing/subscriptions/${subscriptionId}`);
  }

  /**
   * Cancel a subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {string} reason - Cancellation reason
   * @returns {Object} Cancellation result
   */
  async cancelSubscription(subscriptionId, reason = 'User requested cancellation') {
    return await this.makeRequest('POST', `/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      reason
    });
  }

  /**
   * Create a product (required for subscription plans)
   * @param {Object} productData - Product details
   * @returns {Object} Created product
   */
  async createProduct(productData) {
    const defaultProduct = {
      name: 'Basic Product',
      description: 'Basic product for subscription',
      type: 'SERVICE',
      category: 'SOFTWARE'
    };

    const product = { ...defaultProduct, ...productData };
    return await this.makeRequest('POST', '/v1/catalogs/products', product);
  }

  /**
   * Process a refund
   * @param {string} captureId - Capture ID to refund
   * @param {Object} refundData - Refund details
   * @returns {Object} Refund result
   */
  async refund(captureId, refundData = {}) {
    return await this.makeRequest('POST', `/v2/payments/captures/${captureId}/refund`, refundData);
  }

  /**
   * Get payment details
   * @param {string} paymentId - Payment ID
   * @returns {Object} Payment details
   */
  async getPayment(paymentId) {
    return await this.makeRequest('GET', `/v2/payments/captures/${paymentId}`);
  }

  /**
   * Verify webhook signature
   * @param {Object} headers - Request headers
   * @param {Object} body - Request body
   * @param {string} webhookId - Webhook ID from PayPal
   * @returns {boolean} Verification result
   */
  async verifyWebhook(headers, body, webhookId) {
    const verificationData = {
      auth_algo: headers['paypal-auth-algo'],
      cert_id: headers['paypal-cert-id'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: body
    };

    try {
      const result = await this.makeRequest('POST', '/v1/notifications/verify-webhook-signature', verificationData);
      return result.verification_status === 'SUCCESS';
    } catch (error) {
      console.error('Webhook verification failed:', error);
      return false;
    }
  }

  /**
   * Helper method to format currency
   * @param {number} amount - Amount in cents or smallest currency unit
   * @param {string} currency - Currency code (default: USD)
   * @returns {Object} Formatted amount object
   */
  formatCurrency(amount, currency = 'USD') {
    return {
      currency_code: currency,
      value: (amount / 100).toFixed(2)
    };
  }

  /**
   * Helper method to create simple payment
   * @param {number} amount - Amount in cents
   * @param {string} currency - Currency code
   * @param {string} description - Payment description
   * @param {string} returnUrl - Return URL
   * @param {string} cancelUrl - Cancel URL
   * @returns {Object} Created order
   */
  async createSimplePayment(amount, currency = 'USD', description = 'Payment', returnUrl, cancelUrl) {
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: this.formatCurrency(amount, currency),
        description
      }],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            brand_name: 'Your Store',
            locale: 'en-US',
            landing_page: 'LOGIN',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: returnUrl || 'https://example.com/return',
            cancel_url: cancelUrl || 'https://example.com/cancel'
          }
        }
      }
    };

    return await this.createOrder(orderData);
  }
}

module.exports = EasyPayPal;
