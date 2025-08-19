const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

/**
 * Easy PayPal API - A simple wrapper for PayPal's REST API
 * Supports payments, subscriptions, webhooks, and more
 */
class EasyPayPal {
  constructor(options = {}) {
    // Required credentials
    this.clientId = options.clientId || process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = options.clientSecret || process.env.PAYPAL_CLIENT_SECRET;
    this.mode = options.mode || process.env.PAYPAL_MODE || 'sandbox';
    this.debug = options.debug || process.env.PAYPAL_DEBUG === 'true' || false;
    
    if (!this.clientId || !this.clientSecret) {
      throw new Error('PayPal Client ID and Client Secret are required');
    }
    
    this.baseURL = this.mode === 'live' 
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
    
    // Configuration defaults
    this.config = {
      // Business/Brand settings
      brandName: options.brandName || options.brand_name || process.env.PAYPAL_BRAND_NAME || 'Your Store',
      businessName: options.businessName || options.business_name || process.env.PAYPAL_BUSINESS_NAME || 'Your Business',
      supportEmail: options.supportEmail || options.support_email || process.env.PAYPAL_SUPPORT_EMAIL || 'support@yourstore.com',
      
      // Default URLs (customizable)
      baseUrl: options.baseUrl || options.base_url || process.env.PAYPAL_BASE_URL || 'https://yourstore.com',
      returnUrl: options.returnUrl || options.return_url || process.env.PAYPAL_RETURN_URL,
      cancelUrl: options.cancelUrl || options.cancel_url || process.env.PAYPAL_CANCEL_URL,
      
      // Payment defaults
      defaultCurrency: options.defaultCurrency || options.default_currency || process.env.PAYPAL_DEFAULT_CURRENCY || 'USD',
      defaultLocale: options.defaultLocale || options.default_locale || process.env.PAYPAL_DEFAULT_LOCALE || 'en-US',
      defaultCountry: options.defaultCountry || options.default_country || process.env.PAYPAL_DEFAULT_COUNTRY || 'US',
      
      // Experience settings
      landingPage: options.landingPage || options.landing_page || 'LOGIN',
      userAction: options.userAction || options.user_action || 'PAY_NOW',
      shippingPreference: options.shippingPreference || options.shipping_preference || 'NO_SHIPPING',
      
      // Business address (for invoices)
      address: {
        line1: options.address?.line1 || process.env.PAYPAL_ADDRESS_LINE1 || '123 Business Street',
        line2: options.address?.line2 || process.env.PAYPAL_ADDRESS_LINE2 || '',
        city: options.address?.city || process.env.PAYPAL_ADDRESS_CITY || 'San Francisco',
        state: options.address?.state || process.env.PAYPAL_ADDRESS_STATE || 'CA',
        postalCode: options.address?.postalCode || process.env.PAYPAL_ADDRESS_POSTAL || '94102',
        country: options.address?.country || process.env.PAYPAL_ADDRESS_COUNTRY || 'US'
      },
      
      // Advanced settings
      timeout: options.timeout || parseInt(process.env.PAYPAL_TIMEOUT) || 30000,
      retryAttempts: options.retryAttempts || parseInt(process.env.PAYPAL_RETRY_ATTEMPTS) || 3,
      webhookId: options.webhookId || process.env.PAYPAL_WEBHOOK_ID,
      
      // Custom templates
      templates: {
        paymentDescription: options.templates?.paymentDescription || 'Payment for {{amount}} {{currency}}',
        subscriptionDescription: options.templates?.subscriptionDescription || '{{planName}} subscription',
        invoiceNote: options.templates?.invoiceNote || 'Thank you for your business with {{businessName}}.',
        refundNote: options.templates?.refundNote || 'Refund processed by {{businessName}}'
      }
    };
    
    this.accessToken = null;
    this.tokenExpiry = null;
    this.requestCounter = 0;
    
    // Rate limiting
    this.rateLimitCount = 0;
    this.rateLimitWindow = Date.now();
    this.maxRequestsPerMinute = options.maxRequestsPerMinute || 1000;
    
    if (this.debug) {
      console.log(`[EasyPayPal] Initialized in ${this.mode} mode`);
      console.log(`[EasyPayPal] Base URL: ${this.baseURL}`);
      console.log(`[EasyPayPal] Brand: ${this.config.brandName}`);
    }
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
   * Check rate limiting
   */
  checkRateLimit() {
    const now = Date.now();
    const windowDuration = 60 * 1000; // 1 minute
    
    if (now - this.rateLimitWindow > windowDuration) {
      // Reset window
      this.rateLimitWindow = now;
      this.rateLimitCount = 0;
    }
    
    if (this.rateLimitCount >= this.maxRequestsPerMinute) {
      throw new Error('Rate limit exceeded. Please wait before making more requests.');
    }
    
    this.rateLimitCount++;
  }

  /**
   * Parse PayPal API errors
   */
  parseError(error) {
    if (!error.response) {
      return {
        type: 'NETWORK_ERROR',
        message: error.message,
        details: null
      };
    }

    const status = error.response.status;
    const data = error.response.data;

    let errorType = 'UNKNOWN_ERROR';
    let message = 'An unknown error occurred';
    let details = data;

    switch (status) {
      case 400:
        errorType = 'BAD_REQUEST';
        message = data?.message || 'Invalid request parameters';
        break;
      case 401:
        errorType = 'AUTHENTICATION_FAILURE';
        message = 'Authentication failed. Check your credentials.';
        this.accessToken = null; // Force token refresh
        break;
      case 403:
        errorType = 'AUTHORIZATION_FAILURE';
        message = 'Access forbidden. Check your permissions.';
        break;
      case 404:
        errorType = 'NOT_FOUND';
        message = 'Resource not found';
        break;
      case 422:
        errorType = 'VALIDATION_ERROR';
        message = data?.message || 'Validation error';
        break;
      case 429:
        errorType = 'RATE_LIMIT_EXCEEDED';
        message = 'Rate limit exceeded. Please retry after some time.';
        break;
      case 500:
        errorType = 'INTERNAL_SERVER_ERROR';
        message = 'PayPal server error. Please try again later.';
        break;
      default:
        message = data?.message || `HTTP ${status} error`;
    }

    return {
      type: errorType,
      message,
      details,
      status
    };
  }

  /**
   * Make authenticated API request with comprehensive error handling
   */
  async makeRequest(method, endpoint, data = null, retryCount = 0) {
    this.checkRateLimit();
    
    const token = await this.getAccessToken();
    this.requestCounter++;
    
    const requestId = `${this.requestCounter}-${Date.now()}`;
    
    if (this.debug) {
      console.log(`[EasyPayPal:${requestId}] ${method} ${endpoint}`);
      if (data) {
        console.log(`[EasyPayPal:${requestId}] Request Data:`, JSON.stringify(data, null, 2));
      }
    }
    
    const config = {
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': requestId, // Idempotency
        'Prefer': 'return=representation'
      },
      timeout: 30000 // 30 seconds timeout
    };
    
    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      
      if (this.debug) {
        console.log(`[EasyPayPal:${requestId}] Response Status:`, response.status);
        console.log(`[EasyPayPal:${requestId}] Response Data:`, JSON.stringify(response.data, null, 2));
      }
      
      return response.data;
    } catch (error) {
      const parsedError = this.parseError(error);
      
      if (this.debug) {
        console.error(`[EasyPayPal:${requestId}] Error:`, parsedError);
      }
      
      // Retry logic for specific errors
      if (retryCount < 3 && (parsedError.type === 'AUTHENTICATION_FAILURE' || parsedError.status === 500)) {
        if (this.debug) {
          console.log(`[EasyPayPal:${requestId}] Retrying... (${retryCount + 1}/3)`);
        }
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return this.makeRequest(method, endpoint, data, retryCount + 1);
      }
      
      const enhancedError = new Error(`PayPal API Error [${parsedError.type}]: ${parsedError.message}`);
      enhancedError.type = parsedError.type;
      enhancedError.status = parsedError.status;
      enhancedError.details = parsedError.details;
      enhancedError.requestId = requestId;
      
      throw enhancedError;
    }
  }

  /**
   * Get configured return URLs
   * @param {string} type - Type of URL (payment, subscription, etc.)
   * @param {Object} overrides - URL overrides
   * @returns {Object} Return and cancel URLs
   */
  getReturnUrls(type = 'payment', overrides = {}) {
    const baseReturnUrl = this.config.returnUrl || `${this.config.baseUrl}/${type}/success`;
    const baseCancelUrl = this.config.cancelUrl || `${this.config.baseUrl}/${type}/cancel`;
    
    return {
      return_url: overrides.returnUrl || overrides.return_url || baseReturnUrl,
      cancel_url: overrides.cancelUrl || overrides.cancel_url || baseCancelUrl
    };
  }

  /**
   * Process template strings
   * @param {string} template - Template string with {{variables}}
   * @param {Object} variables - Variables to replace
   * @returns {string} Processed string
   */
  processTemplate(template, variables = {}) {
    return template.replace(/{{(.*?)}}/g, (match, key) => {
      const value = variables[key.trim()];
      return value !== undefined ? value : match;
    });
  }

  /**
   * Create a payment order
   * @param {Object} orderData - Payment order details
   * @returns {Object} Created order
   */
  async createOrder(orderData) {
    const urls = this.getReturnUrls('payment', orderData);
    
    const defaultOrder = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: this.config.defaultCurrency,
          value: '100.00'
        }
      }],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            brand_name: this.config.brandName,
            locale: this.config.defaultLocale,
            landing_page: this.config.landingPage,
            shipping_preference: this.config.shippingPreference,
            user_action: this.config.userAction,
            return_url: urls.return_url,
            cancel_url: urls.cancel_url
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

  // ==================== ADVANCED PAYMENT METHODS ====================

  /**
   * Create payment with credit card
   * @param {Object} paymentData - Payment details including card info
   * @returns {Object} Created order
   */
  async createCardPayment(paymentData) {
    const { amount, currency = 'USD', card, description = 'Card Payment' } = paymentData;
    
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: this.formatCurrency(amount, currency),
        description
      }],
      payment_source: {
        card: {
          number: card.number,
          expiry: card.expiry,
          security_code: card.cvv,
          name: card.name,
          billing_address: card.billing_address
        }
      }
    };

    return await this.createOrder(orderData);
  }

  /**
   * Authorize payment (capture later)
   * @param {Object} orderData - Order data
   * @returns {Object} Authorized order
   */
  async authorizePayment(orderData) {
    const authOrderData = { ...orderData, intent: 'AUTHORIZE' };
    return await this.createOrder(authOrderData);
  }

  /**
   * Capture authorized payment
   * @param {string} authorizationId - Authorization ID
   * @param {Object} captureData - Capture details
   * @returns {Object} Capture result
   */
  async captureAuthorizedPayment(authorizationId, captureData = {}) {
    return await this.makeRequest('POST', `/v2/payments/authorizations/${authorizationId}/capture`, captureData);
  }

  /**
   * Void authorization
   * @param {string} authorizationId - Authorization ID
   * @returns {Object} Void result
   */
  async voidAuthorization(authorizationId) {
    return await this.makeRequest('POST', `/v2/payments/authorizations/${authorizationId}/void`);
  }

  // ==================== INVOICE MANAGEMENT ====================

  /**
   * Create invoice
   * @param {Object} invoiceData - Invoice details
   * @returns {Object} Created invoice
   */
  async createInvoice(invoiceData) {
    const defaultInvoice = {
      detail: {
        invoice_number: `INV-${Date.now()}`,
        invoice_date: new Date().toISOString().split('T')[0],
        currency_code: 'USD',
        note: 'Thank you for your business.',
        term: 'No terms specified',
        memo: 'This is a long contract',
        payment_term: {
          term_type: 'NET_10'
        }
      },
      invoicer: {
        name: {
          given_name: 'Your',
          surname: 'Business'
        },
        address: {
          address_line_1: '1234 First Street',
          address_line_2: 'Unit 1',
          admin_area_2: 'San Jose',
          admin_area_1: 'CA',
          postal_code: '95131',
          country_code: 'US'
        },
        email_address: 'business@example.com'
      },
      primary_recipients: [{
        billing_info: {
          name: {
            given_name: 'Customer',
            surname: 'Name'
          },
          address: {
            address_line_1: '1234 Main Street',
            admin_area_2: 'Anytown',
            admin_area_1: 'CA',
            postal_code: '95131',
            country_code: 'US'
          },
          email_address: 'customer@example.com'
        }
      }],
      items: [{
        name: 'Item Name',
        description: 'Item Description',
        quantity: '1',
        unit_amount: {
          currency_code: 'USD',
          value: '100.00'
        }
      }],
      configuration: {
        partial_payment: {
          allow_partial_payment: false
        },
        allow_tip: false,
        tax_calculated_after_discount: true,
        tax_inclusive: false
      }
    };

    const invoice = { ...defaultInvoice, ...invoiceData };
    return await this.makeRequest('POST', '/v2/invoicing/invoices', invoice);
  }

  /**
   * Send invoice
   * @param {string} invoiceId - Invoice ID
   * @param {Object} sendData - Send parameters
   * @returns {Object} Send result
   */
  async sendInvoice(invoiceId, sendData = {}) {
    const defaultSendData = {
      send_to_recipient: true,
      send_to_invoicer: false
    };

    const finalSendData = { ...defaultSendData, ...sendData };
    return await this.makeRequest('POST', `/v2/invoicing/invoices/${invoiceId}/send`, finalSendData);
  }

  /**
   * Get invoice details
   * @param {string} invoiceId - Invoice ID
   * @returns {Object} Invoice details
   */
  async getInvoice(invoiceId) {
    return await this.makeRequest('GET', `/v2/invoicing/invoices/${invoiceId}`);
  }

  /**
   * List invoices
   * @param {Object} params - Query parameters
   * @returns {Object} Invoice list
   */
  async listInvoices(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const endpoint = queryParams ? `/v2/invoicing/invoices?${queryParams}` : '/v2/invoicing/invoices';
    return await this.makeRequest('GET', endpoint);
  }

  /**
   * Cancel invoice
   * @param {string} invoiceId - Invoice ID
   * @param {Object} cancelData - Cancel details
   * @returns {Object} Cancel result
   */
  async cancelInvoice(invoiceId, cancelData = {}) {
    const defaultCancelData = {
      subject: 'Invoice Cancelled',
      note: 'The invoice has been cancelled.',
      send_to_recipient: true,
      send_to_invoicer: false
    };

    const finalCancelData = { ...defaultCancelData, ...cancelData };
    return await this.makeRequest('POST', `/v2/invoicing/invoices/${invoiceId}/cancel`, finalCancelData);
  }

  // ==================== ADVANCED SUBSCRIPTION MANAGEMENT ====================

  /**
   * Update subscription plan pricing
   * @param {string} planId - Plan ID
   * @param {Object} pricingData - New pricing data
   * @returns {Object} Update result
   */
  async updateSubscriptionPlanPricing(planId, pricingData) {
    const updateData = {
      op: 'replace',
      path: '/billing_cycles/@sequence==1/pricing_scheme/fixed_price',
      value: pricingData
    };

    return await this.makeRequest('PATCH', `/v1/billing/plans/${planId}`, [updateData]);
  }

  /**
   * Activate subscription plan
   * @param {string} planId - Plan ID
   * @returns {Object} Activation result
   */
  async activateSubscriptionPlan(planId) {
    return await this.makeRequest('POST', `/v1/billing/plans/${planId}/activate`);
  }

  /**
   * Deactivate subscription plan
   * @param {string} planId - Plan ID
   * @returns {Object} Deactivation result
   */
  async deactivateSubscriptionPlan(planId) {
    return await this.makeRequest('POST', `/v1/billing/plans/${planId}/deactivate`);
  }

  /**
   * Suspend subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {string} reason - Suspension reason
   * @returns {Object} Suspension result
   */
  async suspendSubscription(subscriptionId, reason = 'Requested by customer') {
    return await this.makeRequest('POST', `/v1/billing/subscriptions/${subscriptionId}/suspend`, { reason });
  }

  /**
   * Reactivate subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {string} reason - Reactivation reason
   * @returns {Object} Reactivation result
   */
  async reactivateSubscription(subscriptionId, reason = 'Requested by customer') {
    return await this.makeRequest('POST', `/v1/billing/subscriptions/${subscriptionId}/activate`, { reason });
  }

  /**
   * Get subscription transactions
   * @param {string} subscriptionId - Subscription ID
   * @param {string} startTime - Start time (ISO format)
   * @param {string} endTime - End time (ISO format)
   * @returns {Object} Transactions list
   */
  async getSubscriptionTransactions(subscriptionId, startTime, endTime) {
    const params = new URLSearchParams({
      start_time: startTime,
      end_time: endTime
    });
    
    return await this.makeRequest('GET', `/v1/billing/subscriptions/${subscriptionId}/transactions?${params}`);
  }

  // ==================== PAYMENT EXPERIENCE ====================

  /**
   * Create payment experience profile
   * @param {Object} profileData - Profile configuration
   * @returns {Object} Created profile
   */
  async createPaymentExperience(profileData) {
    const defaultProfile = {
      name: 'YourStore_Profile_' + Date.now(),
      presentation: {
        brand_name: 'Your Store',
        logo_image: 'https://www.example.com/logo.jpg',
        locale_code: 'US'
      },
      input_fields: {
        allow_note: true,
        no_shipping: 1,
        address_override: 1
      },
      flow_config: {
        landing_page_type: 'billing',
        bank_txn_pending_url: 'https://www.example.com/pending'
      }
    };

    const profile = { ...defaultProfile, ...profileData };
    return await this.makeRequest('POST', '/v1/payment-experience/web-profiles', profile);
  }

  // ==================== WEBHOOKS MANAGEMENT ====================

  /**
   * Create webhook
   * @param {Object} webhookData - Webhook configuration
   * @returns {Object} Created webhook
   */
  async createWebhook(webhookData) {
    const defaultWebhook = {
      url: 'https://example.com/webhook',
      event_types: [
        { name: 'PAYMENT.CAPTURE.COMPLETED' },
        { name: 'PAYMENT.CAPTURE.DENIED' },
        { name: 'CHECKOUT.ORDER.APPROVED' },
        { name: 'CHECKOUT.ORDER.COMPLETED' }
      ]
    };

    const webhook = { ...defaultWebhook, ...webhookData };
    return await this.makeRequest('POST', '/v1/notifications/webhooks', webhook);
  }

  /**
   * List webhooks
   * @returns {Object} Webhooks list
   */
  async listWebhooks() {
    return await this.makeRequest('GET', '/v1/notifications/webhooks');
  }

  /**
   * Delete webhook
   * @param {string} webhookId - Webhook ID
   * @returns {Object} Delete result
   */
  async deleteWebhook(webhookId) {
    return await this.makeRequest('DELETE', `/v1/notifications/webhooks/${webhookId}`);
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Validate amount format
   * @param {number} amount - Amount to validate
   * @param {string} currency - Currency code
   * @returns {boolean} Valid or not
   */
  validateAmount(amount, currency = 'USD') {
    if (typeof amount !== 'number' || amount <= 0) {
      return false;
    }

    // Check minimum amounts for different currencies
    const minimums = {
      'USD': 100, // $1.00
      'EUR': 100, // €1.00
      'GBP': 100, // £1.00
      'JPY': 100  // ¥100
    };

    return amount >= (minimums[currency] || 100);
  }

  /**
   * Generate unique reference ID
   * @param {string} prefix - Prefix for the ID
   * @returns {string} Unique reference ID
   */
  generateReferenceId(prefix = 'REF') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  /**
   * Get supported currencies
   * @returns {Array} List of supported currency codes
   */
  getSupportedCurrencies() {
    return [
      'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY',
      'SEK', 'NZD', 'MXN', 'SGD', 'HKD', 'NOK', 'DKK', 'PLN',
      'CZK', 'HUF', 'ILS', 'BRL', 'MYR', 'PHP', 'TWD', 'THB',
      'TRY', 'RUB'
    ];
  }

  /**
   * Format webhook for processing
   * @param {Object} webhookEvent - Raw webhook event
   * @returns {Object} Formatted webhook data
   */
  formatWebhookEvent(webhookEvent) {
    return {
      id: webhookEvent.id,
      eventType: webhookEvent.event_type,
      resourceType: webhookEvent.resource_type,
      summary: webhookEvent.summary,
      resource: webhookEvent.resource,
      createTime: webhookEvent.create_time,
      eventVersion: webhookEvent.event_version,
      resourceVersion: webhookEvent.resource_version
    };
  }

  /**
   * Get API status and health
   * @returns {Object} API status information
   */
  async getApiStatus() {
    try {
      await this.getAccessToken();
      return {
        status: 'healthy',
        mode: this.mode,
        baseUrl: this.baseURL,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        mode: this.mode,
        baseUrl: this.baseURL,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = EasyPayPal;
