"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"
import { Download, Package } from "lucide-react"

interface ProjectExportDialogProps {
  open: boolean
  onClose: () => void
  onExport: (options: ExportOptions) => Promise<void>
  projectName?: string
}

interface ExportOptions {
  includeNodeModules: boolean
  includeDotFiles: boolean
  excludePatterns: string[]
  compression: "none" | "fast" | "best"
}

export function ProjectExportDialog({ open, onClose, onExport, projectName = "project" }: ProjectExportDialogProps) {
  const [options, setOptions] = useState<ExportOptions>({
    includeNodeModules: false,
    includeDotFiles: false,
    excludePatterns: [],
    compression: "fast",
  })
  const [customExcludes, setCustomExcludes] = useState("")
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const exportOptions = {
        ...options,
        excludePatterns: customExcludes
          .split("\n")
          .map((pattern) => pattern.trim())
          .filter(Boolean),
      }
      await onExport(exportOptions)
      onClose()
    } catch (error) {
      console.error("Export failed:", error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Export Project
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeNodeModules"
                checked={options.includeNodeModules}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({ ...prev, includeNodeModules: checked as boolean }))
                }
              />
              <Label htmlFor="includeNodeModules" className="text-sm">
                Include node_modules
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeDotFiles"
                checked={options.includeDotFiles}
                onCheckedChange={(checked) => setOptions((prev) => ({ ...prev, includeDotFiles: checked as boolean }))}
              />
              <Label htmlFor="includeDotFiles" className="text-sm">
                Include hidden files (.env, .gitignore, etc.)
              </Label>
            </div>
          </div>

          <div>
            <Label htmlFor="compression" className="text-sm font-medium">
              Compression Level
            </Label>
            <select
              id="compression"
              value={options.compression}
              onChange={(e) => setOptions((prev) => ({ ...prev, compression: e.target.value as any }))}
              className="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="none">None (Fastest)</option>
              <option value="fast">Fast (Recommended)</option>
              <option value="best">Best (Smallest)</option>
            </select>
          </div>

          <div>
            <Label htmlFor="excludePatterns" className="text-sm font-medium">
              Additional Exclude Patterns
            </Label>
            <Textarea
              id="excludePatterns"
              placeholder="*.log&#10;temp/**&#10;*.tmp"
              value={customExcludes}
              onChange={(e) => setCustomExcludes(e.target.value)}
              className="mt-1 h-20 text-xs"
            />
            <p className="text-xs text-gray-500 mt-1">One pattern per line. Use * for wildcards, ** for directories.</p>
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-xs text-gray-600">
              <strong>Default excludes:</strong> node_modules, .git, dist, build, .next, coverage, *.log
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? "Exporting..." : "Export ZIP"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
