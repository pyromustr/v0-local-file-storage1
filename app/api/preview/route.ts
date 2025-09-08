import { type NextRequest, NextResponse } from "next/server"
import { PreviewManager } from "@/lib/local-container/preview-manager"

const previewManager = new PreviewManager()

export async function POST(request: NextRequest) {
  try {
    const { projectPath, projectType } = await request.json()

    if (!projectPath) {
      return NextResponse.json({ error: "Project path is required" }, { status: 400 })
    }

    const preview = await previewManager.createPreview(projectPath, projectType)
    return NextResponse.json(preview)
  } catch (error) {
    console.error("Preview creation error:", error)
    return NextResponse.json({ error: "Failed to create preview" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const previewId = searchParams.get("id")

    if (previewId) {
      const preview = previewManager.getPreview(previewId)
      return NextResponse.json({ preview })
    }

    const previews = previewManager.getAllPreviews()
    return NextResponse.json({ previews })
  } catch (error) {
    console.error("Get preview error:", error)
    return NextResponse.json({ error: "Failed to get preview" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const previewId = searchParams.get("id")

    if (!previewId) {
      return NextResponse.json({ error: "Preview ID is required" }, { status: 400 })
    }

    await previewManager.stopPreview(previewId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Preview deletion error:", error)
    return NextResponse.json({ error: "Failed to stop preview" }, { status: 500 })
  }
}
