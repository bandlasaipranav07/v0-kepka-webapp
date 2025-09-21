const express = require("express")
const { body, param, query, validationResult } = require("express-validator")
const logger = require("../utils/logger")

const router = express.Router()

/**
 * @swagger
 * /api/security/multi-sig-wallets:
 *   get:
 *     summary: Get user's multi-signature wallets
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Multi-sig wallets retrieved successfully
 */
router.get("/multi-sig-wallets", async (req, res) => {
  try {
    const { data: wallets, error } = await req.userSupabase
      .from("multi_sig_wallets")
      .select(
        `
        *,
        wallet_signers (*)
      `,
      )
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return res.status(400).json({
        error: "Failed to retrieve multi-sig wallets",
        message: error.message,
      })
    }

    res.json({
      wallets: wallets || [],
    })
  } catch (error) {
    logger.error("Get multi-sig wallets error:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Unable to retrieve multi-sig wallets",
    })
  }
})

/**
 * @swagger
 * /api/security/multi-sig-wallets:
 *   post:
 *     summary: Create multi-signature wallet
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wallet_name
 *               - required_signatures
 *               - total_signers
 *               - wallet_address
 *               - script_hash
 *               - signers
 *             properties:
 *               wallet_name:
 *                 type: string
 *               required_signatures:
 *                 type: integer
 *                 minimum: 1
 *               total_signers:
 *                 type: integer
 *                 minimum: 1
 *               wallet_address:
 *                 type: string
 *               script_hash:
 *                 type: string
 *               signers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     signer_address:
 *                       type: string
 *                     signer_name:
 *                       type: string
 *                     public_key:
 *                       type: string
 *     responses:
 *       201:
 *         description: Multi-sig wallet created successfully
 */
router.post(
  "/multi-sig-wallets",
  [
    body("wallet_name").notEmpty().withMessage("Wallet name is required"),
    body("required_signatures").isInt({ min: 1 }).withMessage("Required signatures must be at least 1"),
    body("total_signers").isInt({ min: 1 }).withMessage("Total signers must be at least 1"),
    body("wallet_address").notEmpty().withMessage("Wallet address is required"),
    body("script_hash").notEmpty().withMessage("Script hash is required"),
    body("signers").isArray({ min: 1 }).withMessage("At least one signer is required"),
    body("signers.*.signer_address").notEmpty().withMessage("Signer address is required"),
    body("signers.*.public_key").notEmpty().withMessage("Public key is required"),
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

      const { wallet_name, required_signatures, total_signers, wallet_address, script_hash, signers } = req.body

      // Validate required signatures doesn't exceed total signers
      if (required_signatures > total_signers) {
        return res.status(400).json({
          error: "Invalid configuration",
          message: "Required signatures cannot exceed total signers",
        })
      }

      // Validate signers count matches total_signers
      if (signers.length !== total_signers) {
        return res.status(400).json({
          error: "Invalid configuration",
          message: "Number of signers must match total_signers",
        })
      }

      // Create multi-sig wallet
      const { data: wallet, error: walletError } = await req.userSupabase
        .from("multi_sig_wallets")
        .insert({
          user_id: req.user.id,
          wallet_name,
          required_signatures,
          total_signers,
          wallet_address,
          script_hash,
          is_active: true,
        })
        .select()
        .single()

      if (walletError) {
        return res.status(400).json({
          error: "Failed to create multi-sig wallet",
          message: walletError.message,
        })
      }

      // Add signers
      const signersData = signers.map((signer) => ({
        multi_sig_wallet_id: wallet.id,
        signer_address: signer.signer_address,
        signer_name: signer.signer_name || null,
        public_key: signer.public_key,
        is_verified: false,
      }))

      const { error: signersError } = await req.userSupabase.from("wallet_signers").insert(signersData)

      if (signersError) {
        // Rollback wallet creation
        await req.userSupabase.from("multi_sig_wallets").delete().eq("id", wallet.id)

        return res.status(400).json({
          error: "Failed to add signers",
          message: signersError.message,
        })
      }

      logger.info(`Multi-sig wallet created: ${wallet_name} by ${req.user.email}`)

      res.status(201).json({
        message: "Multi-sig wallet created successfully",
        wallet: {
          ...wallet,
          signers: signersData,
        },
      })
    } catch (error) {
      logger.error("Create multi-sig wallet error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to create multi-sig wallet",
      })
    }
  },
)

