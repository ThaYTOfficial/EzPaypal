export interface PayPalOptions {
  clientId?: string;
  clientSecret?: string;
  mode?: 'sandbox' | 'live';
}

export interface Amount {
  currency_code: string;
  value: string;
}

export interface PurchaseUnit {
  amount: Amount;
  description?: string;
  reference_id?: string;
}

export interface ExperienceContext {
  payment_method_preference?: string;
  brand_name?: string;
  locale?: string;
  landing_page?: string;
  shipping_preference?: string;
  user_action?: string;
  return_url: string;
  cancel_url: string;
}

export interface PaymentSource {
  paypal: {
    experience_context: ExperienceContext;
  };
}

export interface OrderData {
  intent: 'CAPTURE' | 'AUTHORIZE';
  purchase_units: PurchaseUnit[];
  payment_source?: PaymentSource;
}

export interface CreatedOrder {
  id: string;
  status: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

export interface BillingCycle {
  frequency: {
    interval_unit: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
    interval_count: number;
  };
  tenure_type: 'TRIAL' | 'REGULAR';
  sequence: number;
  total_cycles?: number;
  pricing_scheme: {
    fixed_price: Amount;
  };
}

export interface PaymentPreferences {
  auto_bill_outstanding: boolean;
  setup_fee: Amount;
  setup_fee_failure_action: 'CONTINUE' | 'CANCEL';
  payment_failure_threshold: number;
}

export interface PlanData {
  product_id: string;
  name: string;
  description?: string;
  status: 'CREATED' | 'INACTIVE' | 'ACTIVE';
  billing_cycles: BillingCycle[];
  payment_preferences: PaymentPreferences;
  taxes?: {
    percentage: string;
    inclusive: boolean;
  };
}

export interface Subscriber {
  name: {
    given_name: string;
    surname: string;
  };
  email_address: string;
}

export interface ApplicationContext {
  brand_name: string;
  locale: string;
  shipping_preference: string;
  user_action: string;
  payment_method: {
    payer_selected: string;
    payee_preferred: string;
  };
  return_url: string;
  cancel_url: string;
}

export interface SubscriptionData {
  plan_id: string;
  start_time?: string;
  quantity?: string;
  shipping_amount?: Amount;
  subscriber: Subscriber;
  application_context: ApplicationContext;
}

export interface ProductData {
  name: string;
  description?: string;
  type: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
  category: string;
  image_url?: string;
  home_url?: string;
}

export interface RefundData {
  amount?: Amount;
  invoice_id?: string;
  note_to_payer?: string;
}

export interface WebhookHeaders {
  'paypal-auth-algo': string;
  'paypal-cert-id': string;
  'paypal-transmission-id': string;
  'paypal-transmission-sig': string;
  'paypal-transmission-time': string;
}

declare class EasyPayPal {
  constructor(options?: PayPalOptions);

  // Authentication
  getAccessToken(): Promise<string>;
  makeRequest(method: string, endpoint: string, data?: any): Promise<any>;

  // Orders
  createOrder(orderData: Partial<OrderData>): Promise<CreatedOrder>;
  captureOrder(orderId: string): Promise<any>;
  getOrder(orderId: string): Promise<any>;

  // Subscriptions
  createSubscriptionPlan(planData: Partial<PlanData>): Promise<any>;
  createSubscription(subscriptionData: Partial<SubscriptionData>): Promise<any>;
  getSubscription(subscriptionId: string): Promise<any>;
  cancelSubscription(subscriptionId: string, reason?: string): Promise<any>;

  // Products
  createProduct(productData: Partial<ProductData>): Promise<any>;

  // Payments
  refund(captureId: string, refundData?: RefundData): Promise<any>;
  getPayment(paymentId: string): Promise<any>;

  // Webhooks
  verifyWebhook(headers: WebhookHeaders, body: any, webhookId: string): Promise<boolean>;

  // Helpers
  formatCurrency(amount: number, currency?: string): Amount;
  createSimplePayment(
    amount: number,
    currency?: string,
    description?: string,
    returnUrl?: string,
    cancelUrl?: string
  ): Promise<CreatedOrder>;
}

export = EasyPayPal;
