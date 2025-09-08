import { type NextRequest, NextResponse } from "next/server"
import { TerminalManager } from "@/lib/local-container/terminal-manager"

const terminalManager = new TerminalManager()

export async function POST(request: NextRequest) {
  try {
    const { command, sessionId, workingDirectory } = await request.json()

    if (!command) {
      return NextResponse.json({ error: "Command is required" }, { status: 400 })
    }

    const result = await terminalManager.executeCommand(command, sessionId, workingDirectory)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Terminal execution error:", error)
    return NextResponse.json({ error: "Failed to execute command" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
    }

    const session = terminalManager.getSession(sessionId)
    return NextResponse.json({ session })
  } catch (error) {
    console.error("Get terminal session error:", error)
    return NextResponse.json({ error: "Failed to get session" }, { status: 500 })
  }
}
