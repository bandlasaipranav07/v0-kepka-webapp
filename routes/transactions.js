const express = require("express")
const { body, param, query, validationResult } = require("express-validator")
const logger = require("../utils/logger")

const router = express.Router()

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Get user's transactions
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [mint, burn, transfer]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, failed]
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 */
router.get(
  "/",
  [
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("offset").optional().isInt({ min: 0 }),
    query("type").optional().isIn(["mint", "burn", "transfer"]),
    query("status").optional().isIn(["pending", "confirmed", "failed"]),
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

      const limit = Number.parseInt(req.query.limit) || 20
      const offset = Number.parseInt(req.query.offset) || 0
      const { type, status } = req.query

      let query = req.userSupabase
        .from("transactions")
        .select(
          `
          *,
          tokens (token_name, symbol)
        `,
          { count: "exact" },
        )
        .eq("user_id", req.user.id)

      if (type) query = query.eq("transaction_type", type)
      if (status) query = query.eq("status", status)

      const {
        data: transactions,
        error,
        count,
      } = await query.order("created_at", { ascending: false }).range(offset, offset + limit - 1)

      if (error) {
        return res.status(400).json({
          error: "Failed to retrieve transactions",
          message: error.message,
        })
      }

      res.json({
        transactions: transactions || [],
        pagination: {
          total: count,
          limit,
          offset,
          hasMore: count > offset + limit,
        },
      })
    } catch (error) {
      logger.error("Get transactions error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to retrieve transactions",
      })
    }
  },
)

/**
 * @swagger
 * /api/transactions/{id}:
 *   get:
 *     summary: Get transaction by ID
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Transaction retrieved successfully
 */
router.get("/:id", [param("id").isUUID().withMessage("Invalid transaction ID")], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      })
    }

    const { data: transaction, error } = await req.userSupabase
      .from("transactions")
      .select(
        `
        *,
        tokens (token_name, symbol),
        gasless_transactions (*)
      `,
      )
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .single()

    if (error || !transaction) {
      return res.status(404).json({
        error: "Transaction not found",
        message: "Transaction does not exist or you don't have access to it",
      })
    }

    res.json({ transaction })
  } catch (error) {
    logger.error("Get transaction error:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Unable to retrieve transaction",
    })
  }
})

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Create a new transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token_id
 *               - transaction_type
 *               - amount
 *               - tx_hash
 *             properties:
 *               token_id:
 *                 type: string
 *                 format: uuid
 *               transaction_type:
 *                 type: string
 *                 enum: [mint, burn, transfer]
 *               amount:
 *                 type: integer
 *               tx_hash:
 *                 type: string
 *               fee_ada:
 *                 type: integer
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Transaction created successfully
 */
router.post(
  "/",
  [
    body("token_id").isUUID().withMessage("Invalid token ID"),
    body("transaction_type").isIn(["mint", "burn", "transfer"]).withMessage("Invalid transaction type"),
    body("amount").isInt({ min: 1 }).withMessage("Amount must be a positive integer"),
    body("tx_hash").notEmpty().withMessage("Transaction hash is required"),
    body("fee_ada").optional().isInt({ min: 0 }),
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

      const { token_id, transaction_type, amount, tx_hash, fee_ada = 0, metadata } = req.body

      // Verify token ownership
      const { data: token, error: tokenError } = await req.userSupabase
        .from("tokens")
        .select("id")
        .eq("id", token_id)
        .eq("creator_id", req.user.id)
        .single()

      if (tokenError || !token) {
        return res.status(404).json({
          error: "Token not found",
          message: "Token does not exist or you don't have access to it",
        })
      }

      const { data: transaction, error } = await req.userSupabase
        .from("transactions")
        .insert({
          token_id,
          user_id: req.user.id,
          transaction_type,
          amount,
          tx_hash,
          fee_ada,
          metadata,
          status: "pending",
        })
        .select()
        .single()

      if (error) {
        return res.status(400).json({
          error: "Failed to create transaction",
          message: error.message,
        })
      }

      logger.info(`Transaction created: ${transaction_type} ${amount} tokens by ${req.user.email}`)

      // Emit real-time update
      const io = req.app.get("io")
      io.to(`user-${req.user.id}`).emit("transaction-created", transaction)

      res.status(201).json({
        message: "Transaction created successfully",
        transaction,
      })
    } catch (error) {
      logger.error("Create transaction error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to create transaction",
      })
    }
  },
)

/**
 * @swagger
 * /api/transactions/{id}/status:
 *   patch:
 *     summary: Update transaction status
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, failed]
 *     responses:
 *       200:
 *         description: Transaction status updated successfully
 */
router.patch(
  "/:id/status",
  [
    param("id").isUUID().withMessage("Invalid transaction ID"),
    body("status").isIn(["pending", "confirmed", "failed"]).withMessage("Invalid status"),
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

      const { status } = req.body

      const { data: transaction, error } = await req.userSupabase
        .from("transactions")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.params.id)
        .eq("user_id", req.user.id)
        .select()
        .single()

      if (error || !transaction) {
        return res.status(404).json({
          error: "Transaction not found",
          message: "Transaction does not exist or you don't have access to it",
        })
      }

      logger.info(`Transaction status updated: ${req.params.id} to ${status}`)

      // Emit real-time update
      const io = req.app.get("io")
      io.to(`user-${req.user.id}`).emit("transaction-updated", transaction)

      res.json({
        message: "Transaction status updated successfully",
        transaction,
      })
    } catch (error) {
      logger.error("Update transaction status error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to update transaction status",
      })
    }
  },
)

module.exports = router
