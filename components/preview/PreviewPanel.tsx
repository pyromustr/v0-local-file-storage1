"use client"

import { useState, useEffect, useCallback } from "react"
import type { PreviewInstance, PreviewManager } from "../../lib/local-container/preview-manager"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Play, Square, RotateCcw, ExternalLink, Plus, X, Globe, AlertCircle } from "lucide-react"

interface PreviewPanelProps {
  previewManager: PreviewManager
  className?: string
}

export function PreviewPanel({ previewManager, className }: PreviewPanelProps) {
  const [previews, setPreviews] = useState<PreviewInstance[]>([])
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newPreviewPort, setNewPreviewPort] = useState("")

  useEffect(() => {
    // Load existing previews
    const existingPreviews = previewManager.getAllPreviews()
    setPreviews(existingPreviews)

    if (existingPreviews.length > 0 && !activePreviewId) {
      setActivePreviewId(existingPreviews[0].id)
    }

    // Listen for preview events
    const handlePreviewStarted = (preview: PreviewInstance) => {
      setPreviews((prev) => {
        const existing = prev.find((p) => p.id === preview.id)
        if (existing) {
          return prev.map((p) => (p.id === preview.id ? preview : p))
        }
        return [...prev, preview]
      })
    }

    const handlePreviewStopped = (preview: PreviewInstance) => {
      setPreviews((prev) => prev.filter((p) => p.id !== preview.id))
      if (activePreviewId === preview.id) {
        const remaining = previews.filter((p) => p.id !== preview.id)
        setActivePreviewId(remaining.length > 0 ? remaining[0].id : null)
      }
    }

    const handlePreviewError = (preview: PreviewInstance, error: any) => {
      console.error("Preview error:", error)
      setPreviews((prev) => prev.map((p) => (p.id === preview.id ? { ...p, status: "error" } : p)))
    }

    previewManager.on("previewStarted", handlePreviewStarted)
    previewManager.on("previewStopped", handlePreviewStopped)
    previewManager.on("previewRestarted", handlePreviewStarted)
    previewManager.on("previewError", handlePreviewError)

    return () => {
      previewManager.off("previewStarted", handlePreviewStarted)
      previewManager.off("previewStopped", handlePreviewStopped)
      previewManager.off("previewRestarted", handlePreviewStarted)
      previewManager.off("previewError", handlePreviewError)
    }
  }, [previewManager, activePreviewId, previews])

  const handleCreatePreview = useCallback(async () => {
    try {
      setIsCreating(true)
      const port = newPreviewPort ? Number.parseInt(newPreviewPort) : undefined
      const preview = await previewManager.createPreview(".", { port })
      setActivePreviewId(preview.id)
      setNewPreviewPort("")
    } catch (error) {
      console.error("Failed to create preview:", error)
    } finally {
      setIsCreating(false)
    }
  }, [previewManager, newPreviewPort])

  const handleStopPreview = useCallback(
    async (previewId: string) => {
      await previewManager.stopPreview(previewId)
    },
    [previewManager],
  )

  const handleRestartPreview = useCallback(
    async (previewId: string) => {
      await previewManager.restartPreview(previewId)
    },
    [previewManager],
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "text-green-600"
      case "starting":
        return "text-yellow-600"
      case "stopped":
        return "text-gray-600"
      case "error":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <Globe className="w-3 h-3" />
      case "starting":
        return <RotateCcw className="w-3 h-3 animate-spin" />
      case "error":
        return <AlertCircle className="w-3 h-3" />
      default:
        return <Square className="w-3 h-3" />
    }
  }

  return (
    <div className={`preview-panel h-full flex flex-col bg-white border-l border-gray-200 ${className || ""}`}>
      {/* Header */}
      <div className="preview-header p-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-900">Preview</h3>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Port (optional)"
              value={newPreviewPort}
              onChange={(e) => setNewPreviewPort(e.target.value)}
              className="w-24 h-6 text-xs"
              type="number"
            />
            <Button variant="ghost" size="sm" onClick={handleCreatePreview} disabled={isCreating} className="h-6 px-2">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {previews.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-sm mb-4">No preview servers running</p>
            <Button onClick={handleCreatePreview} disabled={isCreating}>
              <Play className="w-4 h-4 mr-2" />
              Start Preview
            </Button>
          </div>
        </div>
      ) : (
        <Tabs value={activePreviewId || ""} onValueChange={setActivePreviewId} className="flex-1 flex flex-col">
          <TabsList className="bg-gray-50 border-b border-gray-200 rounded-none justify-start">
            {previews.map((preview) => (
              <TabsTrigger key={preview.id} value={preview.id} className="relative group data-[state=active]:bg-white">
                <div className="flex items-center gap-2">
                  <div className={getStatusColor(preview.status)}>{getStatusIcon(preview.status)}</div>
                  <span className="text-xs">:{preview.port}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 p-0 h-4 w-4 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleStopPreview(preview.id)
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </TabsTrigger>
            ))}
          </TabsList>

          {previews.map((preview) => (
            <TabsContent key={preview.id} value={preview.id} className="flex-1 m-0 p-0 flex flex-col">
              {/* Preview Controls */}
              <div className="preview-controls p-2 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRestartPreview(preview.id)}
                    disabled={preview.status === "starting"}
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(preview.url, "_blank")}
                    disabled={preview.status !== "running"}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className={getStatusColor(preview.status)}>{preview.status}</span>
                  <span>•</span>
                  <span>{preview.url}</span>
                </div>
              </div>

              {/* Preview Frame */}
              <div className="preview-frame flex-1">
                {preview.status === "running" ? (
                  <iframe
                    src={preview.url}
                    className="w-full h-full border-0"
                    title={`Preview ${preview.port}`}
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                  />
                ) : preview.status === "starting" ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <RotateCcw className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
                      <p className="text-gray-500 text-sm">Starting server...</p>
                    </div>
                  </div>
                ) : preview.status === "error" ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                      <p className="text-red-600 text-sm">Server failed to start</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 bg-transparent"
                        onClick={() => handleRestartPreview(preview.id)}
                      >
                        Try Again
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Square className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Server stopped</p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
