import { createServer, type ViteDevServer } from "vite"
import express from "express"
import { createProxyMiddleware } from "http-proxy-middleware"
import type { LocalContainer } from "./types"
import path from "path"

export interface DevServerConfig {
  port?: number
  host?: string
  https?: boolean
  proxy?: Record<string, string>
  env?: Record<string, string>
}

export class LocalDevServer {
  private server: ViteDevServer | null = null
  private expressApp: express.Application | null = null
  private httpServer: any = null
  private container: LocalContainer
  private port: number
  private config: DevServerConfig
  private process: any = null // Declare process variable here

  constructor(container: LocalContainer, port = 3000, config: DevServerConfig = {}) {
    this.container = container
    this.port = port
    this.config = { port, host: "0.0.0.0", ...config }
  }

  async start(): Promise<void> {
    const projectType = await this.detectProjectType()

    switch (projectType) {
      case "vite":
        await this.startViteServer()
        break
      case "next":
        await this.startNextServer()
        break
      case "react":
        await this.startReactServer()
        break
      case "node":
        await this.startNodeServer()
        break
      case "static":
      default:
        await this.startStaticServer()
        break
    }
  }

  private async detectProjectType(): Promise<string> {
    try {
      const packageJsonExists = await this.container.fs.exists("package.json")

      if (!packageJsonExists) {
        return "static"
      }

      const packageJson = JSON.parse(await this.container.fs.readFile("package.json"))

      // Check dependencies for project type
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }

      if (deps.next) return "next"
      if (deps.vite) return "vite"
      if (deps["react-scripts"]) return "react"
      if (packageJson.scripts?.start || packageJson.scripts?.dev) return "node"

      return "static"
    } catch (error) {
      console.warn("Failed to detect project type:", error)
      return "static"
    }
  }

  private async startViteServer(): Promise<void> {
    try {
      this.server = await createServer({
        root: this.container.workdir,
        server: {
          port: this.port,
          host: this.config.host,
          https: this.config.https,
        },
        define: {
          "process.env": JSON.stringify(this.config.env || {}),
        },
      })

      await this.server.listen()
      console.log(`Vite dev server running on http://${this.config.host}:${this.port}`)
    } catch (error) {
      console.error("Failed to start Vite server:", error)
      throw error
    }
  }

  private async startNextServer(): Promise<void> {
    // For Next.js, we'll use the npm script approach
    await this.startWithNpmScript("dev")
  }

  private async startReactServer(): Promise<void> {
    // For Create React App, use npm start
    await this.startWithNpmScript("start")
  }

  private async startNodeServer(): Promise<void> {
    // Try dev script first, then start
    const hasDevScript = await this.hasNpmScript("dev")
    const script = hasDevScript ? "dev" : "start"
    await this.startWithNpmScript(script)
  }

  private async startWithNpmScript(scriptName: string): Promise<void> {
    try {
      // Set environment variables
      const env = { ...process.env, ...this.config.env, PORT: this.port.toString() }

      this.process = await this.container.terminal.spawn("npm", ["run", scriptName], {
        cwd: this.container.workdir,
        env,
      })

      // Log output
      this.logProcessOutput(this.process)

      console.log(`Started ${scriptName} script on port ${this.port}`)
    } catch (error) {
      console.error(`Failed to start with npm script ${scriptName}:`, error)
      throw error
    }
  }

  private async startStaticServer(): Promise<void> {
    this.expressApp = express()

    // Add proxy middleware if configured
    if (this.config.proxy) {
      Object.entries(this.config.proxy).forEach(([path, target]) => {
        this.expressApp!.use(
          path,
          createProxyMiddleware({
            target,
            changeOrigin: true,
            pathRewrite: {
              [`^${path}`]: "",
            },
          }),
        )
      })
    }

    // Serve static files
    this.expressApp.use(express.static(this.container.workdir))

    // SPA fallback
    this.expressApp.get("*", (req, res) => {
      res.sendFile(path.join(this.container.workdir, "index.html"), (err) => {
        if (err) {
          res.status(404).send("File not found")
        }
      })
    })

    this.httpServer = this.expressApp.listen(this.port, this.config.host, () => {
      console.log(`Static server running on http://${this.config.host}:${this.port}`)
    })
  }

  private async logProcessOutput(process: any): Promise<void> {
    const stdoutReader = process.stdout.getReader()
    const stderrReader = process.stderr.getReader()

    // Log stdout
    this.readStream(stdoutReader, "stdout")

    // Log stderr
    this.readStream(stderrReader, "stderr")
  }

  private async readStream(reader: ReadableStreamDefaultReader<string>, type: "stdout" | "stderr"): Promise<void> {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        if (type === "stderr") {
          console.error(value)
        } else {
          console.log(value)
        }
      }
    } catch (error) {
      console.error(`Error reading ${type}:`, error)
    }
  }

  private async hasNpmScript(scriptName: string): Promise<boolean> {
    try {
      const packageJson = JSON.parse(await this.container.fs.readFile("package.json"))
      return !!packageJson.scripts?.[scriptName]
    } catch {
      return false
    }
  }

  async stop(): Promise<void> {
    if (this.server) {
      await this.server.close()
      this.server = null
    }

    if (this.httpServer) {
      this.httpServer.close()
      this.httpServer = null
    }

    if (this.process) {
      this.process.kill()
      this.process = null
    }
  }

  getUrl(): string {
    const protocol = this.config.https ? "https" : "http"
    return `${protocol}://${this.config.host}:${this.port}`
  }

  isRunning(): boolean {
    return this.server !== null || this.httpServer !== null || this.process !== null
  }
}
