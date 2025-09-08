import { type NextRequest, NextResponse } from "next/server"
import { PreviewManager } from "../../lib/local-container/preview-manager"
import { getLocalContainer } from "../../lib/local-container"

let previewManager: PreviewManager | null = null

export async function POST(request: NextRequest) {
  try {
    const { projectPath = ".", port, env } = await request.json()

    // Initialize preview manager if not exists
    if (!previewManager) {
      const container = await getLocalContainer()
      previewManager = new PreviewManager(container)
    }

    const preview = await previewManager.createPreview(projectPath, { port, env })

    return NextResponse.json({
      success: true,
      preview: {
        id: preview.id,
        port: preview.port,
        url: preview.url,
        status: preview.status,
      },
    })
  } catch (error) {
    console.error("Failed to create preview:", error)
    return NextResponse.json({ success: false, error: "Failed to create preview" }, { status: 500 })
  }
}
