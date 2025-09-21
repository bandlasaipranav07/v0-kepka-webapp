const rateLimit = require("express-rate-limit")
const logger = require("../utils/logger")

// Enhanced rate limiting for sensitive operations
const createStrictLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: "Rate limit exceeded",
      message,
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`)
      res.status(429).json({
        error: "Rate limit exceeded",
        message,
      })
    },
  })
}

// Security policy validation middleware
const validateSecurityPolicies = async (req, res, next) => {
  try {
    if (!req.user) {
      return next()
    }

    // Get user's active security policies
    const { data: policies, error } = await req.userSupabase
      .from("security_policies")
      .select("*")
      .eq("user_id", req.user.id)
      .eq("is_active", true)

    if (error) {
      logger.error("Error fetching security policies:", error)
      return next()
    }

    // Validate policies based on request
    for (const policy of policies || []) {
      const isValid = await validatePolicy(policy, req)
      if (!isValid) {
        return res.status(403).json({
          error: "Security policy violation",
          message: `Request blocked by ${policy.policy_name} policy`,
          policy_type: policy.policy_type,
        })
      }
    }

    next()
  } catch (error) {
    logger.error("Security policy validation error:", error)
    next()
  }
}

// Validate individual security policy
const validatePolicy = async (policy, req) => {
  const config = policy.policy_config

  switch (policy.policy_type) {
    case "rate_limit": {
      const hoursAgo = new Date(Date.now() - config.hours * 60 * 60 * 1000).toISOString()

      const { data: recentRequests } = await req.userSupabase
        .from("audit_logs")
        .select("id")
        .eq("user_id", req.user.id)
        .eq("action", req.method + " " + req.path)
        .gte("created_at", hoursAgo)

      return (recentRequests?.length || 0) < config.max_requests
    }

    case "time_lock": {
      const currentHour = new Date().getHours()
      const allowedHours = config.allowed_hours || []
      return allowedHours.includes(currentHour)
    }

    case "whitelist": {
      const allowedIPs = config.allowed_ips || []
      return allowedIPs.includes(req.ip)
    }

    default:
      return true
  }
}

// Audit logging middleware
const auditLog = (action, resourceType) => {
  return async (req, res, next) => {
    try {
      if (req.user) {
        await req.userSupabase.from("audit_logs").insert({
          user_id: req.user.id,
          action: `${action} ${resourceType}`,
          resource_type: resourceType,
          resource_id: req.params.id || null,
          ip_address: req.ip,
          user_agent: req.get("User-Agent"),
          metadata: {
            method: req.method,
            path: req.path,
            query: req.query,
          },
        })
      }
    } catch (error) {
      logger.error("Audit logging error:", error)
    }

    next()
  }
}

// IP whitelist middleware
const ipWhitelist = (allowedIPs) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress

    if (!allowedIPs.includes(clientIP)) {
      logger.warn(`Blocked request from unauthorized IP: ${clientIP}`)
      return res.status(403).json({
        error: "Access denied",
        message: "Your IP address is not authorized to access this resource",
      })
    }

    next()
  }
}

// Request signature validation (for webhook security)
const validateSignature = (secret, headerName = "x-signature") => {
  return (req, res, next) => {
    const crypto = require("crypto")
    const signature = req.headers[headerName]

    if (!signature) {
      return res.status(401).json({
        error: "Missing signature",
        message: "Request signature is required",
      })
    }

    const expectedSignature = crypto.createHmac("sha256", secret).update(req.body).digest("hex")

    if (signature !== `sha256=${expectedSignature}`) {
      logger.warn(`Invalid signature from IP: ${req.ip}`)
      return res.status(401).json({
        error: "Invalid signature",
        message: "Request signature is invalid",
      })
    }

    next()
  }
}

module.exports = {
  createStrictLimiter,
  validateSecurityPolicies,
  auditLog,
  ipWhitelist,
  validateSignature,
}
