const { supabase } = require("../config/database")
const logger = require("../utils/logger")

async function seedExchangeRates() {
  logger.info("Seeding exchange rates...")

  const exchangeRates = [
    {
      token_symbol: "ADA",
      price_usd: 1.25,
      price_ada: 1.0,
      volume_24h: 2500000.0,
      change_24h: 3.2,
      market_cap: 42000000000.0,
    },
    {
      token_symbol: "KEPKA",
      price_usd: 0.75,
      price_ada: 0.6,
      volume_24h: 125000.0,
      change_24h: 12.5,
      market_cap: 7500000.0,
    },
    {
      token_symbol: "SUNDAE",
      price_usd: 0.045,
      price_ada: 0.036,
      volume_24h: 85000.0,
      change_24h: -2.1,
      market_cap: 45000000.0,
    },
    {
      token_symbol: "MIN",
      price_usd: 0.012,
      price_ada: 0.0096,
      volume_24h: 45000.0,
      change_24h: 5.8,
      market_cap: 12000000.0,
    },
  ]

  const { data, error } = await supabase.from("exchange_rates").upsert(exchangeRates, { onConflict: "token_symbol" })

  if (error) {
    logger.error("Error seeding exchange rates:", error)
  } else {
    logger.info(`Seeded ${exchangeRates.length} exchange rates`)
  }
}

async function seedSubscriptionPlans() {
  logger.info("Seeding subscription plans...")

  const plans = [
    {
      stripe_price_id: "price_basic_monthly",
      name: "Basic Plan",
      description: "Perfect for getting started with Kepka",
      price_cents: 999,
      currency: "usd",
      interval: "month",
      features: JSON.stringify(["Up to 5 tokens", "Basic minting", "Standard support"]),
      is_active: true,
    },
    {
      stripe_price_id: "price_pro_monthly",
      name: "Pro Plan",
      description: "Advanced features for serious token creators",
      price_cents: 2999,
      currency: "usd",
      interval: "month",
      features: JSON.stringify([
        "Unlimited tokens",
        "Advanced minting",
        "Gasless transactions",
        "Priority support",
        "Analytics dashboard",
      ]),
      is_active: true,
    },
    {
      stripe_price_id: "price_enterprise_monthly",
      name: "Enterprise Plan",
      description: "Full-featured plan for businesses",
      price_cents: 9999,
      currency: "usd",
      interval: "month",
      features: JSON.stringify([
        "Everything in Pro",
        "Multi-signature wallets",
        "Custom integrations",
        "Dedicated support",
        "White-label options",
      ]),
      is_active: true,
    },
  ]

  const { data, error } = await supabase.from("subscription_plans").upsert(plans, { onConflict: "stripe_price_id" })

  if (error) {
    logger.error("Error seeding subscription plans:", error)
  } else {
    logger.info(`Seeded ${plans.length} subscription plans`)
  }
}

async function seedPlatformSettings() {
  logger.info("Seeding platform settings...")

  const settings = [
    {
      setting_key: "max_daily_gasless_transactions",
      setting_value: JSON.stringify(10),
      setting_type: "number",
      description: "Maximum gasless transactions per user per day",
      is_public: true,
    },
    {
      setting_key: "min_token_creation_fee",
      setting_value: JSON.stringify(2000000),
      setting_type: "number",
      description: "Minimum fee for token creation in lovelace",
      is_public: true,
    },
    {
      setting_key: "platform_fee_percentage",
      setting_value: JSON.stringify(0.5),
      setting_type: "number",
      description: "Platform fee percentage for transactions",
      is_public: true,
    },
    {
      setting_key: "maintenance_mode",
      setting_value: JSON.stringify(false),
      setting_type: "boolean",
      description: "Enable maintenance mode",
      is_public: false,
    },
    {
      setting_key: "supported_wallets",
      setting_value: JSON.stringify(["nami", "eternl", "flint", "lace", "yoroi"]),
      setting_type: "array",
      description: "List of supported wallet types",
      is_public: true,
    },
  ]

  const { data, error } = await supabase.from("platform_settings").upsert(settings, { onConflict: "setting_key" })

  if (error) {
    logger.error("Error seeding platform settings:", error)
  } else {
    logger.info(`Seeded ${settings.length} platform settings`)
  }
}

async function main() {
  try {
    logger.info("Starting data seeding...")

    await seedExchangeRates()
    await seedSubscriptionPlans()
    await seedPlatformSettings()

    logger.info("Data seeding completed successfully!")
    process.exit(0)
  } catch (error) {
    logger.error("Data seeding failed:", error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = {
  seedExchangeRates,
  seedSubscriptionPlans,
  seedPlatformSettings,
}
