import { type NextRequest, NextResponse } from "next/server"
import { TerminalManager } from "../../lib/local-container/terminal-manager"

const terminalManager = new TerminalManager(process.cwd())

export async function POST(request: NextRequest) {
  try {
    const { sessionId, command, args = [] } = await request.json()

    if (!sessionId || !command) {
      return NextResponse.json({ error: "Session ID and command are required" }, { status: 400 })
    }

    // Get or create session
    let session = terminalManager.getSession(sessionId)
    if (!session) {
      session = terminalManager.createSession(sessionId)
    }

    // Execute command
    const { process, output } = await terminalManager.executeCommand(sessionId, command, args)

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of output) {
            const data = JSON.stringify(chunk) + "\n"
            controller.enqueue(new TextEncoder().encode(data))
          }
        } catch (error) {
          const errorData =
            JSON.stringify({
              type: "stderr",
              data: `Error: ${error}`,
            }) + "\n"
          controller.enqueue(new TextEncoder().encode(errorData))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain",
        "Transfer-Encoding": "chunked",
      },
    })
  } catch (error) {
    console.error("Terminal execution error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
