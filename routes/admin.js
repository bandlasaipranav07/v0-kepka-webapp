const express = require("express")
const { body, param, query, validationResult } = require("express-validator")
const { requireAdmin } = require("../middleware/auth")
const logger = require("../utils/logger")

const router = express.Router()

// Apply admin authentication to all routes
router.use(requireAdmin)

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get platform statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform statistics retrieved successfully
 */
router.get("/stats", async (req, res) => {
  try {
    const { data: stats, error } = await req.userSupabase.rpc("get_platform_stats")

    if (error) {
      return res.status(400).json({
        error: "Failed to retrieve platform statistics",
        message: error.message,
      })
    }

    // Get additional real-time stats
    const [{ data: recentUsers }, { data: recentTokens }, { data: recentTransactions }, { data: activeSubscriptions }] =
      await Promise.all([
        req.userSupabase
          .from("profiles")
          .select("id")
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        req.userSupabase
          .from("tokens")
          .select("id")
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        req.userSupabase
          .from("transactions")
          .select("id")
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        req.userSupabase.from("user_subscriptions").select("id").eq("status", "active"),
      ])

    const enhancedStats = {
      ...stats,
      recent_24h: {
        new_users: recentUsers?.length || 0,
        new_tokens: recentTokens?.length || 0,
        new_transactions: recentTransactions?.length || 0,
      },
      active_subscriptions: activeSubscriptions?.length || 0,
      server_uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
    }

    res.json({
      stats: enhancedStats,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error("Get admin stats error:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Unable to retrieve platform statistics",
    })
  }
})

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Admin]
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
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 */
router.get(
  "/users",
  [
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("offset").optional().isInt({ min: 0 }),
    query("search").optional().isLength({ min: 1 }),
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
      const { search } = req.query

      let query = req.userSupabase.from("profiles").select(
        `
          *,
          user_subscriptions (
            status,
            subscription_plans (name)
          )
        `,
        { count: "exact" },
      )

      if (search) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
      }

      const {
        data: users,
        error,
        count,
      } = await query.order("created_at", { ascending: false }).range(offset, offset + limit - 1)

      if (error) {
        return res.status(400).json({
          error: "Failed to retrieve users",
          message: error.message,
        })
      }

      res.json({
        users: users || [],
        pagination: {
          total: count,
          limit,
          offset,
          hasMore: count > offset + limit,
        },
      })
    } catch (error) {
      logger.error("Get admin users error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to retrieve users",
      })
    }
  },
)

/**
 * @swagger
 * /api/admin/users/{id}/suspend:
 *   post:
 *     summary: Suspend user account
 *     tags: [Admin]
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
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: User suspended successfully
 */
router.post(
  "/users/:id/suspend",
  [param("id").isUUID().withMessage("Invalid user ID"), body("reason").notEmpty().withMessage("Reason is required")],
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
      const { reason } = req.body

      // Update user profile to mark as suspended
      const { data: user, error: updateError } = await req.userSupabase
        .from("profiles")
        .update({
          is_suspended: true,
          suspension_reason: reason,
          suspended_at: new Date().toISOString(),
          suspended_by: req.user.id,
        })
        .eq("id", id)
        .select()
        .single()

      if (updateError || !user) {
        return res.status(404).json({
          error: "User not found",
          message: "User does not exist",
        })
      }

      // Log admin action
      await req.userSupabase.from("audit_logs").insert({
        user_id: req.user.id,
        action: "SUSPEND_USER",
        resource_type: "user",
        resource_id: id,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
        metadata: { reason, target_user: user.email },
      })

      logger.info(`User suspended: ${user.email} by admin ${req.user.email}`)

      res.json({
        message: "User suspended successfully",
        user: {
          id: user.id,
          email: user.email,
          is_suspended: user.is_suspended,
          suspension_reason: user.suspension_reason,
        },
      })
    } catch (error) {
      logger.error("Suspend user error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to suspend user",
      })
    }
  },
)

/**
 * @swagger
 * /api/admin/tokens:
 *   get:
 *     summary: Get all tokens (Admin only)
 *     tags: [Admin]
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
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tokens retrieved successfully
 */
router.get(
  "/tokens",
  [
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("offset").optional().isInt({ min: 0 }),
    query("search").optional().isLength({ min: 1 }),
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
      const { search } = req.query

      let query = req.userSupabase.from("tokens").select(
        `
          *,
          profiles (email, full_name)
        `,
        { count: "exact" },
      )

      if (search) {
        query = query.or(`token_name.ilike.%${search}%,symbol.ilike.%${search}%`)
      }

      const {
        data: tokens,
        error,
        count,
      } = await query.order("created_at", { ascending: false }).range(offset, offset + limit - 1)

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
      logger.error("Get admin tokens error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to retrieve tokens",
      })
    }
  },
)

