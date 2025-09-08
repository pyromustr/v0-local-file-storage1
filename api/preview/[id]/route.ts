import { type NextRequest, NextResponse } from "next/server"
import { PreviewManager } from "../../../lib/local-container/preview-manager"
import { getLocalContainer } from "../../../lib/local-container"

let previewManager: PreviewManager | null = null

async function getPreviewManager() {
  if (!previewManager) {
    const container = await getLocalContainer()
    previewManager = new PreviewManager(container)
  }
  return previewManager
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const manager = await getPreviewManager()
    const success = await manager.stopPreview(params.id)

    return NextResponse.json({ success })
  } catch (error) {
    console.error("Failed to stop preview:", error)
    return NextResponse.json({ success: false, error: "Failed to stop preview" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { action } = await request.json()
    const manager = await getPreviewManager()

    if (action === "restart") {
      const success = await manager.restartPreview(params.id)
      return NextResponse.json({ success })
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Failed to perform preview action:", error)
    return NextResponse.json({ success: false, error: "Failed to perform action" }, { status: 500 })
  }
}
