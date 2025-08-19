const EasyPayPal = require('../src/index');

// Mock environment variables for testing
process.env.PAYPAL_CLIENT_ID = 'test_client_id';
process.env.PAYPAL_CLIENT_SECRET = 'test_client_secret';
process.env.PAYPAL_MODE = 'sandbox';

describe('EasyPayPal - Comprehensive Implementation Tests', () => {
  let paypal;

  beforeEach(() => {
    paypal = new EasyPayPal({
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      mode: 'sandbox',
      debug: false
    });

    // Mock axios to avoid real API calls
    jest.mock('axios');
  });

  describe('Initialization and Configuration', () => {
    test('should initialize with all required properties', () => {
      expect(paypal.clientId).toBe('test_client_id');
      expect(paypal.clientSecret).toBe('test_client_secret');
      expect(paypal.mode).toBe('sandbox');
      expect(paypal.baseURL).toBe('https://api-m.sandbox.paypal.com');
      expect(paypal.debug).toBe(false);
    });

    test('should have rate limiting properties', () => {
      expect(paypal.rateLimitCount).toBe(0);
      expect(paypal.maxRequestsPerMinute).toBe(1000);
      expect(paypal.rateLimitWindow).toBeGreaterThan(0);
    });

    test('should initialize for live mode', () => {
      const livePaypal = new EasyPayPal({
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
        mode: 'live'
      });
      expect(livePaypal.baseURL).toBe('https://api-m.paypal.com');
    });
  });

  describe('Utility Functions', () => {
    test('formatCurrency should format amounts correctly', () => {
      expect(paypal.formatCurrency(2500, 'USD')).toEqual({
        currency_code: 'USD',
        value: '25.00'
      });

      expect(paypal.formatCurrency(999, 'EUR')).toEqual({
        currency_code: 'EUR',
        value: '9.99'
      });

      expect(paypal.formatCurrency(0, 'GBP')).toEqual({
        currency_code: 'GBP',
        value: '0.00'
      });
    });

    test('validateAmount should validate amounts correctly', () => {
      expect(paypal.validateAmount(1000, 'USD')).toBe(true);
      expect(paypal.validateAmount(100, 'USD')).toBe(true);
      expect(paypal.validateAmount(50, 'USD')).toBe(false);
      expect(paypal.validateAmount(0, 'USD')).toBe(false);
      expect(paypal.validateAmount(-100, 'USD')).toBe(false);
      expect(paypal.validateAmount('invalid', 'USD')).toBe(false);
    });

    test('generateReferenceId should generate unique IDs', () => {
      const id1 = paypal.generateReferenceId('TEST');
      const id2 = paypal.generateReferenceId('TEST');
      
      expect(id1).toMatch(/^TEST-\d+-[A-Z0-9]{9}$/);
      expect(id2).toMatch(/^TEST-\d+-[A-Z0-9]{9}$/);
      expect(id1).not.toBe(id2);
    });

    test('getSupportedCurrencies should return currency array', () => {
      const currencies = paypal.getSupportedCurrencies();
      
      expect(Array.isArray(currencies)).toBe(true);
      expect(currencies.length).toBeGreaterThan(20);
      expect(currencies).toContain('USD');
      expect(currencies).toContain('EUR');
      expect(currencies).toContain('GBP');
    });

    test('formatWebhookEvent should format webhook data', () => {
      const rawEvent = {
        id: 'WH-123',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource_type: 'capture',
        summary: 'Payment captured',
        resource: { id: 'CAPTURE-123' },
        create_time: '2024-01-01T00:00:00Z',
        event_version: '1.0',
        resource_version: '2.0'
      };

      const formatted = paypal.formatWebhookEvent(rawEvent);

      expect(formatted).toEqual({
        id: 'WH-123',
        eventType: 'PAYMENT.CAPTURE.COMPLETED',
        resourceType: 'capture',
        summary: 'Payment captured',
        resource: { id: 'CAPTURE-123' },
        createTime: '2024-01-01T00:00:00Z',
        eventVersion: '1.0',
        resourceVersion: '2.0'
      });
    });
  });

  describe('Error Handling', () => {
    test('parseError should handle network errors', () => {
      const networkError = new Error('Network error');
      const parsed = paypal.parseError(networkError);

      expect(parsed.type).toBe('NETWORK_ERROR');
      expect(parsed.message).toBe('Network error');
      expect(parsed.details).toBeNull();
    });

    test('parseError should handle HTTP errors', () => {
      const httpError = {
        response: {
          status: 400,
          data: { message: 'Bad request' }
        }
      };

      const parsed = paypal.parseError(httpError);

      expect(parsed.type).toBe('BAD_REQUEST');
      expect(parsed.message).toBe('Bad request');
      expect(parsed.status).toBe(400);
    });

    test('parseError should handle authentication failures', () => {
      const authError = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      };

      const parsed = paypal.parseError(authError);

      expect(parsed.type).toBe('AUTHENTICATION_FAILURE');
      expect(parsed.message).toBe('Authentication failed. Check your credentials.');
      expect(parsed.status).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    test('checkRateLimit should track requests', () => {
      const initialCount = paypal.rateLimitCount;
      paypal.checkRateLimit();
      expect(paypal.rateLimitCount).toBe(initialCount + 1);
    });

    test('checkRateLimit should reset window after time', () => {
      // Set window to past time
      paypal.rateLimitWindow = Date.now() - 61000; // 61 seconds ago
      paypal.rateLimitCount = 500;

      paypal.checkRateLimit();

      expect(paypal.rateLimitCount).toBe(1);
      expect(paypal.rateLimitWindow).toBeCloseTo(Date.now(), -3);
    });

    test('checkRateLimit should throw error when limit exceeded', () => {
      paypal.rateLimitCount = 1000;

      expect(() => {
        paypal.checkRateLimit();
      }).toThrow('Rate limit exceeded');
    });
  });

  describe('API Method Signatures', () => {
    test('should have all payment methods', () => {
      expect(typeof paypal.createOrder).toBe('function');
      expect(typeof paypal.captureOrder).toBe('function');
      expect(typeof paypal.getOrder).toBe('function');
      expect(typeof paypal.createSimplePayment).toBe('function');
      expect(typeof paypal.createCardPayment).toBe('function');
      expect(typeof paypal.authorizePayment).toBe('function');
      expect(typeof paypal.captureAuthorizedPayment).toBe('function');
      expect(typeof paypal.voidAuthorization).toBe('function');
    });

    test('should have all subscription methods', () => {
      expect(typeof paypal.createProduct).toBe('function');
      expect(typeof paypal.createSubscriptionPlan).toBe('function');
      expect(typeof paypal.createSubscription).toBe('function');
      expect(typeof paypal.getSubscription).toBe('function');
      expect(typeof paypal.cancelSubscription).toBe('function');
      expect(typeof paypal.updateSubscriptionPlanPricing).toBe('function');
      expect(typeof paypal.activateSubscriptionPlan).toBe('function');
      expect(typeof paypal.deactivateSubscriptionPlan).toBe('function');
      expect(typeof paypal.suspendSubscription).toBe('function');
      expect(typeof paypal.reactivateSubscription).toBe('function');
      expect(typeof paypal.getSubscriptionTransactions).toBe('function');
    });

    test('should have all invoice methods', () => {
      expect(typeof paypal.createInvoice).toBe('function');
      expect(typeof paypal.sendInvoice).toBe('function');
      expect(typeof paypal.getInvoice).toBe('function');
      expect(typeof paypal.listInvoices).toBe('function');
      expect(typeof paypal.cancelInvoice).toBe('function');
    });

    test('should have all webhook methods', () => {
      expect(typeof paypal.verifyWebhook).toBe('function');
      expect(typeof paypal.createWebhook).toBe('function');
      expect(typeof paypal.listWebhooks).toBe('function');
      expect(typeof paypal.deleteWebhook).toBe('function');
    });

    test('should have utility methods', () => {
      expect(typeof paypal.refund).toBe('function');
      expect(typeof paypal.getPayment).toBe('function');
      expect(typeof paypal.createPaymentExperience).toBe('function');
      expect(typeof paypal.getApiStatus).toBe('function');
    });
  });

  describe('Configuration Validation', () => {
    test('should throw error for missing credentials', () => {
      expect(() => {
        new EasyPayPal({});
      }).toThrow('PayPal Client ID and Client Secret are required');
    });

    test('should throw error for missing client ID', () => {
      expect(() => {
        new EasyPayPal({
          clientSecret: 'secret'
        });
      }).toThrow('PayPal Client ID and Client Secret are required');
    });

    test('should throw error for missing client secret', () => {
      expect(() => {
        new EasyPayPal({
          clientId: 'id'
        });
      }).toThrow('PayPal Client ID and Client Secret are required');
    });
  });

  describe('Default Values', () => {
    test('should have correct default values', () => {
      const paypalWithDefaults = new EasyPayPal({
        clientId: 'test_id',
        clientSecret: 'test_secret'
      });

      expect(paypalWithDefaults.mode).toBe('sandbox');
      expect(paypalWithDefaults.debug).toBe(false);
      expect(paypalWithDefaults.maxRequestsPerMinute).toBe(1000);
    });
  });
});

describe('EasyPayPal - Data Structure Tests', () => {
  let paypal;

  beforeEach(() => {
    paypal = new EasyPayPal({
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      mode: 'sandbox'
    });
  });

  test('order data should have correct structure', () => {
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: paypal.formatCurrency(2500, 'USD'),
        description: 'Test payment'
      }],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            brand_name: 'Test Store',
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

    expect(orderData.intent).toBe('CAPTURE');
    expect(orderData.purchase_units).toHaveLength(1);
    expect(orderData.purchase_units[0].amount).toEqual({
      currency_code: 'USD',
      value: '25.00'
    });
    expect(orderData.payment_source.paypal.experience_context.user_action).toBe('PAY_NOW');
  });

  test('subscription plan data should have correct structure', () => {
    const planData = {
      product_id: 'PROD-123',
      name: 'Test Plan',
      description: 'Test subscription plan',
      status: 'ACTIVE',
      billing_cycles: [{
        frequency: {
          interval_unit: 'MONTH',
          interval_count: 1
        },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: {
          fixed_price: {
            value: '29.99',
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
      }
    };

    expect(planData.status).toBe('ACTIVE');
    expect(planData.billing_cycles).toHaveLength(1);
    expect(planData.billing_cycles[0].frequency.interval_unit).toBe('MONTH');
    expect(planData.payment_preferences.auto_bill_outstanding).toBe(true);
  });
});
