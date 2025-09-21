const logger = require("../utils/logger")

const errorHandler = (err, req, res, next) => {
  logger.error("Error occurred:", {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  })

  // Default error
  const error = {
    status: 500,
    message: "Internal Server Error",
  }

  // Validation errors
  if (err.name === "ValidationError") {
    error.status = 400
    error.message = "Validation Error"
    error.details = err.details
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    error.status = 401
    error.message = "Invalid token"
  }

  if (err.name === "TokenExpiredError") {
    error.status = 401
    error.message = "Token expired"
  }

  // Supabase errors
  if (err.code) {
    switch (err.code) {
      case "23505": // Unique violation
        error.status = 409
        error.message = "Resource already exists"
        break
      case "23503": // Foreign key violation
        error.status = 400
        error.message = "Invalid reference"
        break
      case "42P01": // Undefined table
        error.status = 500
        error.message = "Database configuration error"
        break
    }
  }

  // Stripe errors
  if (err.type && err.type.startsWith("Stripe")) {
    error.status = 400
    error.message = err.message || "Payment processing error"
  }

  res.status(error.status).json({
    error: error.message,
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
      details: error.details,
    }),
  })
}

module.exports = { errorHandler }
