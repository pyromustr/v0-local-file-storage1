import { type NextRequest, NextResponse } from "next/server"
import { ProjectManager } from "@/lib/local-container/project-manager"

const projectManager = new ProjectManager()

export async function POST(request: NextRequest) {
  try {
    const { action, ...data } = await request.json()

    switch (action) {
      case "export":
        const exportResult = await projectManager.exportProject(data.projectPath, data.options)
        return NextResponse.json(exportResult)

      case "import":
        const importResult = await projectManager.importProject(data.filePath, data.targetPath)
        return NextResponse.json(importResult)

      case "clone":
        const cloneResult = await projectManager.cloneRepository(data.repoUrl, data.targetPath)
        return NextResponse.json(cloneResult)

      case "backup":
        const backupResult = await projectManager.createBackup(data.projectPath)
        return NextResponse.json(backupResult)

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Project operation error:", error)
    return NextResponse.json({ error: "Project operation failed" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")
    const projectPath = searchParams.get("path")

    if (action === "info" && projectPath) {
      const info = await projectManager.getProjectInfo(projectPath)
      return NextResponse.json({ info })
    }

    if (action === "list") {
      const projects = await projectManager.listProjects()
      return NextResponse.json({ projects })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Project info error:", error)
    return NextResponse.json({ error: "Failed to get project info" }, { status: 500 })
  }
}
