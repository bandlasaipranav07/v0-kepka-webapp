const express = require("express")
const { body, validationResult } = require("express-validator")
const logger = require("../utils/logger")

const router = express.Router()

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 */
router.get("/profile", async (req, res) => {
  try {
    const { data: profile, error } = await req.userSupabase.from("profiles").select("*").eq("id", req.user.id).single()

    if (error) {
      return res.status(404).json({
        error: "Profile not found",
        message: error.message,
      })
    }

    res.json({
      profile: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        wallet_address: profile.wallet_address,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
    })
  } catch (error) {
    logger.error("Get profile error:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Unable to retrieve profile",
    })
  }
})

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *               wallet_address:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put(
  "/profile",
  [
    body("full_name").optional().isLength({ min: 2 }).withMessage("Full name must be at least 2 characters"),
    body("wallet_address").optional().isLength({ min: 10 }).withMessage("Invalid wallet address"),
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

      const updateData = {}
      if (req.body.full_name) updateData.full_name = req.body.full_name
      if (req.body.wallet_address) updateData.wallet_address = req.body.wallet_address

      updateData.updated_at = new Date().toISOString()

      const { data, error } = await req.userSupabase
        .from("profiles")
        .update(updateData)
        .eq("id", req.user.id)
        .select()
        .single()

      if (error) {
        return res.status(400).json({
          error: "Update failed",
          message: error.message,
        })
      }

      logger.info(`Profile updated for user: ${req.user.email}`)

      res.json({
        message: "Profile updated successfully",
        profile: data,
      })
    } catch (error) {
      logger.error("Update profile error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to update profile",
      })
    }
  },
)

/**
 * @swagger
 * /api/users/wallet-connections:
 *   get:
 *     summary: Get user wallet connections
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet connections retrieved successfully
 */
router.get("/wallet-connections", async (req, res) => {
  try {
    const { data: wallets, error } = await req.userSupabase
      .from("wallet_connections")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return res.status(400).json({
        error: "Failed to retrieve wallets",
        message: error.message,
      })
    }

    res.json({
      wallets: wallets || [],
    })
  } catch (error) {
    logger.error("Get wallet connections error:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Unable to retrieve wallet connections",
    })
  }
})

/**
 * @swagger
 * /api/users/wallet-connections:
 *   post:
 *     summary: Add wallet connection
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wallet_address
 *               - wallet_type
 *             properties:
 *               wallet_address:
 *                 type: string
 *               wallet_type:
 *                 type: string
 *                 enum: [nami, eternl, flint, yoroi, lace]
 *               is_primary:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Wallet connection added successfully
 */
router.post(
  "/wallet-connections",
  [
    body("wallet_address").notEmpty().withMessage("Wallet address is required"),
    body("wallet_type").isIn(["nami", "eternl", "flint", "yoroi", "lace"]).withMessage("Invalid wallet type"),
    body("is_primary").optional().isBoolean(),
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

      const { wallet_address, wallet_type, is_primary = false } = req.body

      // If setting as primary, unset other primary wallets
      if (is_primary) {
        await req.userSupabase.from("wallet_connections").update({ is_primary: false }).eq("user_id", req.user.id)
      }

      const { data, error } = await req.userSupabase
        .from("wallet_connections")
        .insert({
          user_id: req.user.id,
          wallet_address,
          wallet_type,
          is_primary,
        })
        .select()
        .single()

      if (error) {
        return res.status(400).json({
          error: "Failed to add wallet connection",
          message: error.message,
        })
      }

      logger.info(`Wallet connected for user: ${req.user.email}`)

      res.status(201).json({
        message: "Wallet connection added successfully",
        wallet: data,
      })
    } catch (error) {
      logger.error("Add wallet connection error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to add wallet connection",
      })
    }
  },
)

module.exports = router
