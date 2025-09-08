import { promises as fs } from "fs"
import path from "path"

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: Date
  level: LogLevel
  message: string
  context?: Record<string, any>
  error?: Error
}

export class Logger {
  private logLevel: LogLevel = LogLevel.INFO
  private logFile?: string
  private maxLogSize = 10 * 1024 * 1024 // 10MB
  private maxLogFiles = 5

  constructor(logFile?: string, logLevel = LogLevel.INFO) {
    this.logFile = logFile
    this.logLevel = logLevel
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context)
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context)
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error)
  }

  private async log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): Promise<void> {
    if (level < this.logLevel) return

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      error,
    }

    // Console output
    this.logToConsole(entry)

    // File output
    if (this.logFile) {
      await this.logToFile(entry)
    }
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString()
    const levelName = LogLevel[entry.level]
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ""
    const errorStr = entry.error ? ` ${entry.error.stack}` : ""

    const logMessage = `[${timestamp}] ${levelName}: ${entry.message}${contextStr}${errorStr}`

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(logMessage)
        break
      case LogLevel.INFO:
        console.info(logMessage)
        break
      case LogLevel.WARN:
        console.warn(logMessage)
        break
      case LogLevel.ERROR:
        console.error(logMessage)
        break
    }
  }

  private async logToFile(entry: LogEntry): Promise<void> {
    if (!this.logFile) return

    try {
      // Check if log rotation is needed
      await this.rotateLogsIfNeeded()

      const timestamp = entry.timestamp.toISOString()
      const levelName = LogLevel[entry.level]
      const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ""
      const errorStr = entry.error ? `\n${entry.error.stack}` : ""

      const logLine = `[${timestamp}] ${levelName}: ${entry.message}${contextStr}${errorStr}\n`

      await fs.appendFile(this.logFile, logLine, "utf8")
    } catch (error) {
      console.error("Failed to write to log file:", error)
    }
  }

  private async rotateLogsIfNeeded(): Promise<void> {
    if (!this.logFile) return

    try {
      const stats = await fs.stat(this.logFile)

      if (stats.size >= this.maxLogSize) {
        await this.rotateLogs()
      }
    } catch (error) {
      // File doesn't exist yet, no rotation needed
    }
  }

  private async rotateLogs(): Promise<void> {
    if (!this.logFile) return

    const logDir = path.dirname(this.logFile)
    const logName = path.basename(this.logFile, path.extname(this.logFile))
    const logExt = path.extname(this.logFile)

    try {
      // Rotate existing log files
      for (let i = this.maxLogFiles - 1; i >= 1; i--) {
        const oldFile = path.join(logDir, `${logName}.${i}${logExt}`)
        const newFile = path.join(logDir, `${logName}.${i + 1}${logExt}`)

        try {
          await fs.access(oldFile)
          if (i === this.maxLogFiles - 1) {
            await fs.unlink(oldFile) // Delete oldest log
          } else {
            await fs.rename(oldFile, newFile)
          }
        } catch {
          // File doesn't exist, continue
        }
      }

      // Move current log to .1
      const firstRotated = path.join(logDir, `${logName}.1${logExt}`)
      await fs.rename(this.logFile, firstRotated)
    } catch (error) {
      console.error("Failed to rotate logs:", error)
    }
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level
  }

  async clearLogs(): Promise<void> {
    if (!this.logFile) return

    try {
      await fs.unlink(this.logFile)
    } catch {
      // File doesn't exist, nothing to clear
    }
  }
}

// Global logger instance
export const logger = new Logger(path.join(process.cwd(), "logs", "bolt-local.log"))
