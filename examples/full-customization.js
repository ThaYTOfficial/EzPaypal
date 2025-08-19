const EasyPayPal = require('../src/index');

// ==================== FULL CUSTOMIZATION EXAMPLE ====================

// Example 1: Complete configuration setup
const fullyCustomizedPayPal = new EasyPayPal({
  // Required credentials
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  mode: 'sandbox', // or 'live'
  debug: true,

  // Business/Brand customization
  brandName: 'Awesome Tech Store',
  businessName: 'Awesome Tech LLC',
  supportEmail: 'billing@awesometech.com',

  // URL configuration
  baseUrl: 'https://awesometech.com',
  returnUrl: 'https://awesometech.com/payment/completed',
  cancelUrl: 'https://awesometech.com/payment/cancelled',

  // Payment defaults
  defaultCurrency: 'USD',
  defaultLocale: 'en-US',
  defaultCountry: 'US',

  // User experience
  landingPage: 'BILLING', // or 'LOGIN'
  userAction: 'PAY_NOW', // or 'CONTINUE'
  shippingPreference: 'NO_SHIPPING', // or 'SET_PROVIDED_ADDRESS'

  // Business address for invoices
  address: {
    line1: '1234 Tech Boulevard',
    line2: 'Suite 500',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94105',
    country: 'US'
  },

  // Advanced settings
  timeout: 45000, // 45 seconds
  retryAttempts: 5,
  maxRequestsPerMinute: 800,
  webhookId: process.env.PAYPAL_WEBHOOK_ID,

  // Custom templates
  templates: {
    paymentDescription: 'Purchase from {{businessName}} - {{amount}} {{currency}}',
    subscriptionDescription: '{{planName}} - Premium {{businessName}} Service',
    invoiceNote: 'Thank you for choosing {{businessName}}! Your satisfaction is our priority.',
    refundNote: 'Refund issued by {{businessName}} support team.'
  }
});

// ==================== CUSTOMIZATION EXAMPLES ====================

