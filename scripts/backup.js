const { exec } = require("child_process")
const fs = require("fs").promises
const path = require("path")
const logger = require("../utils/logger")

class BackupService {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || "./backups"
    this.retentionDays = Number.parseInt(process.env.BACKUP_RETENTION_DAYS) || 30
  }

  // Create database backup
  async createDatabaseBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const backupFile = path.join(this.backupDir, `kepka-db-${timestamp}.sql`)

      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true })

      // Create PostgreSQL dump
      const dumpCommand = `pg_dump "${process.env.POSTGRES_URL}" > "${backupFile}"`

      return new Promise((resolve, reject) => {
        exec(dumpCommand, (error, stdout, stderr) => {
          if (error) {
            logger.error("Database backup failed:", error)
            reject(error)
            return
          }

          logger.info(`Database backup created: ${backupFile}`)
          resolve(backupFile)
        })
      })
    } catch (error) {
      logger.error("Database backup error:", error)
      throw error
    }
  }

  // Create application backup (logs, uploads, etc.)
  async createApplicationBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const backupFile = path.join(this.backupDir, `kepka-app-${timestamp}.tar.gz`)

      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true })

      // Create tar archive of important directories
      const tarCommand = `tar -czf "${backupFile}" logs/ uploads/ .env`

      return new Promise((resolve, reject) => {
        exec(tarCommand, (error, stdout, stderr) => {
          if (error) {
            logger.error("Application backup failed:", error)
            reject(error)
            return
          }

          logger.info(`Application backup created: ${backupFile}`)
          resolve(backupFile)
        })
      })
    } catch (error) {
      logger.error("Application backup error:", error)
      throw error
    }
  }

  // Clean old backups
  async cleanOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir)
      const cutoffDate = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000)

      for (const file of files) {
        const filePath = path.join(this.backupDir, file)
        const stats = await fs.stat(filePath)

        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath)
          logger.info(`Deleted old backup: ${file}`)
        }
      }
    } catch (error) {
      logger.error("Backup cleanup error:", error)
      throw error
    }
  }

  // Schedule automatic backups
  scheduleBackups() {
    const cron = require("node-cron")

    // Daily database backup at 2 AM
    cron.schedule("0 2 * * *", async () => {
      logger.info("Starting scheduled database backup...")
      try {
        await this.createDatabaseBackup()
        await this.cleanOldBackups()
        logger.info("Scheduled database backup completed")
      } catch (error) {
        logger.error("Scheduled database backup failed:", error)
      }
    })

    // Weekly application backup on Sundays at 3 AM
    cron.schedule("0 3 * * 0", async () => {
      logger.info("Starting scheduled application backup...")
      try {
        await this.createApplicationBackup()
        logger.info("Scheduled application backup completed")
      } catch (error) {
        logger.error("Scheduled application backup failed:", error)
      }
    })

    logger.info("Backup schedules initialized")
  }
}

// Create singleton instance
const backupService = new BackupService()

// Initialize scheduled backups if not in test environment
if (process.env.NODE_ENV !== "test") {
  backupService.scheduleBackups()
}

module.exports = backupService
