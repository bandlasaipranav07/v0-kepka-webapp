const Stripe = require("stripe")
const logger = require("../utils/logger")

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set")
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  typescript: false,
})

// Test Stripe connection
const testStripeConnection = async () => {
  try {
    await stripe.accounts.retrieve()
    logger.info("✅ Stripe connection successful")
    return true
  } catch (error) {
    logger.error("❌ Stripe connection failed:", error.message)
    return false
  }
}

// Initialize Stripe connection test
testStripeConnection()

module.exports = {
  stripe,
  testStripeConnection,
}
