const express = require("express")
const { body, param, validationResult } = require("express-validator")
const { stripe } = require("../config/stripe")
const logger = require("../utils/logger")

const router = express.Router()

/**
 * @swagger
 * /api/payments/create-intent:
 *   post:
 *     summary: Create payment intent
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0.5
 *               currency:
 *                 type: string
 *                 default: usd
 *               description:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Payment intent created successfully
 */
router.post(
  "/create-intent",
  [
    body("amount").isFloat({ min: 0.5 }).withMessage("Amount must be at least $0.50"),
    body("currency").optional().isIn(["usd", "eur", "gbp"]).withMessage("Invalid currency"),
    body("description").optional().isLength({ max: 500 }),
    body("metadata").optional().isObject(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        })
      }

      const { amount, currency = "usd", description, metadata = {} } = req.body

      // Get or create Stripe customer
      let customer = await getStripeCustomerByEmail(req.user.email)
      if (!customer) {
        customer = await createStripeCustomer(req.user.email, req.profile?.full_name)
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        customer: customer.id,
        description,
        metadata: {
          user_id: req.user.id,
          ...metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      })

      // Store transaction in database
      const { error: dbError } = await req.userSupabase.from("payment_transactions").insert({
        user_id: req.user.id,
        stripe_payment_intent_id: paymentIntent.id,
        amount_cents: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: "pending",
        description,
        metadata,
      })

      if (dbError) {
        logger.error("Error storing payment transaction:", dbError)
      }

      logger.info(`Payment intent created: ${paymentIntent.id} for user ${req.user.email}`)

      res.json({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      })
    } catch (error) {
      logger.error("Create payment intent error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to create payment intent",
      })
    }
  },
)

/**
 * @swagger
 * /api/payments/plans:
 *   get:
 *     summary: Get subscription plans
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Subscription plans retrieved successfully
 */
router.get("/plans", async (req, res) => {
  try {
    const { data: plans, error } = await req.userSupabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("price_cents", { ascending: true })

    if (error) {
      return res.status(400).json({
        error: "Failed to retrieve subscription plans",
        message: error.message,
      })
    }

    res.json({
      plans: plans || [],
    })
  } catch (error) {
    logger.error("Get subscription plans error:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Unable to retrieve subscription plans",
    })
  }
})

/**
 * @swagger
 * /api/payments/subscriptions:
 *   get:
 *     summary: Get user subscription
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User subscription retrieved successfully
 */
router.get("/subscriptions", async (req, res) => {
  try {
    const { data: subscription } = await req.userSupabase
      .from("user_subscriptions")
      .select(
        `
        *,
        subscription_plans (*)
      `,
      )
      .eq("user_id", req.user.id)
      .single()

    res.json({
      subscription: subscription || null,
    })
  } catch (error) {
    logger.error("Get subscription error:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Unable to retrieve subscription",
    })
  }
})

/**
 * @swagger
 * /api/payments/subscriptions:
 *   post:
 *     summary: Create subscription
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - price_id
 *             properties:
 *               price_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subscription created successfully
 */
router.post("/subscriptions", [body("price_id").notEmpty().withMessage("Price ID is required")], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      })
    }

    const { price_id } = req.body

    // Get or create Stripe customer
    let customer = await getStripeCustomerByEmail(req.user.email)
    if (!customer) {
      customer = await createStripeCustomer(req.user.email, req.profile?.full_name)
    }

    // Create subscription
    const subscription = await createSubscription(customer.id, price_id, { user_id: req.user.id })

    // Store subscription in database
    const { data: plan } = await req.userSupabase
      .from("subscription_plans")
      .select("id")
      .eq("stripe_price_id", price_id)
      .single()

    await req.userSupabase.from("user_subscriptions").upsert({
      user_id: req.user.id,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      plan_id: plan?.id,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })

    logger.info(`Subscription created: ${subscription.id} for user ${req.user.email}`)

    const invoice = subscription.latest_invoice
    const paymentIntent = invoice?.payment_intent

    res.json({
      subscription_id: subscription.id,
      client_secret: paymentIntent?.client_secret,
    })
  } catch (error) {
    logger.error("Create subscription error:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Unable to create subscription",
    })
  }
})

