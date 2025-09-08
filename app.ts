import express from "express"
import { createServer } from "http"
import { WebSocketServer } from "ws"
import path from "path"
import { LocalContainerImpl } from "./lib/local-container/container"
import { OptimizedFileSystem } from "./lib/local-container/optimized-file-system"
import { TerminalManager } from "./lib/local-container/terminal-manager"
import { FileManager } from "./lib/local-container/file-manager"
import { PreviewManager } from "./lib/local-container/preview-manager"
import { ProjectManager } from "./lib/local-container/project-manager"
import { PerformanceMonitor } from "./lib/local-container/performance-monitor"
import { logger, LogLevel } from "./lib/local-container/logger"

export class BoltLocalApp {
  private app: express.Application
  private server: any
  private wss: WebSocketServer | null = null
  private container: LocalContainerImpl | null = null
  private terminalManager: TerminalManager | null = null
  private fileManager: FileManager | null = null
  private previewManager: PreviewManager | null = null
  private projectManager: ProjectManager | null = null
  private performanceMonitor: PerformanceMonitor
  private port: number

  constructor(port = 3000) {
    this.app = express()
    this.port = port
    this.performanceMonitor = new PerformanceMonitor()

    this.setupMiddleware()
    this.setupRoutes()
  }

  private setupMiddleware(): void {
    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      })
      next()
    })

    // JSON parsing
    this.app.use(express.json({ limit: "50mb" }))
    this.app.use(express.urlencoded({ extended: true, limit: "50mb" }))

    // Static files
    this.app.use(express.static(path.join(__dirname, "public")))

    // CORS
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*")
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization")
      next()
    })
  }

  private setupRoutes(): void {
    // Health check
    this.app.get("/health", (req, res) => {
      const report = this.performanceMonitor.generateReport()
      res.json({
        status: "healthy",
        uptime: report.uptime,
        performance: report,
        container: this.container ? "initialized" : "not initialized",
      })
    })

    // File system API
    this.app.get("/api/files/*", async (req, res) => {
      try {
        if (!this.fileManager) {
          return res.status(500).json({ error: "File manager not initialized" })
        }

        const filePath = req.params[0]
        const content = await this.fileManager.readFile(filePath)
        res.json({ content })
      } catch (error) {
        logger.error("File read error", error as Error, { path: req.params[0] })
        res.status(404).json({ error: "File not found" })
      }
    })

    this.app.post("/api/files/*", async (req, res) => {
      try {
        if (!this.fileManager) {
          return res.status(500).json({ error: "File manager not initialized" })
        }

        const filePath = req.params[0]
        const { content } = req.body
        await this.fileManager.writeFile(filePath, content)
        res.json({ success: true })
      } catch (error) {
        logger.error("File write error", error as Error, { path: req.params[0] })
        res.status(500).json({ error: "Failed to write file" })
      }
    })

    // Terminal API
    this.app.post("/api/terminal/execute", async (req, res) => {
      try {
        if (!this.terminalManager) {
          return res.status(500).json({ error: "Terminal manager not initialized" })
        }

        const { sessionId, command, args = [] } = req.body
        const { process, output } = await this.terminalManager.executeCommand(sessionId, command, args)

        this.performanceMonitor.recordTerminalCommand()

        // Stream response
        res.writeHead(200, {
          "Content-Type": "text/plain",
          "Transfer-Encoding": "chunked",
        })

        for await (const chunk of output) {
          res.write(JSON.stringify(chunk) + "\n")
        }

        res.end()
      } catch (error) {
        logger.error("Terminal execution error", error as Error)
        res.status(500).json({ error: "Command execution failed" })
      }
    })

    // Project management API
    this.app.post("/api/project/export", async (req, res) => {
      try {
        if (!this.projectManager) {
          return res.status(500).json({ error: "Project manager not initialized" })
        }

        const options = req.body
        const buffer = await this.projectManager.exportProject(options)

        res.setHeader("Content-Type", "application/zip")
        res.setHeader("Content-Disposition", "attachment; filename=project.zip")
        res.send(buffer)
      } catch (error) {
        logger.error("Project export error", error as Error)
        res.status(500).json({ error: "Export failed" })
      }
    })

    // Performance metrics API
    this.app.get("/api/metrics", (req, res) => {
      const report = this.performanceMonitor.generateReport()
      const cacheStats = this.container?.fs ? (this.container.fs as any).getCacheStats?.() : null

      res.json({
        ...report,
        cache: cacheStats,
      })
    })

    // Error handling
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error("Unhandled error", error, {
        path: req.path,
        method: req.method,
      })

      res.status(500).json({
        error: "Internal server error",
        message: process.env.NODE_ENV === "development" ? error.message : undefined,
      })
    })
  }

  async initialize(workdir = "workspace"): Promise<void> {
    try {
      logger.info("Initializing Bolt Local App", { workdir, port: this.port })

      // Start performance monitoring
      this.performanceMonitor.start()

      // Initialize container with optimized file system
      this.container = new LocalContainerImpl(workdir)
      const optimizedFS = new OptimizedFileSystem(workdir, this.performanceMonitor)
      ;(this.container as any).fs = optimizedFS

      // Initialize managers
      this.terminalManager = new TerminalManager(workdir)
      this.fileManager = new FileManager(optimizedFS, workdir)
      this.previewManager = new PreviewManager(this.container)
      this.projectManager = new ProjectManager(this.container)

      // Initialize file manager
      await this.fileManager.initialize()

      // Set up performance monitoring
      this.setupPerformanceMonitoring()

      logger.info("Bolt Local App initialized successfully")
    } catch (error) {
      logger.error("Failed to initialize app", error as Error)
      throw error
    }
  }

  private setupPerformanceMonitoring(): void {
    // Monitor terminal sessions
    if (this.terminalManager) {
      setInterval(() => {
        // This would need to be implemented in TerminalManager
        // this.performanceMonitor.setActiveSessions(this.terminalManager.getActiveSessionCount())
      }, 5000)
    }

    // Monitor cache performance
    if (this.container?.fs) {
      const fs = this.container.fs as any
      if (fs.getCacheStats) {
        this.performanceMonitor.on("systemMetrics", () => {
          const cacheStats = fs.getCacheStats()
          this.performanceMonitor.recordMetric("cache_hit_rate", cacheStats.fileCache.hitRate)
          this.performanceMonitor.recordMetric("cache_size", cacheStats.fileCache.size)
        })
      }
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.app)

        // Set up WebSocket server for real-time updates
        this.wss = new WebSocketServer({ server: this.server })

        this.wss.on("connection", (ws) => {
          logger.info("WebSocket connection established")

          // Send performance updates
          const metricsInterval = setInterval(() => {
            if (ws.readyState === ws.OPEN) {
              const metrics = this.performanceMonitor.getSystemMetrics()
              ws.send(
                JSON.stringify({
                  type: "metrics",
                  data: metrics,
                }),
              )
            }
          }, 5000)

          ws.on("close", () => {
            clearInterval(metricsInterval)
            logger.info("WebSocket connection closed")
          })
        })

        this.server.listen(this.port, () => {
          logger.info(`Bolt Local App started on port ${this.port}`)
          resolve()
        })

        this.server.on("error", (error: Error) => {
          logger.error("Server error", error)
          reject(error)
        })
      } catch (error) {
        logger.error("Failed to start server", error as Error)
        reject(error)
      }
    })
  }

  async stop(): Promise<void> {
    logger.info("Stopping Bolt Local App")

    // Stop performance monitoring
    this.performanceMonitor.stop()

    // Close WebSocket server
    if (this.wss) {
      this.wss.close()
    }

    // Stop preview manager
    if (this.previewManager) {
      await this.previewManager.stopAllPreviews()
    }

    // Dispose managers
    this.fileManager?.dispose()
    this.performanceMonitor.dispose()

    // Close HTTP server
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info("Bolt Local App stopped")
          resolve()
        })
      })
    }
  }

  getContainer(): LocalContainerImpl | null {
    return this.container
  }

  getManagers(): {
    terminal: TerminalManager | null
    file: FileManager | null
    preview: PreviewManager | null
    project: ProjectManager | null
  } {
    return {
      terminal: this.terminalManager,
      file: this.fileManager,
      preview: this.previewManager,
      project: this.projectManager,
    }
  }
}

// CLI entry point
if (require.main === module) {
  const app = new BoltLocalApp(Number.parseInt(process.env.PORT || "3000"))

  // Set log level from environment
  const logLevel = process.env.LOG_LEVEL?.toUpperCase()
  if (logLevel && logLevel in LogLevel) {
    logger.setLogLevel(LogLevel[logLevel as keyof typeof LogLevel])
  }

  // Initialize and start
  app
    .initialize(process.env.WORKSPACE || "workspace")
    .then(() => app.start())
    .then(() => {
      console.log(`🚀 Bolt Local is running on http://localhost:${app["port"]}`)
    })
    .catch((error) => {
      console.error("Failed to start Bolt Local:", error)
      process.exit(1)
    })

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down gracefully...")
    await app.stop()
    process.exit(0)
  })

  process.on("SIGTERM", async () => {
    console.log("\nShutting down gracefully...")
    await app.stop()
    process.exit(0)
  })
}
