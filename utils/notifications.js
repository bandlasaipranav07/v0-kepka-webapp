const logger = require("./logger")

class NotificationService {
  constructor() {
    this.channels = new Map()
    this.templates = new Map()
  }

  // Add notification channel
  addChannel(name, handler) {
    this.channels.set(name, handler)
    logger.info(`Notification channel added: ${name}`)
  }

  // Add notification template
  addTemplate(name, template) {
    this.templates.set(name, template)
    logger.info(`Notification template added: ${name}`)
  }

  // Send notification
  async send(channelName, templateName, data, recipient) {
    try {
      const channel = this.channels.get(channelName)
      const template = this.templates.get(templateName)

      if (!channel) {
        throw new Error(`Notification channel not found: ${channelName}`)
      }

      if (!template) {
        throw new Error(`Notification template not found: ${templateName}`)
      }

      // Render template with data
      const message = this.renderTemplate(template, data)

      // Send via channel
      await channel(message, recipient)

      logger.info(`Notification sent via ${channelName} to ${recipient}`)
    } catch (error) {
      logger.error("Notification send error:", error)
      throw error
    }
  }

  // Render template with data
  renderTemplate(template, data) {
    let rendered = template.content

    // Simple template variable replacement
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`
      rendered = rendered.replace(new RegExp(placeholder, "g"), value)
    }

    return {
      subject: template.subject,
      content: rendered,
      type: template.type,
    }
  }

  // Broadcast to multiple channels
  async broadcast(templateName, data, recipients) {
    const promises = []

    for (const [channelName, recipient] of recipients) {
      promises.push(this.send(channelName, templateName, data, recipient))
    }

    try {
      await Promise.all(promises)
      logger.info(`Broadcast sent to ${recipients.length} recipients`)
    } catch (error) {
      logger.error("Broadcast error:", error)
      throw error
    }
  }
}

// Create singleton instance
const notifications = new NotificationService()

// Add default channels
notifications.addChannel("email", async (message, recipient) => {
  // Implement email sending logic
  logger.info(`Email sent to ${recipient}: ${message.subject}`)
})

notifications.addChannel("webhook", async (message, url) => {
  // Implement webhook sending logic
  const fetch = require("node-fetch")
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  })
})

notifications.addChannel("slack", async (message, channel) => {
  // Implement Slack integration
  logger.info(`Slack message sent to ${channel}: ${message.content}`)
})

// Add default templates
notifications.addTemplate("user_signup", {
  subject: "Welcome to Kepka!",
  content: "Hello {{name}}, welcome to the Kepka platform! Your account has been created successfully.",
  type: "email",
})

notifications.addTemplate("token_created", {
  subject: "Token Created Successfully",
  content: "Your token {{token_name}} ({{symbol}}) has been created successfully with {{total_supply}} total supply.",
  type: "email",
})

notifications.addTemplate("payment_success", {
  subject: "Payment Successful",
  content: "Your payment of ${{amount}} has been processed successfully. Transaction ID: {{transaction_id}}",
  type: "email",
})

notifications.addTemplate("security_alert", {
  subject: "Security Alert",
  content:
    "Security alert for your account: {{alert_message}}. If this wasn't you, please contact support immediately.",
  type: "email",
})

module.exports = notifications