/**
 * @swagger
 * /api/admin/reports:
 *   get:
 *     summary: Get token reports (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, investigating, resolved, dismissed]
 *     responses:
 *       200:
 *         description: Token reports retrieved successfully
 */
router.get(
  "/reports",
  [query("status").optional().isIn(["pending", "investigating", "resolved", "dismissed"])],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        })
      }

      const { status } = req.query

      let query = req.userSupabase.from("token_reports").select(
        `
          *,
          tokens (token_name, symbol),
          profiles!reporter_id (email, full_name),
          admin_users!resolved_by (user_id)
        `,
      )

      if (status) {
        query = query.eq("status", status)
      }

      const { data: reports, error } = await query.order("created_at", { ascending: false })

      if (error) {
        return res.status(400).json({
          error: "Failed to retrieve token reports",
          message: error.message,
        })
      }

      res.json({
        reports: reports || [],
      })
    } catch (error) {
      logger.error("Get admin reports error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to retrieve token reports",
      })
    }
  },
)

/**
 * @swagger
 * /api/admin/reports/{id}/resolve:
 *   post:
 *     summary: Resolve token report
 *     tags: [Admin]
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
 *               - admin_notes
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [resolved, dismissed]
 *               admin_notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report resolved successfully
 */
router.post(
  "/reports/:id/resolve",
  [
    param("id").isUUID().withMessage("Invalid report ID"),
    body("status").isIn(["resolved", "dismissed"]).withMessage("Invalid status"),
    body("admin_notes").notEmpty().withMessage("Admin notes are required"),
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
      const { status, admin_notes } = req.body

      const { data: report, error: updateError } = await req.userSupabase
        .from("token_reports")
        .update({
          status,
          admin_notes,
          resolved_by: req.adminUser.id,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single()

      if (updateError || !report) {
        return res.status(404).json({
          error: "Report not found",
          message: "Token report does not exist",
        })
      }

      // Log admin action
      await req.userSupabase.from("audit_logs").insert({
        user_id: req.user.id,
        action: "RESOLVE_REPORT",
        resource_type: "token_report",
        resource_id: id,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
        metadata: { status, admin_notes },
      })

      logger.info(`Token report resolved: ${id} by admin ${req.user.email}`)

      res.json({
        message: "Report resolved successfully",
        report,
      })
    } catch (error) {
      logger.error("Resolve report error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to resolve report",
      })
    }
  },
)

/**
 * @swagger
 * /api/admin/settings:
 *   get:
 *     summary: Get platform settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform settings retrieved successfully
 */
router.get("/settings", async (req, res) => {
  try {
    const { data: settings, error } = await req.userSupabase
      .from("platform_settings")
      .select("*")
      .order("setting_key", { ascending: true })

    if (error) {
      return res.status(400).json({
        error: "Failed to retrieve platform settings",
        message: error.message,
      })
    }

    res.json({
      settings: settings || [],
    })
  } catch (error) {
    logger.error("Get admin settings error:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Unable to retrieve platform settings",
    })
  }
})

/**
 * @swagger
 * /api/admin/settings/{key}:
 *   put:
 *     summary: Update platform setting
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - setting_value
 *             properties:
 *               setting_value:
 *                 oneOf:
 *                   - type: string
 *                   - type: number
 *                   - type: boolean
 *                   - type: object
 *                   - type: array
 *     responses:
 *       200:
 *         description: Setting updated successfully
 */
router.put(
  "/settings/:key",
  [param("key").notEmpty().withMessage("Setting key is required"), body("setting_value").exists()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        })
      }

      const { key } = req.params
      const { setting_value } = req.body

      const { data: setting, error: updateError } = await req.userSupabase
        .from("platform_settings")
        .update({
          setting_value: JSON.stringify(setting_value),
          updated_at: new Date().toISOString(),
          updated_by: req.user.id,
        })
        .eq("setting_key", key)
        .select()
        .single()

      if (updateError || !setting) {
        return res.status(404).json({
          error: "Setting not found",
          message: "Platform setting does not exist",
        })
      }

      // Log admin action
      await req.userSupabase.from("audit_logs").insert({
        user_id: req.user.id,
        action: "UPDATE_SETTING",
        resource_type: "platform_setting",
        resource_id: key,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
        metadata: { old_value: setting.setting_value, new_value: setting_value },
      })

      logger.info(`Platform setting updated: ${key} by admin ${req.user.email}`)

      res.json({
        message: "Setting updated successfully",
        setting,
      })
    } catch (error) {
      logger.error("Update admin setting error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to update setting",
      })
    }
  },
)

module.exports = router
