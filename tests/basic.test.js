const EasyPayPal = require('../src/index');

// Mock environment variables for testing
process.env.PAYPAL_CLIENT_ID = 'test_client_id';
process.env.PAYPAL_CLIENT_SECRET = 'test_client_secret';
process.env.PAYPAL_MODE = 'sandbox';

describe('EasyPayPal', () => {
  let paypal;

  beforeEach(() => {
    paypal = new EasyPayPal({
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      mode: 'sandbox'
    });
  });

  describe('Constructor', () => {
    test('should initialize with provided options', () => {
      expect(paypal.clientId).toBe('test_client_id');
      expect(paypal.clientSecret).toBe('test_client_secret');
      expect(paypal.mode).toBe('sandbox');
      expect(paypal.baseURL).toBe('https://api-m.sandbox.paypal.com');
    });

    test('should throw error without client credentials', () => {
      // Temporarily clear environment variables
      const oldClientId = process.env.PAYPAL_CLIENT_ID;
      const oldClientSecret = process.env.PAYPAL_CLIENT_SECRET;
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      
      expect(() => {
        new EasyPayPal({});
      }).toThrow('PayPal Client ID and Client Secret are required');
      
      // Restore environment variables
      process.env.PAYPAL_CLIENT_ID = oldClientId;
      process.env.PAYPAL_CLIENT_SECRET = oldClientSecret;
    });

    test('should use live URL for production mode', () => {
      const livePaypal = new EasyPayPal({
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
        mode: 'live'
      });
      expect(livePaypal.baseURL).toBe('https://api-m.paypal.com');
    });
  });

  describe('Helper Methods', () => {
    test('formatCurrency should format amount correctly', () => {
      const formatted = paypal.formatCurrency(2500, 'USD');
      expect(formatted).toEqual({
        currency_code: 'USD',
        value: '25.00'
      });
    });

    test('formatCurrency should use USD as default currency', () => {
      const formatted = paypal.formatCurrency(1000);
      expect(formatted).toEqual({
        currency_code: 'USD',
        value: '10.00'
      });
    });

    test('formatCurrency should handle zero amount', () => {
      const formatted = paypal.formatCurrency(0);
      expect(formatted).toEqual({
        currency_code: 'USD',
        value: '0.00'
      });
    });
  });

  describe('Environment Variables', () => {
    test('should use environment variables when no options provided', () => {
      const envPaypal = new EasyPayPal();
      expect(envPaypal.clientId).toBe('test_client_id');
      expect(envPaypal.clientSecret).toBe('test_client_secret');
      expect(envPaypal.mode).toBe('sandbox');
    });
  });
});

describe('Error Handling', () => {
  test('should handle missing credentials gracefully', () => {
    // Temporarily clear environment variables
    const oldClientSecret = process.env.PAYPAL_CLIENT_SECRET;
    delete process.env.PAYPAL_CLIENT_SECRET;
    
    expect(() => {
      new EasyPayPal({
        clientId: 'test_client_id'
        // Missing client secret
      });
    }).toThrow('PayPal Client ID and Client Secret are required');
    
    // Restore environment variable
    process.env.PAYPAL_CLIENT_SECRET = oldClientSecret;
  });
});
