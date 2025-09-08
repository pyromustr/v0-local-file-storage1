"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Checkbox } from "../ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Upload, GitBranch, FolderOpen } from "lucide-react"

interface ProjectImportDialogProps {
  open: boolean
  onClose: () => void
  onImportZip: (file: File, options: ImportOptions) => Promise<void>
  onCloneRepo: (repoUrl: string, targetPath?: string) => Promise<void>
}

interface ImportOptions {
  overwrite: boolean
  targetDirectory?: string
  preserveStructure: boolean
}

export function ProjectImportDialog({ open, onClose, onImportZip, onCloneRepo }: ProjectImportDialogProps) {
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    overwrite: false,
    preserveStructure: true,
  })
  const [repoUrl, setRepoUrl] = useState("")
  const [targetPath, setTargetPath] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      await onImportZip(file, {
        ...importOptions,
        targetDirectory: targetPath || undefined,
      })
      onClose()
    } catch (error) {
      console.error("Import failed:", error)
    } finally {
      setIsImporting(false)
    }
  }

  const handleRepoClone = async () => {
    if (!repoUrl.trim()) return

    setIsImporting(true)
    try {
      await onCloneRepo(repoUrl.trim(), targetPath || undefined)
      onClose()
    } catch (error) {
      console.error("Clone failed:", error)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Project</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="zip" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="zip" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              ZIP File
            </TabsTrigger>
            <TabsTrigger value="git" className="flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              Git Repository
            </TabsTrigger>
          </TabsList>

          <TabsContent value="zip" className="space-y-4">
            <div>
              <Label htmlFor="zipFile" className="text-sm font-medium">
                Select ZIP File
              </Label>
              <div className="mt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileImport}
                  className="hidden"
                  disabled={isImporting}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="w-full"
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Choose ZIP File
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="targetPath" className="text-sm font-medium">
                Target Directory (optional)
              </Label>
              <Input
                id="targetPath"
                placeholder="Leave empty to import to current directory"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="overwrite"
                  checked={importOptions.overwrite}
                  onCheckedChange={(checked) =>
                    setImportOptions((prev) => ({ ...prev, overwrite: checked as boolean }))
                  }
                />
                <Label htmlFor="overwrite" className="text-sm">
                  Overwrite existing files
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="preserveStructure"
                  checked={importOptions.preserveStructure}
                  onCheckedChange={(checked) =>
                    setImportOptions((prev) => ({ ...prev, preserveStructure: checked as boolean }))
                  }
                />
                <Label htmlFor="preserveStructure" className="text-sm">
                  Preserve directory structure
                </Label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="git" className="space-y-4">
            <div>
              <Label htmlFor="repoUrl" className="text-sm font-medium">
                Repository URL
              </Label>
              <Input
                id="repoUrl"
                placeholder="https://github.com/user/repo.git"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="cloneTargetPath" className="text-sm font-medium">
                Target Directory (optional)
              </Label>
              <Input
                id="cloneTargetPath"
                placeholder="Leave empty to clone to current directory"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-xs text-blue-700">
                <strong>Note:</strong> Make sure you have Git installed and configured on your system.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isImporting}>
                Cancel
              </Button>
              <Button onClick={handleRepoClone} disabled={isImporting || !repoUrl.trim()}>
                <GitBranch className="w-4 h-4 mr-2" />
                {isImporting ? "Cloning..." : "Clone Repository"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>

        {/* Only show footer for ZIP tab */}
        <TabsContent value="zip" className="m-0">
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isImporting}>
              Cancel
            </Button>
          </DialogFooter>
        </TabsContent>
      </DialogContent>
    </Dialog>
  )
}
