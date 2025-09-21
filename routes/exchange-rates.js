const express = require("express")
const { body, validationResult } = require("express-validator")
const logger = require("../utils/logger")
const { supabase } = require("../config/database")

const router = express.Router()

/**
 * @swagger
 * /api/exchange-rates:
 *   get:
 *     summary: Get all exchange rates
 *     tags: [Exchange Rates]
 *     responses:
 *       200:
 *         description: Exchange rates retrieved successfully
 */
router.get("/", async (req, res) => {
  try {
    const { data: rates, error } = await supabase
      .from("exchange_rates")
      .select("*")
      .order("updated_at", { ascending: false })

    if (error) {
      return res.status(400).json({
        error: "Failed to retrieve exchange rates",
        message: error.message,
      })
    }

    res.json({
      rates: rates || [],
      last_updated: rates?.[0]?.updated_at || null,
    })
  } catch (error) {
    logger.error("Get exchange rates error:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Unable to retrieve exchange rates",
    })
  }
})

/**
 * @swagger
 * /api/exchange-rates/{symbol}:
 *   get:
 *     summary: Get exchange rate for specific token
 *     tags: [Exchange Rates]
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exchange rate retrieved successfully
 */
router.get("/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params

    const { data: rate, error } = await supabase
      .from("exchange_rates")
      .select("*")
      .eq("token_symbol", symbol.toUpperCase())
      .single()

    if (error || !rate) {
      return res.status(404).json({
        error: "Exchange rate not found",
        message: `No exchange rate found for symbol: ${symbol}`,
      })
    }

    res.json({ rate })
  } catch (error) {
    logger.error("Get exchange rate error:", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Unable to retrieve exchange rate",
    })
  }
})

/**
 * @swagger
 * /api/exchange-rates:
 *   post:
 *     summary: Update exchange rates (Admin only)
 *     tags: [Exchange Rates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               required:
 *                 - token_symbol
 *                 - price_usd
 *                 - price_ada
 *               properties:
 *                 token_symbol:
 *                   type: string
 *                 price_usd:
 *                   type: number
 *                 price_ada:
 *                   type: number
 *                 volume_24h:
 *                   type: number
 *                 change_24h:
 *                   type: number
 *                 market_cap:
 *                   type: number
 *     responses:
 *       200:
 *         description: Exchange rates updated successfully
 */
router.post(
  "/",
  [
    body("*.token_symbol").notEmpty().withMessage("Token symbol is required"),
    body("*.price_usd").isFloat({ min: 0 }).withMessage("Price USD must be a positive number"),
    body("*.price_ada").isFloat({ min: 0 }).withMessage("Price ADA must be a positive number"),
    body("*.volume_24h").optional().isFloat({ min: 0 }),
    body("*.change_24h").optional().isFloat(),
    body("*.market_cap").optional().isFloat({ min: 0 }),
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

      const rates = Array.isArray(req.body) ? req.body : [req.body]

      // Prepare data for upsert
      const ratesData = rates.map((rate) => ({
        token_symbol: rate.token_symbol.toUpperCase(),
        price_usd: rate.price_usd,
        price_ada: rate.price_ada,
        volume_24h: rate.volume_24h || 0,
        change_24h: rate.change_24h || 0,
        market_cap: rate.market_cap || 0,
        updated_at: new Date().toISOString(),
      }))

      const { data, error } = await supabase
        .from("exchange_rates")
        .upsert(ratesData, { onConflict: "token_symbol" })
        .select()

      if (error) {
        return res.status(400).json({
          error: "Failed to update exchange rates",
          message: error.message,
        })
      }

      logger.info(`Exchange rates updated for ${data.length} tokens`)

      res.json({
        message: "Exchange rates updated successfully",
        rates: data,
      })
    } catch (error) {
      logger.error("Update exchange rates error:", error)
      res.status(500).json({
        error: "Internal server error",
        message: "Unable to update exchange rates",
      })
    }
  },
)

module.exports = router
