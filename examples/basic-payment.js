const EasyPayPal = require('../src/index');

// Initialize PayPal client
const paypal = new EasyPayPal({
  clientId: 'YOUR_PAYPAL_CLIENT_ID',
  clientSecret: 'YOUR_PAYPAL_CLIENT_SECRET',
  mode: 'sandbox' // Use 'live' for production
});

async function createPayment() {
  try {
    // Create a simple payment for $50.00
    const order = await paypal.createSimplePayment(
      5000, // Amount in cents ($50.00)
      'USD',
      'Test payment for digital product',
      'https://yourwebsite.com/success',
      'https://yourwebsite.com/cancel'
    );

    console.log('Payment created:', order.id);
    console.log('Approve URL:', order.links.find(link => link.rel === 'approve')?.href);
    
    return order;
  } catch (error) {
    console.error('Error creating payment:', error.message);
  }
}

async function capturePayment(orderId) {
  try {
    const result = await paypal.captureOrder(orderId);
    console.log('Payment captured:', result);
    return result;
  } catch (error) {
    console.error('Error capturing payment:', error.message);
  }
}

// Usage example
async function main() {
  // Step 1: Create payment
  const order = await createPayment();
  
  if (order) {
    console.log('\n--- Payment Flow ---');
    console.log('1. Redirect user to approve URL');
    console.log('2. After user approves, capture the payment');
    
    // In real implementation, you would capture after user approval
    // const captureResult = await capturePayment(order.id);
  }
}

main();
