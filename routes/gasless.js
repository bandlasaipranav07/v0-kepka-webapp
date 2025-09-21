const express = require("express")
const { body, param, validationResult } = require("express-validator")
const logger = require("../utils/logger")

const router = express.Router()

/**
 * @swagger
 * /api/gasless/sponsor:
 *   post:
 *     summary: Sponsor a gasless transaction
 *     tags: [Gasless Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transaction_id
 *               - estimated_fee
 *             properties:
 *               transaction_id:
 *                 type: string
 *                 format: uuid
 *               estimated_fee:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Transaction sponsored successfully
 */
router.post(
  "/sponsor",
  [
    body("transaction_id").isUUID().withMessage("Invalid transaction ID"),
    body("estimated_fee").isInt({ min: 1 }).withMessage("Estimated fee must be a positive integer"),
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

      const { transaction_id, estimated_fee } = req.body

      // Validate transaction exists and belongs to user
      const { data: transaction, error: txError } = await req.userSupabase
        .from("transactions")
        .select("*")
        .eq("id", transaction_id)
        .eq("user_id", req.user.id)
        .single()

      if (txError || !transaction) {
        return res.status(404).json({
          error: "Transaction not found",
          message: "Transaction does not exist or you don't have access to it",
        })
      }

      // Check security policies
      const { data: policies } = await req.userSupabase
        .from("security_policies")
        .select("*")
        .eq("user_id", req.user.id)
        .eq("is_active", true)

      // Validate against rate limits and amount limits
      for (const policy of policies || []) {
        if (policy.policy_type === "rate_limit") {
          const config = policy.policy_config
          const hoursAgo = new Date(Date.now() - config.hours * 60 * 60 * 1000).toISOString()

          const { data: recentTxs } = await req.userSupabase
            .from("gasless_transactions")
            .select("id")
            .eq("user_id", req.user.id)
            .gte("created_at", hoursAgo)

          if ((recentTxs?.length || 0) >= config.max_transactions) {
            return res.status(429).json({
              error: "Rate limit exceeded",
              message: `Maximum ${config.max_transactions} gasless transactions per ${config.hours} hours`,
            })
          }
        }

        if (policy.policy_type === "amount_limit") {
          const config = policy.policy_config
          if (estimated_fee > config.max_amount) {
            return res.status(400).json({
              error: "Amount limit exceeded",
              message: `Maximum fee limit is ${config.max_amount} lovelace`,
            })
          }
        }
      }

      // Generate nonce
      const { data: nonceResult, error: nonceError } = await req.userSupabase.rpc("generate_transaction_nonce", {
        user_uuid: req.user.id,
      })

      if (nonceError) {
        logger.error("Nonce generation error:", nonceError)
        return res.status(500).json({
          error: "Failed to generate nonce",
          message: nonceError.message,
        })
      }

      const nonce = nonceResult || 1

      // Create gasless transaction record
      const { data: gaslessTransaction, error: gaslessError } = await req.userSupabase
        .from("gasless_transactions")
        .insert({
          user_id: req.user.id,
          transaction_id: transaction_id,
          sponsor_address: "addr1_kepka_sponsor_treasury_address",
          gas_fee_ada: estimated_fee,
          status: "sponsored",
          nonce: nonce,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
        })
        .select()
        .single()

      if (gaslessError) {
        return res.status(400).json({
          error: "Failed to sponsor transaction",
          message: gaslessError.message,
        })
      }

      logger.info(`Transaction sponsored: ${transaction_id} for user ${req.user.email}`)

      // Emit real-time update
      const io = req.app.get("io")
      io.to(`user-${req.user.id}`).emit("gasless-transaction-sponsored", gaslessTransaction)

      res.json({
        message: "Transaction sponsored successfully",
        gasless_transaction: {
          id: gaslessTransaction.id,
          sponsor_address: gaslessTransaction.sponsor_address,
          nonce: nonce,
          expires_at: gaslessTransaction.expires_at,
          status: gaslessTransaction.status,
        },
      })
    } catch (error) {
      logger.error("Sponsor transaction error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to sponsor transaction",
      })
    }
  },
)

/**
 * @swagger
 * /api/gasless/transactions:
 *   get:
 *     summary: Get user's gasless transactions
 *     tags: [Gasless Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gasless transactions retrieved successfully
 */
router.get("/transactions", async (req, res) => {
  try {
    const { data: gaslessTransactions, error } = await req.userSupabase
      .from("gasless_transactions")
      .select(
        `
        *,
        transactions (
          tx_hash,
          transaction_type,
          amount,
          tokens (token_name, symbol)
        )
      `,
      )
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return res.status(400).json({
        error: "Failed to retrieve gasless transactions",
        message: error.message,
      })
    }

    res.json({
      gasless_transactions: gaslessTransactions || [],
    })
  } catch (error) {
    logger.error("Get gasless transactions error:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Unable to retrieve gasless transactions",
    })
  }
})

/**
 * @swagger
 * /api/gasless/policies:
 *   get:
 *     summary: Get user's security policies
 *     tags: [Gasless Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Security policies retrieved successfully
 */
router.get("/policies", async (req, res) => {
  try {
    const { data: policies, error } = await req.userSupabase
      .from("security_policies")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return res.status(400).json({
        error: "Failed to retrieve security policies",
        message: error.message,
      })
    }

    res.json({
      policies: policies || [],
    })
  } catch (error) {
    logger.error("Get security policies error:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Unable to retrieve security policies",
    })
  }
})

/**
 * @swagger
 * /api/gasless/policies:
 *   post:
 *     summary: Create security policy
 *     tags: [Gasless Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - policy_name
 *               - policy_type
 *               - policy_config
 *             properties:
 *               policy_name:
 *                 type: string
 *               policy_type:
 *                 type: string
 *                 enum: [rate_limit, amount_limit, time_lock, whitelist]
 *               policy_config:
 *                 type: object
 *     responses:
 *       201:
 *         description: Security policy created successfully
 */
router.post(
  "/policies",
  [
    body("policy_name").notEmpty().withMessage("Policy name is required"),
    body("policy_type")
      .isIn(["rate_limit", "amount_limit", "time_lock", "whitelist"])
      .withMessage("Invalid policy type"),
    body("policy_config").isObject().withMessage("Policy config must be an object"),
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

      const { policy_name, policy_type, policy_config } = req.body

      const { data: policy, error } = await req.userSupabase
        .from("security_policies")
        .insert({
          user_id: req.user.id,
          policy_name,
          policy_type,
          policy_config,
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        return res.status(400).json({
          error: "Failed to create security policy",
          message: error.message,
        })
      }

      logger.info(`Security policy created: ${policy_name} by ${req.user.email}`)

      res.status(201).json({
        message: "Security policy created successfully",
        policy,
      })
    } catch (error) {
      logger.error("Create security policy error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to create security policy",
      })
    }
  },
)

module.exports = router
