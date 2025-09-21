import Stripe from "stripe"

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey) {
  if (process.env.NODE_ENV === "production") {
    console.warn("STRIPE_SECRET_KEY is not set in production environment")
  } else {
    console.log("STRIPE_SECRET_KEY not set - Stripe functionality will be disabled")
  }
}

// Create Stripe instance only if secret key is available
export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
      typescript: true,
    })
  : null

const ensureStripe = () => {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.")
  }
  return stripe
}

export const getStripeCustomerByEmail = async (email: string) => {
  const stripeClient = ensureStripe()
  const customers = await stripeClient.customers.list({
    email,
    limit: 1,
  })
  return customers.data[0]
}

export const createStripeCustomer = async (email: string, name?: string) => {
  const stripeClient = ensureStripe()
  return await stripeClient.customers.create({
    email,
    name,
  })
}

export const createPaymentIntent = async (
  amount: number,
  currency = "usd",
  customerId?: string,
  metadata?: Record<string, string>,
) => {
  const stripeClient = ensureStripe()
  return await stripeClient.paymentIntents.create({
    amount,
    currency,
    customer: customerId,
    metadata,
    automatic_payment_methods: {
      enabled: true,
    },
  })
}

export const createSubscription = async (customerId: string, priceId: string, metadata?: Record<string, string>) => {
  const stripeClient = ensureStripe()
  return await stripeClient.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    metadata,
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.payment_intent"],
  })
}
