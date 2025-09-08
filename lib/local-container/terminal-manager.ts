import type { LocalTerminal, Process } from "./types"
import { NodeTerminal } from "./terminal"

export interface TerminalSession {
  id: string
  terminal: LocalTerminal
  processes: Map<number, Process>
  history: string[]
  cwd: string
}

export class TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map()
  private workingDirectory: string

  constructor(workingDirectory: string) {
    this.workingDirectory = workingDirectory
  }

  createSession(sessionId?: string): TerminalSession {
    const id = sessionId || this.generateSessionId()
    const terminal = new NodeTerminal(this.workingDirectory)

    const session: TerminalSession = {
      id,
      terminal,
      processes: new Map(),
      history: [],
      cwd: this.workingDirectory,
    }

    this.sessions.set(id, session)
    return session
  }

  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId)
  }

  async executeCommand(
    sessionId: string,
    command: string,
    args: string[] = [],
  ): Promise<{
    process: Process
    output: AsyncGenerator<{ type: "stdout" | "stderr"; data: string }>
  }> {
    const session = this.getSession(sessionId)
    if (!session) {
      throw new Error(`Terminal session ${sessionId} not found`)
    }

    // Add to history
    session.history.push(`${command} ${args.join(" ")}`)

    // Handle built-in commands
    if (await this.handleBuiltinCommand(session, command, args)) {
      // Return empty process for built-in commands
      return {
        process: this.createMockProcess(),
        output: this.createEmptyOutput(),
      }
    }

    // Execute external command
    const process = await session.terminal.spawn(command, args, {
      cwd: session.cwd,
    })

    session.processes.set(process.pid, process)

    // Create output generator
    const output = this.createOutputGenerator(process)

    // Clean up process when it exits
    process.onExit((code) => {
      session.processes.delete(process.pid)
    })

    return { process, output }
  }

  private async handleBuiltinCommand(session: TerminalSession, command: string, args: string[]): Promise<boolean> {
    switch (command) {
      case "cd":
        await this.handleCdCommand(session, args)
        return true
      case "pwd":
        console.log(session.cwd)
        return true
      case "clear":
        // Clear command is handled by the UI
        return true
      default:
        return false
    }
  }

  private async handleCdCommand(session: TerminalSession, args: string[]): Promise<void> {
    const path = await import("path")
    const fs = await import("fs/promises")

    let targetDir = args[0] || process.env.HOME || this.workingDirectory

    if (!path.isAbsolute(targetDir)) {
      targetDir = path.resolve(session.cwd, targetDir)
    }

    try {
      await fs.access(targetDir)
      const stats = await fs.stat(targetDir)

      if (stats.isDirectory()) {
        session.cwd = targetDir
        console.log(`Changed directory to: ${targetDir}`)
      } else {
        console.error(`cd: ${targetDir}: Not a directory`)
      }
    } catch (error) {
      console.error(`cd: ${targetDir}: No such file or directory`)
    }
  }

  private async *createOutputGenerator(process: Process): AsyncGenerator<{ type: "stdout" | "stderr"; data: string }> {
    const stdoutReader = process.stdout.getReader()
    const stderrReader = process.stderr.getReader()

    const promises = [this.readStream(stdoutReader, "stdout"), this.readStream(stderrReader, "stderr")]

    for await (const output of this.mergeAsyncGenerators(promises)) {
      yield output
    }
  }

  private async *readStream(
    reader: ReadableStreamDefaultReader<string>,
    type: "stdout" | "stderr",
  ): AsyncGenerator<{ type: "stdout" | "stderr"; data: string }> {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        yield { type, data: value }
      }
    } catch (error) {
      yield { type: "stderr", data: `Error reading ${type}: ${error}` }
    } finally {
      reader.releaseLock()
    }
  }

  private async *mergeAsyncGenerators<T>(generators: AsyncGenerator<T>[]): AsyncGenerator<T> {
    const promises = generators.map(async (gen) => {
      for await (const item of gen) {
        return { item, generator: gen }
      }
      return null
    })

    while (promises.length > 0) {
      const result = await Promise.race(promises)
      if (result) {
        yield result.item
      }
    }
  }

  private createMockProcess(): Process {
    return {
      pid: -1,
      stdout: new ReadableStream(),
      stderr: new ReadableStream(),
      stdin: new WritableStream(),
      kill: () => {},
      onExit: () => {},
    }
  }

  private async *createEmptyOutput(): AsyncGenerator<{ type: "stdout" | "stderr"; data: string }> {
    // Empty generator for built-in commands
    return
  }

  private generateSessionId(): string {
    return `terminal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  killProcess(sessionId: string, pid: number): boolean {
    const session = this.getSession(sessionId)
    if (!session) return false

    const process = session.processes.get(pid)
    if (!process) return false

    process.kill()
    session.processes.delete(pid)
    return true
  }

  getSessionHistory(sessionId: string): string[] {
    const session = this.getSession(sessionId)
    return session?.history || []
  }

  destroySession(sessionId: string): boolean {
    const session = this.getSession(sessionId)
    if (!session) return false

    // Kill all running processes
    for (const process of session.processes.values()) {
      process.kill()
    }

    this.sessions.delete(sessionId)
    return true
  }
}