/**
 * @swagger
 * /api/payments/subscriptions/{id}/cancel:
 *   post:
 *     summary: Cancel subscription
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 */
router.post(
  "/subscriptions/:id/cancel",
  [param("id").notEmpty().withMessage("Subscription ID is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        })
      }

      const { id } = req.params

      // Verify subscription belongs to user
      const { data: userSubscription, error: subError } = await req.userSupabase
        .from("user_subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", req.user.id)
        .eq("stripe_subscription_id", id)
        .single()

      if (subError || !userSubscription) {
        return res.status(404).json({
          error: "Subscription not found",
          message: "Subscription does not exist or you don't have access to it",
        })
      }

      // Cancel subscription in Stripe
      const subscription = await stripe.subscriptions.update(id, {
        cancel_at_period_end: true,
      })

      // Update database
      await req.userSupabase
        .from("user_subscriptions")
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", id)

      logger.info(`Subscription cancelled: ${id} for user ${req.user.email}`)

      res.json({
        message: "Subscription will be cancelled at the end of the current period",
        subscription: {
          id: subscription.id,
          cancel_at_period_end: subscription.cancel_at_period_end,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        },
      })
    } catch (error) {
      logger.error("Cancel subscription error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to cancel subscription",
      })
    }
  },
)

/**
 * @swagger
 * /api/payments/transactions:
 *   get:
 *     summary: Get payment transactions
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment transactions retrieved successfully
 */
router.get("/transactions", async (req, res) => {
  try {
    const { data: transactions, error } = await req.userSupabase
      .from("payment_transactions")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      return res.status(400).json({
        error: "Failed to retrieve payment transactions",
        message: error.message,
      })
    }

    res.json({
      transactions: transactions || [],
    })
  } catch (error) {
    logger.error("Get payment transactions error:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Unable to retrieve payment transactions",
    })
  }
})

/**
 * @swagger
 * /api/payments/webhooks:
 *   post:
 *     summary: Stripe webhook handler
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
router.post("/webhooks", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"]
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err) {
    logger.error("Webhook signature verification failed:", err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object

        await req.userSupabase
          .from("payment_transactions")
          .update({ status: "succeeded", updated_at: new Date().toISOString() })
          .eq("stripe_payment_intent_id", paymentIntent.id)

        logger.info(`Payment succeeded: ${paymentIntent.id}`)
        break
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object

        await req.userSupabase
          .from("payment_transactions")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("stripe_payment_intent_id", paymentIntent.id)

        logger.info(`Payment failed: ${paymentIntent.id}`)
        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object

        const { data: existingSubscription } = await req.userSupabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", subscription.customer)
          .single()

        if (existingSubscription) {
          await req.userSupabase
            .from("user_subscriptions")
            .update({
              stripe_subscription_id: subscription.id,
              status: subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_customer_id", subscription.customer)
        }

        logger.info(`Subscription updated: ${subscription.id}`)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object

        await req.userSupabase
          .from("user_subscriptions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id)

        logger.info(`Subscription canceled: ${subscription.id}`)
        break
      }

      default:
        logger.info(`Unhandled event type: ${event.type}`)
    }

    res.json({ received: true })
  } catch (error) {
    logger.error("Webhook handler error:", error)
    res.status(500).json({ error: "Webhook handler failed" })
  }
})

// Helper functions
async function getStripeCustomerByEmail(email) {
  const customers = await stripe.customers.list({
    email,
    limit: 1,
  })
  return customers.data[0]
}

async function createStripeCustomer(email, name) {
  return await stripe.customers.create({
    email,
    name,
  })
}

async function createSubscription(customerId, priceId, metadata) {
  return await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    metadata,
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.payment_intent"],
  })
}

module.exports = router
