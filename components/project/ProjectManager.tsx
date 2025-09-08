"use client"

import { useState, useCallback } from "react"
import type { ProjectManager as ProjectManagerClass } from "../../lib/local-container/project-manager"
import { ProjectExportDialog } from "./ProjectExportDialog"
import { ProjectImportDialog } from "./ProjectImportDialog"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Download, Upload, Archive, Info } from "lucide-react"

interface ProjectManagerProps {
  projectManager: ProjectManagerClass
  className?: string
}

export function ProjectManager({ projectManager, className }: ProjectManagerProps) {
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [projectInfo, setProjectInfo] = useState<any>(null)
  const [backups, setBackups] = useState<any[]>([])

  const handleExport = useCallback(
    async (options: any) => {
      try {
        const buffer = await projectManager.exportProject(options)

        // Create download link
        const blob = new Blob([buffer], { type: "application/zip" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `${projectInfo?.metadata?.name || "project"}.zip`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } catch (error) {
        console.error("Export failed:", error)
        throw error
      }
    },
    [projectManager, projectInfo],
  )

  const handleImportZip = useCallback(
    async (file: File, options: any) => {
      try {
        const buffer = await file.arrayBuffer()
        await projectManager.importProject(Buffer.from(buffer), options)
        await loadProjectInfo()
      } catch (error) {
        console.error("Import failed:", error)
        throw error
      }
    },
    [projectManager],
  )

  const handleCloneRepo = useCallback(
    async (repoUrl: string, targetPath?: string) => {
      try {
        await projectManager.cloneRepository(repoUrl, targetPath)
        await loadProjectInfo()
      } catch (error) {
        console.error("Clone failed:", error)
        throw error
      }
    },
    [projectManager],
  )

  const handleCreateBackup = useCallback(async () => {
    try {
      await projectManager.createBackup()
      await loadBackups()
    } catch (error) {
      console.error("Backup failed:", error)
    }
  }, [projectManager])

  const loadProjectInfo = useCallback(async () => {
    try {
      const info = await projectManager.getProjectInfo()
      setProjectInfo(info)
    } catch (error) {
      console.error("Failed to load project info:", error)
    }
  }, [projectManager])

  const loadBackups = useCallback(async () => {
    try {
      const backupList = await projectManager.listBackups()
      setBackups(backupList)
    } catch (error) {
      console.error("Failed to load backups:", error)
    }
  }, [projectManager])

  // Load initial data
  useState(() => {
    loadProjectInfo()
    loadBackups()
  })

  return (
    <div className={`project-manager space-y-6 ${className || ""}`}>
      {/* Project Info */}
      {projectInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Project Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Name:</strong> {projectInfo.metadata.name}
              </div>
              <div>
                <strong>Type:</strong> {projectInfo.metadata.type}
              </div>
              <div>
                <strong>Files:</strong> {projectInfo.stats.totalFiles}
              </div>
              <div>
                <strong>Size:</strong> {formatFileSize(projectInfo.stats.totalSize)}
              </div>
              {projectInfo.metadata.version && (
                <div>
                  <strong>Version:</strong> {projectInfo.metadata.version}
                </div>
              )}
              <div>
                <strong>Last Modified:</strong> {new Date(projectInfo.stats.lastModified).toLocaleDateString()}
              </div>
            </div>
            {projectInfo.metadata.description && (
              <div className="mt-4">
                <strong>Description:</strong>
                <p className="text-gray-600 mt-1">{projectInfo.metadata.description}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Export/Import Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Project Actions</CardTitle>
          <CardDescription>Export, import, or clone projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Button onClick={() => setShowExportDialog(true)} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export Project
            </Button>

            <Button onClick={() => setShowImportDialog(true)} variant="outline" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import Project
            </Button>

            <Button onClick={handleCreateBackup} variant="outline" className="flex items-center gap-2 bg-transparent">
              <Archive className="w-4 h-4" />
              Create Backup
            </Button>

            <Button onClick={loadProjectInfo} variant="outline" className="flex items-center gap-2 bg-transparent">
              <Info className="w-4 h-4" />
              Refresh Info
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backups */}
      {backups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Backups</CardTitle>
            <CardDescription>Manage your project backups</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {backups.slice(0, 5).map((backup) => (
                <div key={backup.name} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium text-sm">{backup.name}</div>
                    <div className="text-xs text-gray-500">
                      {formatFileSize(backup.size)} • {new Date(backup.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => projectManager.restoreBackup(backup.path)}
                    className="text-xs"
                  >
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <ProjectExportDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handleExport}
        projectName={projectInfo?.metadata?.name}
      />

      <ProjectImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportZip={handleImportZip}
        onCloneRepo={handleCloneRepo}
      />
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"

  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}
