import { EventEmitter } from "events"
import type { LocalContainer } from "./types"
import { LocalDevServer } from "./dev-server"

export interface PreviewInstance {
  id: string
  port: number
  url: string
  status: "starting" | "running" | "stopped" | "error"
  projectPath: string
  server: LocalDevServer
  lastActivity: Date
}

export interface PreviewConfig {
  port?: number
  host?: string
  https?: boolean
  proxy?: Record<string, string>
  env?: Record<string, string>
}

export class PreviewManager extends EventEmitter {
  private previews: Map<string, PreviewInstance> = new Map()
  private container: LocalContainer
  private portRange = { min: 3000, max: 9000 }
  private usedPorts: Set<number> = new Set()

  constructor(container: LocalContainer) {
    super()
    this.container = container
  }

  async createPreview(projectPath: string, config: PreviewConfig = {}): Promise<PreviewInstance> {
    const id = this.generatePreviewId()
    const port = config.port || (await this.findAvailablePort())

    const server = new LocalDevServer(this.container, port)

    const preview: PreviewInstance = {
      id,
      port,
      url: `http://${config.host || "localhost"}:${port}`,
      status: "starting",
      projectPath,
      server,
      lastActivity: new Date(),
    }

    this.previews.set(id, preview)
    this.usedPorts.add(port)

    try {
      // Set environment variables if provided
      if (config.env) {
        Object.assign(process.env, config.env)
      }

      await server.start()
      preview.status = "running"

      this.emit("previewStarted", preview)

      // Set up activity monitoring
      this.setupActivityMonitoring(preview)
    } catch (error) {
      preview.status = "error"
      this.emit("previewError", preview, error)
      throw error
    }

    return preview
  }

  async stopPreview(previewId: string): Promise<boolean> {
    const preview = this.previews.get(previewId)
    if (!preview) return false

    try {
      await preview.server.stop()
      preview.status = "stopped"
      this.usedPorts.delete(preview.port)
      this.previews.delete(previewId)

      this.emit("previewStopped", preview)
      return true
    } catch (error) {
      this.emit("previewError", preview, error)
      return false
    }
  }

  async restartPreview(previewId: string): Promise<boolean> {
    const preview = this.previews.get(previewId)
    if (!preview) return false

    try {
      await preview.server.stop()
      preview.status = "starting"
      await preview.server.start()
      preview.status = "running"
      preview.lastActivity = new Date()

      this.emit("previewRestarted", preview)
      return true
    } catch (error) {
      preview.status = "error"
      this.emit("previewError", preview, error)
      return false
    }
  }

  getPreview(previewId: string): PreviewInstance | undefined {
    return this.previews.get(previewId)
  }

  getAllPreviews(): PreviewInstance[] {
    return Array.from(this.previews.values())
  }

  getRunningPreviews(): PreviewInstance[] {
    return this.getAllPreviews().filter((p) => p.status === "running")
  }

  private async findAvailablePort(): Promise<number> {
    for (let port = this.portRange.min; port <= this.portRange.max; port++) {
      if (!this.usedPorts.has(port) && (await this.isPortAvailable(port))) {
        return port
      }
    }
    throw new Error("No available ports in range")
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const net = require("net")
      const server = net.createServer()

      server.listen(port, () => {
        server.once("close", () => resolve(true))
        server.close()
      })

      server.on("error", () => resolve(false))
    })
  }

  private generatePreviewId(): string {
    return `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private setupActivityMonitoring(preview: PreviewInstance): void {
    // Monitor for file changes and restart if needed
    this.container.fs.readdir(preview.projectPath).then(() => {
      // Set up file watcher for hot reload
      const chokidar = require("chokidar")
      const watcher = chokidar.watch(preview.projectPath, {
        ignored: /(^|[/\\])\../, // ignore dotfiles
        persistent: true,
      })

      watcher.on("change", async (path: string) => {
        preview.lastActivity = new Date()
        this.emit("fileChanged", preview, path)

        // Auto-restart for certain file types
        if (this.shouldAutoRestart(path)) {
          await this.restartPreview(preview.id)
        }
      })

      // Clean up watcher when preview is stopped
      this.once(`previewStopped_${preview.id}`, () => {
        watcher.close()
      })
    })
  }

  private shouldAutoRestart(filePath: string): boolean {
    const autoRestartExtensions = [".js", ".ts", ".json", ".env"]
    const ext = require("path").extname(filePath)
    return autoRestartExtensions.includes(ext)
  }

  async stopAllPreviews(): Promise<void> {
    const stopPromises = Array.from(this.previews.keys()).map((id) => this.stopPreview(id))
    await Promise.all(stopPromises)
  }

  dispose(): void {
    this.stopAllPreviews()
    this.removeAllListeners()
  }
}