async function demonstrateCustomization() {
  console.log('🎨 PayPal API Customization Examples\n');

  try {
    // Example 1: Customized simple payment
    console.log('1. Creating customized payment...');
    const customPayment = await fullyCustomizedPayPal.createSimplePayment(
      2500, // $25.00
      'USD',
      fullyCustomizedPayPal.processTemplate(
        fullyCustomizedPayPal.config.templates.paymentDescription,
        {
          businessName: fullyCustomizedPayPal.config.businessName,
          amount: '$25.00',
          currency: 'USD'
        }
      )
    );

    console.log('✅ Customized payment created:', {
      id: customPayment.id,
      brandName: 'Uses your custom brand name',
      returnUrl: 'Goes to your custom URL',
      description: 'Uses your custom template'
    });
    console.log();

    // Example 2: Environment-based configuration
    console.log('2. Environment-based configuration example...');
    const envBasedPayPal = new EasyPayPal({
      // These will automatically use environment variables if available
      // PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, etc.
      brandName: process.env.BRAND_NAME || 'Default Store',
      baseUrl: process.env.WEBSITE_URL || 'https://defaultstore.com',
      defaultCurrency: process.env.DEFAULT_CURRENCY || 'EUR'
    });
    
    console.log('✅ Environment configuration loaded:', {
      brand: envBasedPayPal.config.brandName,
      baseUrl: envBasedPayPal.config.baseUrl,
      currency: envBasedPayPal.config.defaultCurrency
    });
    console.log();

    // Example 3: Dynamic URL generation
    console.log('3. Dynamic URL generation...');
    const urls = fullyCustomizedPayPal.getReturnUrls('checkout');
    console.log('✅ Generated URLs:', urls);
    
    // Override URLs for specific payment
    const overrideUrls = fullyCustomizedPayPal.getReturnUrls('payment', {
      returnUrl: 'https://special.awesometech.com/success',
      cancelUrl: 'https://special.awesometech.com/cancel'
    });
    console.log('✅ Override URLs:', overrideUrls);
    console.log();

    // Example 4: Template processing
    console.log('4. Template processing...');
    const processedNote = fullyCustomizedPayPal.processTemplate(
      fullyCustomizedPayPal.config.templates.invoiceNote,
      { businessName: fullyCustomizedPayPal.config.businessName }
    );
    console.log('✅ Processed template:', processedNote);
    console.log();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// ==================== MULTI-ENVIRONMENT SETUP ====================

class PayPalEnvironmentManager {
  constructor() {
    this.environments = {};
  }

  // Configure multiple environments
  configure(envName, options) {
    this.environments[envName] = new EasyPayPal(options);
    return this;
  }

  // Get PayPal instance for specific environment
  get(envName) {
    if (!this.environments[envName]) {
      throw new Error(`Environment ${envName} not configured`);
    }
    return this.environments[envName];
  }
}

// Multi-environment example
const paypalManager = new PayPalEnvironmentManager()
  .configure('development', {
    clientId: process.env.PAYPAL_DEV_CLIENT_ID,
    clientSecret: process.env.PAYPAL_DEV_CLIENT_SECRET,
    mode: 'sandbox',
    brandName: 'Dev Store',
    baseUrl: 'http://localhost:3000',
    debug: true
  })
  .configure('staging', {
    clientId: process.env.PAYPAL_STAGING_CLIENT_ID,
    clientSecret: process.env.PAYPAL_STAGING_CLIENT_SECRET,
    mode: 'sandbox',
    brandName: 'Staging Store',
    baseUrl: 'https://staging.mystore.com'
  })
  .configure('production', {
    clientId: process.env.PAYPAL_PROD_CLIENT_ID,
    clientSecret: process.env.PAYPAL_PROD_CLIENT_SECRET,
    mode: 'live',
    brandName: 'My Awesome Store',
    baseUrl: 'https://mystore.com',
    maxRequestsPerMinute: 2000 // Higher limit for production
  });

// ==================== CONFIGURATION VALIDATION ====================

function validateConfiguration(config) {
  const errors = [];

  // Required fields
  if (!config.clientId) errors.push('Missing clientId');
  if (!config.clientSecret) errors.push('Missing clientSecret');

  // URL validation
  if (config.baseUrl && !config.baseUrl.startsWith('http')) {
    errors.push('baseUrl must start with http:// or https://');
  }

  // Currency validation
  const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];
  if (config.defaultCurrency && !validCurrencies.includes(config.defaultCurrency)) {
    errors.push(`Invalid currency: ${config.defaultCurrency}`);
  }

  return errors;
}

// ==================== USAGE EXAMPLES ====================

async function runCustomizationExamples() {
  console.log('🚀 PayPal API Full Customization Demo\n');

  // Run basic customization
  await demonstrateCustomization();

  // Environment-specific usage
  console.log('5. Environment-specific usage...');
  try {
    const devPaypal = paypalManager.get('development');
    const prodPaypal = paypalManager.get('production');

    console.log('✅ Development environment ready');
    console.log('✅ Production environment ready');

    // Show configuration differences
    console.log('Configuration comparison:', {
      dev: {
        brand: devPaypal.config.brandName,
        baseUrl: devPaypal.config.baseUrl,
        debug: devPaypal.debug
      },
      prod: {
        brand: prodPaypal.config.brandName,
        baseUrl: prodPaypal.config.baseUrl,
        debug: prodPaypal.debug
      }
    });
  } catch (error) {
    console.error('❌ Environment error:', error.message);
  }

  console.log('\n✨ All customization examples completed!');
}

// ==================== EXPORT EXAMPLES ====================

module.exports = {
  fullyCustomizedPayPal,
  PayPalEnvironmentManager,
  paypalManager,
  validateConfiguration,
  runCustomizationExamples
};

// Run if called directly
if (require.main === module) {
  runCustomizationExamples();
}
