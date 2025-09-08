import { type NextRequest, NextResponse } from "next/server"
import { FileManager } from "@/lib/local-container/file-manager"

const fileManager = new FileManager()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get("path") || "."
    const action = searchParams.get("action")

    if (action === "list") {
      const files = await fileManager.listFiles(path)
      return NextResponse.json({ files })
    }

    if (action === "read") {
      const content = await fileManager.readFile(path)
      return NextResponse.json({ content })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("File operation error:", error)
    return NextResponse.json({ error: "File operation failed" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { path, content, action } = await request.json()

    switch (action) {
      case "write":
        await fileManager.writeFile(path, content)
        return NextResponse.json({ success: true })

      case "create":
        await fileManager.createFile(path, content || "")
        return NextResponse.json({ success: true })

      case "mkdir":
        await fileManager.createDirectory(path)
        return NextResponse.json({ success: true })

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("File operation error:", error)
    return NextResponse.json({ error: "File operation failed" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get("path")

    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 })
    }

    await fileManager.deleteFile(path)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("File deletion error:", error)
    return NextResponse.json({ error: "File deletion failed" }, { status: 500 })
  }
}