/**
 * @swagger
 * /api/security/multi-sig-wallets/{id}/signers:
 *   post:
 *     summary: Add signer to multi-sig wallet
 *     tags: [Security]
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
 *               - signer_address
 *               - public_key
 *             properties:
 *               signer_address:
 *                 type: string
 *               signer_name:
 *                 type: string
 *               public_key:
 *                 type: string
 *     responses:
 *       201:
 *         description: Signer added successfully
 */
router.post(
  "/multi-sig-wallets/:id/signers",
  [
    param("id").isUUID().withMessage("Invalid wallet ID"),
    body("signer_address").notEmpty().withMessage("Signer address is required"),
    body("public_key").notEmpty().withMessage("Public key is required"),
    body("signer_name").optional().isLength({ max: 100 }),
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

      const { id } = req.params
      const { signer_address, signer_name, public_key } = req.body

      // Verify wallet ownership
      const { data: wallet, error: walletError } = await req.userSupabase
        .from("multi_sig_wallets")
        .select("*")
        .eq("id", id)
        .eq("user_id", req.user.id)
        .single()

      if (walletError || !wallet) {
        return res.status(404).json({
          error: "Wallet not found",
          message: "Multi-sig wallet does not exist or you don't have access to it",
        })
      }

      // Check if signer already exists
      const { data: existingSigner } = await req.userSupabase
        .from("wallet_signers")
        .select("id")
        .eq("multi_sig_wallet_id", id)
        .eq("signer_address", signer_address)
        .single()

      if (existingSigner) {
        return res.status(409).json({
          error: "Signer already exists",
          message: "This signer address is already added to the wallet",
        })
      }

      // Add signer
      const { data: signer, error: signerError } = await req.userSupabase
        .from("wallet_signers")
        .insert({
          multi_sig_wallet_id: id,
          signer_address,
          signer_name,
          public_key,
          is_verified: false,
        })
        .select()
        .single()

      if (signerError) {
        return res.status(400).json({
          error: "Failed to add signer",
          message: signerError.message,
        })
      }

      logger.info(`Signer added to wallet ${id}: ${signer_address}`)

      res.status(201).json({
        message: "Signer added successfully",
        signer,
      })
    } catch (error) {
      logger.error("Add signer error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to add signer",
      })
    }
  },
)

/**
 * @swagger
 * /api/security/audit-logs:
 *   get:
 *     summary: Get user's audit logs
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 */
router.get(
  "/audit-logs",
  [
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("offset").optional().isInt({ min: 0 }),
    query("action").optional().isLength({ min: 1 }),
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

      const limit = Number.parseInt(req.query.limit) || 50
      const offset = Number.parseInt(req.query.offset) || 0
      const { action } = req.query

      let query = req.userSupabase.from("audit_logs").select("*", { count: "exact" }).eq("user_id", req.user.id)

      if (action) {
        query = query.eq("action", action)
      }

      const {
        data: logs,
        error,
        count,
      } = await query.order("created_at", { ascending: false }).range(offset, offset + limit - 1)

      if (error) {
        return res.status(400).json({
          error: "Failed to retrieve audit logs",
          message: error.message,
        })
      }

      res.json({
        logs: logs || [],
        pagination: {
          total: count,
          limit,
          offset,
          hasMore: count > offset + limit,
        },
      })
    } catch (error) {
      logger.error("Get audit logs error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to retrieve audit logs",
      })
    }
  },
)

/**
 * @swagger
 * /api/security/audit-logs:
 *   post:
 *     summary: Create audit log entry
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *               - resource_type
 *             properties:
 *               action:
 *                 type: string
 *               resource_type:
 *                 type: string
 *               resource_id:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Audit log created successfully
 */
router.post(
  "/audit-logs",
  [
    body("action").notEmpty().withMessage("Action is required"),
    body("resource_type").notEmpty().withMessage("Resource type is required"),
    body("resource_id").optional().isLength({ min: 1 }),
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

      const { action, resource_type, resource_id, metadata } = req.body

      const { data: log, error } = await req.userSupabase
        .from("audit_logs")
        .insert({
          user_id: req.user.id,
          action,
          resource_type,
          resource_id,
          ip_address: req.ip,
          user_agent: req.get("User-Agent"),
          metadata,
        })
        .select()
        .single()

      if (error) {
        return res.status(400).json({
          error: "Failed to create audit log",
          message: error.message,
        })
      }

      res.status(201).json({
        message: "Audit log created successfully",
        log,
      })
    } catch (error) {
      logger.error("Create audit log error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to create audit log",
      })
    }
  },
)

module.exports = router
