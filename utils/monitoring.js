const logger = require("./logger")
const { supabase } = require("../config/database")

class MonitoringService {
  constructor() {
    this.metrics = new Map()
    this.alerts = []
    this.healthChecks = new Map()
  }

  // Record custom metrics
  recordMetric(name, value, type = "counter", tags = {}) {
    const metric = {
      name,
      value,
      type,
      tags,
      timestamp: new Date().toISOString(),
    }

    this.metrics.set(`${name}_${Date.now()}`, metric)

    // Store in database for persistence
    supabase
      .rpc("record_metric", {
        p_metric_name: name,
        p_metric_value: value,
        p_metric_type: type,
        p_tags: tags,
      })
      .catch((error) => {
        logger.error("Failed to record metric:", error)
      })

    logger.info(`Metric recorded: ${name} = ${value}`)
  }

  // Add health check
  addHealthCheck(name, checkFunction, interval = 60000) {
    const healthCheck = {
      name,
      checkFunction,
      interval,
      lastCheck: null,
      status: "unknown",
      error: null,
    }

    this.healthChecks.set(name, healthCheck)

    // Run initial check
    this.runHealthCheck(name)

    // Schedule periodic checks
    setInterval(() => {
      this.runHealthCheck(name)
    }, interval)

    logger.info(`Health check added: ${name}`)
  }

  // Run individual health check
  async runHealthCheck(name) {
    const healthCheck = this.healthChecks.get(name)
    if (!healthCheck) return

    try {
      const result = await healthCheck.checkFunction()
      healthCheck.status = result ? "healthy" : "unhealthy"
      healthCheck.error = null
      healthCheck.lastCheck = new Date().toISOString()

      if (!result) {
        this.recordAlert("health_check_failed", `Health check failed: ${name}`, "warning")
      }
    } catch (error) {
      healthCheck.status = "error"
      healthCheck.error = error.message
      healthCheck.lastCheck = new Date().toISOString()

      this.recordAlert("health_check_error", `Health check error: ${name} - ${error.message}`, "error")
      logger.error(`Health check error for ${name}:`, error)
    }
  }

  // Record alert
  recordAlert(type, message, severity = "info") {
    const alert = {
      type,
      message,
      severity,
      timestamp: new Date().toISOString(),
    }

    this.alerts.push(alert)

    // Keep only last 100 alerts in memory
    if (this.alerts.length > 100) {
      this.alerts.shift()
    }

    logger.warn(`Alert: [${severity.toUpperCase()}] ${type} - ${message}`)

    // Send critical alerts to external monitoring service
    if (severity === "critical") {
      this.sendCriticalAlert(alert)
    }
  }

  // Send critical alert to external service
  async sendCriticalAlert(alert) {
    try {
      // Implement integration with external monitoring service
      // e.g., PagerDuty, Slack, email notifications
      logger.error(`CRITICAL ALERT: ${alert.message}`)
    } catch (error) {
      logger.error("Failed to send critical alert:", error)
    }
  }

  // Get system health status
  getHealthStatus() {
    const healthChecks = Array.from(this.healthChecks.values())
    const overallStatus = healthChecks.every((check) => check.status === "healthy") ? "healthy" : "unhealthy"

    return {
      status: overallStatus,
      checks: healthChecks,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    }
  }

  // Get recent metrics
  getMetrics(limit = 100) {
    const recentMetrics = Array.from(this.metrics.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit)

    return recentMetrics
  }

  // Get recent alerts
  getAlerts(limit = 50) {
    return this.alerts.slice(-limit)
  }

  // Performance monitoring middleware
  performanceMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now()

      res.on("finish", () => {
        const duration = Date.now() - startTime
        const route = `${req.method} ${req.route?.path || req.path}`

        this.recordMetric("http_request_duration", duration, "histogram", {
          method: req.method,
          route: req.route?.path || req.path,
          status_code: res.statusCode,
        })

        this.recordMetric("http_requests_total", 1, "counter", {
          method: req.method,
          route: req.route?.path || req.path,
          status_code: res.statusCode,
        })

        // Alert on slow requests
        if (duration > 5000) {
          this.recordAlert("slow_request", `Slow request: ${route} took ${duration}ms`, "warning")
        }

        // Alert on errors
        if (res.statusCode >= 500) {
          this.recordAlert("server_error", `Server error: ${route} returned ${res.statusCode}`, "error")
        }
      })

      next()
    }
  }
}

// Create singleton instance
const monitoring = new MonitoringService()

// Add default health checks
monitoring.addHealthCheck(
  "database",
  async () => {
    try {
      const { error } = await supabase.from("profiles").select("count").limit(1)
      return !error
    } catch {
      return false
    }
  },
  30000,
) // Check every 30 seconds

monitoring.addHealthCheck(
  "memory",
  () => {
    const usage = process.memoryUsage()
    const maxMemory = 1024 * 1024 * 1024 // 1GB
    return usage.heapUsed < maxMemory
  },
  60000,
) // Check every minute

monitoring.addHealthCheck(
  "disk_space",
  () => {
    // Simplified disk space check
    // In production, use proper disk space monitoring
    return true
  },
  300000,
) // Check every 5 minutes

module.exports = monitoring
