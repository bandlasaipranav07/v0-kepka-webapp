const express = require("express")
const { body, param, query, validationResult } = require("express-validator")
const logger = require("../utils/logger")

const router = express.Router()

/**
 * @swagger
 * /api/tokens:
 *   get:
 *     summary: Get user's tokens
 *     tags: [Tokens]
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
 *     responses:
 *       200:
 *         description: Tokens retrieved successfully
 */
router.get(
  "/",
  [query("limit").optional().isInt({ min: 1, max: 100 }), query("offset").optional().isInt({ min: 0 })],
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

      const {
        data: tokens,
        error,
        count,
      } = await req.userSupabase
        .from("tokens")
        .select("*", { count: "exact" })
        .eq("creator_id", req.user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        return res.status(400).json({
          error: "Failed to retrieve tokens",
          message: error.message,
        })
      }

      res.json({
        tokens: tokens || [],
        pagination: {
          total: count,
          limit,
          offset,
          hasMore: count > offset + limit,
        },
      })
    } catch (error) {
      logger.error("Get tokens error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to retrieve tokens",
      })
    }
  },
)

/**
 * @swagger
 * /api/tokens/{id}:
 *   get:
 *     summary: Get token by ID
 *     tags: [Tokens]
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
 *         description: Token retrieved successfully
 *       404:
 *         description: Token not found
 */
router.get("/:id", [param("id").isUUID().withMessage("Invalid token ID")], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      })
    }

    const { data: token, error } = await req.userSupabase
      .from("tokens")
      .select("*")
      .eq("id", req.params.id)
      .eq("creator_id", req.user.id)
      .single()

    if (error || !token) {
      return res.status(404).json({
        error: "Token not found",
        message: "Token does not exist or you don't have access to it",
      })
    }

    res.json({ token })
  } catch (error) {
    logger.error("Get token error:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Unable to retrieve token",
    })
  }
})

/**
 * @swagger
 * /api/tokens:
 *   post:
 *     summary: Create a new token
 *     tags: [Tokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token_name
 *               - symbol
 *               - policy_id
 *               - asset_name
 *             properties:
 *               token_name:
 *                 type: string
 *               symbol:
 *                 type: string
 *               policy_id:
 *                 type: string
 *               asset_name:
 *                 type: string
 *               decimals:
 *                 type: integer
 *               total_supply:
 *                 type: integer
 *               description:
 *                 type: string
 *               image_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Token created successfully
 */
router.post(
  "/",
  [
    body("token_name").notEmpty().withMessage("Token name is required"),
    body("symbol").notEmpty().withMessage("Symbol is required"),
    body("policy_id").notEmpty().withMessage("Policy ID is required"),
    body("asset_name").notEmpty().withMessage("Asset name is required"),
    body("decimals").optional().isInt({ min: 0, max: 18 }),
    body("total_supply").optional().isInt({ min: 0 }),
    body("description").optional().isLength({ max: 1000 }),
    body("image_url").optional().isURL(),
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

      const {
        token_name,
        symbol,
        policy_id,
        asset_name,
        decimals = 6,
        total_supply = 0,
        description,
        image_url,
      } = req.body

      const { data: token, error } = await req.userSupabase
        .from("tokens")
        .insert({
          token_name,
          symbol,
          policy_id,
          asset_name,
          decimals,
          total_supply,
          description,
          image_url,
          creator_id: req.user.id,
        })
        .select()
        .single()

      if (error) {
        return res.status(400).json({
          error: "Failed to create token",
          message: error.message,
        })
      }

      logger.info(`Token created: ${token_name} by ${req.user.email}`)

      // Emit real-time update
      const io = req.app.get("io")
      io.to(`user-${req.user.id}`).emit("token-created", token)

      res.status(201).json({
        message: "Token created successfully",
        token,
      })
    } catch (error) {
      logger.error("Create token error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to create token",
      })
    }
  },
)

/**
 * @swagger
 * /api/tokens/{id}:
 *   put:
 *     summary: Update token
 *     tags: [Tokens]
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
 *             properties:
 *               description:
 *                 type: string
 *               image_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token updated successfully
 */
router.put(
  "/:id",
  [
    param("id").isUUID().withMessage("Invalid token ID"),
    body("description").optional().isLength({ max: 1000 }),
    body("image_url").optional().isURL(),
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
      if (req.body.description !== undefined) updateData.description = req.body.description
      if (req.body.image_url !== undefined) updateData.image_url = req.body.image_url
      updateData.updated_at = new Date().toISOString()

      const { data: token, error } = await req.userSupabase
        .from("tokens")
        .update(updateData)
        .eq("id", req.params.id)
        .eq("creator_id", req.user.id)
        .select()
        .single()

      if (error || !token) {
        return res.status(404).json({
          error: "Token not found",
          message: "Token does not exist or you don't have access to it",
        })
      }

      logger.info(`Token updated: ${token.token_name} by ${req.user.email}`)

      res.json({
        message: "Token updated successfully",
        token,
      })
    } catch (error) {
      logger.error("Update token error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to update token",
      })
    }
  },
)

module.exports = router
