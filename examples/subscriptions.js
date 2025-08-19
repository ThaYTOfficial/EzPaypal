const EasyPayPal = require('../src/index');

// Initialize PayPal client
const paypal = new EasyPayPal({
  clientId: process.env.PAYPAL_CLIENT_ID || 'YOUR_CLIENT_ID',
  clientSecret: process.env.PAYPAL_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
  mode: process.env.PAYPAL_MODE || 'sandbox'
});

async function createSubscriptionWorkflow() {
  try {
    // Step 1: Create a product
    console.log('Creating product...');
    const product = await paypal.createProduct({
      name: 'Premium Subscription Service',
      description: 'Monthly subscription for premium features',
      type: 'SERVICE',
      category: 'SOFTWARE'
    });
    
    console.log('Product created:', product.id);

    // Step 2: Create a billing plan
    console.log('Creating billing plan...');
    const plan = await paypal.createSubscriptionPlan({
      product_id: product.id,
      name: 'Premium Monthly Plan',
      description: 'Premium features with monthly billing',
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: {
            interval_unit: 'MONTH',
            interval_count: 1
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // Infinite cycles
          pricing_scheme: {
            fixed_price: {
              value: '29.99',
              currency_code: 'USD'
            }
          }
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: {
          value: '5.00',
          currency_code: 'USD'
        },
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3
      },
      taxes: {
        percentage: '8.25',
        inclusive: false
      }
    });
    
    console.log('Plan created:', plan.id);

    // Step 3: Create a subscription
    console.log('Creating subscription...');
    const subscription = await paypal.createSubscription({
      plan_id: plan.id,
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
        brand_name: 'Your SaaS Company',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: {
          payer_selected: 'PAYPAL',
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
        },
        return_url: 'https://yourwebsite.com/subscription/success',
        cancel_url: 'https://yourwebsite.com/subscription/cancel'
      }
    });

    console.log('Subscription created:', subscription.id);
    
    // Get approval URL
    const approveLink = subscription.links.find(link => link.rel === 'approve');
    console.log('Approval URL:', approveLink?.href);

    return {
      product,
      plan,
      subscription,
      approveUrl: approveLink?.href
    };

  } catch (error) {
    console.error('Subscription workflow error:', error.message);
    throw error;
  }
}

async function manageSubscription(subscriptionId) {
  try {
    // Get subscription details
    console.log('Getting subscription details...');
    const subscription = await paypal.getSubscription(subscriptionId);
    console.log('Subscription status:', subscription.status);
    console.log('Next billing time:', subscription.billing_info?.next_billing_time);

    // Cancel subscription (if needed)
    if (subscription.status === 'ACTIVE') {
      console.log('Cancelling subscription...');
      await paypal.cancelSubscription(subscriptionId, 'Customer requested cancellation');
      console.log('Subscription cancelled');
    }

  } catch (error) {
    console.error('Subscription management error:', error.message);
  }
}

// Example with different billing cycles
async function createAdvancedSubscription() {
  try {
    // Create product first
    const product = await paypal.createProduct({
      name: 'Advanced SaaS Platform',
      description: 'Enterprise subscription with trial period',
      type: 'SERVICE',
      category: 'SOFTWARE'
    });

    // Create plan with trial period
    const plan = await paypal.createSubscriptionPlan({
      product_id: product.id,
      name: 'Enterprise Plan with Trial',
      description: 'Enterprise features with 7-day free trial',
      status: 'ACTIVE',
      billing_cycles: [
        // Trial cycle
        {
          frequency: {
            interval_unit: 'DAY',
            interval_count: 7
          },
          tenure_type: 'TRIAL',
          sequence: 1,
          total_cycles: 1,
          pricing_scheme: {
            fixed_price: {
              value: '0.00',
              currency_code: 'USD'
            }
          }
        },
        // Regular billing cycle
        {
          frequency: {
            interval_unit: 'MONTH',
            interval_count: 1
          },
          tenure_type: 'REGULAR',
          sequence: 2,
          total_cycles: 0, // Infinite
          pricing_scheme: {
            fixed_price: {
              value: '99.99',
              currency_code: 'USD'
            }
          }
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: {
          value: '0.00',
          currency_code: 'USD'
        },
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3
      }
    });

    console.log('Advanced plan created:', plan.id);
    return plan;

  } catch (error) {
    console.error('Advanced subscription error:', error.message);
  }
}

// Usage examples
async function main() {
  try {
    // Create basic subscription
    const result = await createSubscriptionWorkflow();
    
    if (result) {
      console.log('\n--- Subscription Created ---');
      console.log('Product ID:', result.product.id);
      console.log('Plan ID:', result.plan.id);
      console.log('Subscription ID:', result.subscription.id);
      console.log('Approval URL:', result.approveUrl);
      
      // Simulate subscription management after some time
      // await manageSubscription(result.subscription.id);
    }

    // Create advanced subscription with trial
    console.log('\n--- Creating Advanced Subscription ---');
    await createAdvancedSubscription();

  } catch (error) {
    console.error('Main workflow error:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  createSubscriptionWorkflow,
  manageSubscription,
  createAdvancedSubscription
};
