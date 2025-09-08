import { spawn as nodeSpawn, exec as nodeExec } from "child_process"
import type { LocalTerminal, Process, SpawnOptions } from "./types"

export class NodeTerminal implements LocalTerminal {
  private workingDirectory: string

  constructor(workingDirectory: string) {
    this.workingDirectory = workingDirectory
  }

  async spawn(command: string, args: string[] = [], options: SpawnOptions = {}): Promise<Process> {
    const cwd = options.cwd || this.workingDirectory
    const env = { ...process.env, ...options.env }

    const childProcess = nodeSpawn(command, args, {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    })

    // Create readable streams for stdout and stderr
    const stdout = new ReadableStream({
      start(controller) {
        childProcess.stdout?.on("data", (chunk) => {
          controller.enqueue(chunk.toString())
        })
        childProcess.stdout?.on("end", () => {
          controller.close()
        })
      },
    })

    const stderr = new ReadableStream({
      start(controller) {
        childProcess.stderr?.on("data", (chunk) => {
          controller.enqueue(chunk.toString())
        })
        childProcess.stderr?.on("end", () => {
          controller.close()
        })
      },
    })

    // Create writable stream for stdin
    const stdin = new WritableStream({
      write(chunk) {
        childProcess.stdin?.write(chunk)
      },
      close() {
        childProcess.stdin?.end()
      },
    })

    return {
      pid: childProcess.pid!,
      stdout,
      stderr,
      stdin,
      kill: (signal = "SIGTERM") => childProcess.kill(signal),
      onExit: (callback) => {
        childProcess.on("exit", (code) => callback(code || 0))
      },
    }
  }

  async exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      nodeExec(command, { cwd: this.workingDirectory }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            stdout: stdout || "",
            stderr: stderr || error.message,
            exitCode: error.code || 1,
          })
        } else {
          resolve({
            stdout: stdout || "",
            stderr: stderr || "",
            exitCode: 0,
          })
        }
      })
    })
  }
}
