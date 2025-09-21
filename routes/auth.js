const express = require("express")
const { body, validationResult } = require("express-validator")
const rateLimit = require("express-rate-limit")
const { supabase } = require("../config/database")
const logger = require("../utils/logger")

const router = express.Router()

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for auth
  message: "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - full_name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               full_name:
 *                 type: string
 *                 minLength: 2
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post(
  "/signup",
  authLimiter,
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("full_name").isLength({ min: 2 }).withMessage("Full name must be at least 2 characters"),
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

      const { email, password, full_name } = req.body

      // Check if user already exists
      const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email)
      if (existingUser.user) {
        return res.status(409).json({
          error: "User already exists",
          message: "A user with this email already exists",
        })
      }

      // Create user with Supabase Auth
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        user_metadata: {
          full_name,
        },
        email_confirm: true,
      })

      if (error) {
        logger.error("Signup error:", error)
        return res.status(400).json({
          error: "Signup failed",
          message: error.message,
        })
      }

      // Create profile record
      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        email: data.user.email,
        full_name,
      })

      if (profileError) {
        logger.error("Profile creation error:", profileError)
        // Don't fail the signup if profile creation fails
      }

      logger.info(`New user registered: ${email}`)

      res.status(201).json({
        message: "User created successfully",
        user: {
          id: data.user.id,
          email: data.user.email,
          full_name,
        },
      })
    } catch (error) {
      logger.error("Signup error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to create user account",
      })
    }
  },
)

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post(
  "/login",
  authLimiter,
  [body("email").isEmail().normalizeEmail(), body("password").notEmpty().withMessage("Password is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        })
      }

      const { email, password } = req.body

      // Authenticate with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        logger.warn(`Failed login attempt for: ${email}`)
        return res.status(401).json({
          error: "Authentication failed",
          message: "Invalid email or password",
        })
      }

      // Get user profile
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single()

      logger.info(`User logged in: ${email}`)

      res.json({
        message: "Login successful",
        user: {
          id: data.user.id,
          email: data.user.email,
          full_name: profile?.full_name,
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      })
    } catch (error) {
      logger.error("Login error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to process login",
      })
    }
  },
)

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post(
  "/refresh",
  [body("refresh_token").notEmpty().withMessage("Refresh token is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        })
      }

      const { refresh_token } = req.body

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token,
      })

      if (error) {
        return res.status(401).json({
          error: "Token refresh failed",
          message: error.message,
        })
      }

      res.json({
        message: "Token refreshed successfully",
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      })
    } catch (error) {
      logger.error("Token refresh error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to refresh token",
      })
    }
  },
)

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1]

    if (token) {
      // Sign out from Supabase
      const { error } = await supabase.auth.admin.signOut(token)
      if (error) {
        logger.warn("Logout error:", error)
      }
    }

    res.json({
      message: "Logout successful",
    })
  } catch (error) {
    logger.error("Logout error:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Unable to process logout",
    })
  }
})

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent
 */
router.post("/forgot-password", authLimiter, [body("email").isEmail().normalizeEmail()], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      })
    }

    const { email } = req.body

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/auth/reset-password`,
    })

    if (error) {
      logger.error("Password reset error:", error)
      return res.status(400).json({
        error: "Password reset failed",
        message: error.message,
      })
    }

    // Always return success to prevent email enumeration
    res.json({
      message: "If an account with that email exists, a password reset link has been sent.",
    })
  } catch (error) {
    logger.error("Password reset error:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Unable to process password reset",
    })
  }
})

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - access_token
 *               - refresh_token
 *               - new_password
 *             properties:
 *               access_token:
 *                 type: string
 *               refresh_token:
 *                 type: string
 *               new_password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successful
 */
router.post(
  "/reset-password",
  [
    body("access_token").notEmpty().withMessage("Access token is required"),
    body("refresh_token").notEmpty().withMessage("Refresh token is required"),
    body("new_password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
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

      const { access_token, refresh_token, new_password } = req.body

      // Set session
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })

      if (sessionError) {
        return res.status(401).json({
          error: "Invalid session",
          message: sessionError.message,
        })
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: new_password,
      })

      if (error) {
        return res.status(400).json({
          error: "Password update failed",
          message: error.message,
        })
      }

      res.json({
        message: "Password reset successful",
      })
    } catch (error) {
      logger.error("Password reset error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to reset password",
      })
    }
  },
)

module.exports = router
