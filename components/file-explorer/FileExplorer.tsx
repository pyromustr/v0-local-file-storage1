"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import type { FileNode, FileManager } from "../../lib/local-container/file-manager"
import { FileTree } from "./FileTree"
import { FileContextMenu } from "./FileContextMenu"
import { CreateFileDialog } from "./CreateFileDialog"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Search, Plus, FolderPlus, RefreshCw } from "lucide-react"

interface FileExplorerProps {
  fileManager: FileManager
  onFileSelect?: (filePath: string) => void
  onFileOpen?: (filePath: string) => void
  className?: string
}

export function FileExplorer({ fileManager, onFileSelect, onFileOpen, className }: FileExplorerProps) {
  const [fileTree, setFileTree] = useState<FileNode | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    filePath: string
    isDirectory: boolean
  } | null>(null)
  const [createDialog, setCreateDialog] = useState<{
    type: "file" | "directory"
    parentPath: string
  } | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    // Initialize file manager and load file tree
    const initializeFileManager = async () => {
      try {
        await fileManager.initialize()
        const tree = fileManager.getFileTree()
        setFileTree(tree)
      } catch (error) {
        console.error("Failed to initialize file manager:", error)
      }
    }

    initializeFileManager()

    // Listen for file tree updates
    const handleTreeUpdate = (tree: FileNode) => {
      setFileTree(tree)
    }

    fileManager.on("treeUpdated", handleTreeUpdate)

    return () => {
      fileManager.off("treeUpdated", handleTreeUpdate)
    }
  }, [fileManager])

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([])
        setIsSearching(false)
        return
      }

      setIsSearching(true)
      try {
        const results = await fileManager.searchFiles(query, {
          includeContent: true,
          maxResults: 50,
        })
        setSearchResults(results)
      } catch (error) {
        console.error("Search failed:", error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    },
    [fileManager],
  )

  const handleFileSelect = useCallback(
    (filePath: string) => {
      setSelectedFile(filePath)
      onFileSelect?.(filePath)
    },
    [onFileSelect],
  )

  const handleFileOpen = useCallback(
    (filePath: string) => {
      onFileOpen?.(filePath)
    },
    [onFileOpen],
  )

  const handleContextMenu = useCallback((event: React.MouseEvent, filePath: string, isDirectory: boolean) => {
    event.preventDefault()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      filePath,
      isDirectory,
    })
  }, [])

  const handleCreateFile = useCallback(
    async (name: string, type: "file" | "directory", parentPath: string) => {
      try {
        const fullPath = parentPath ? `${parentPath}/${name}` : name

        if (type === "file") {
          await fileManager.createFile(fullPath)
        } else {
          await fileManager.createDirectory(fullPath)
        }

        setCreateDialog(null)
      } catch (error) {
        console.error(`Failed to create ${type}:`, error)
      }
    },
    [fileManager],
  )

  const handleDeleteFile = useCallback(
    async (filePath: string) => {
      if (confirm(`Are you sure you want to delete ${filePath}?`)) {
        try {
          await fileManager.deleteFile(filePath)
        } catch (error) {
          console.error("Failed to delete file:", error)
        }
      }
    },
    [fileManager],
  )

  const handleRenameFile = useCallback(
    async (oldPath: string, newName: string) => {
      try {
        const parentDir = oldPath.split("/").slice(0, -1).join("/")
        const newPath = parentDir ? `${parentDir}/${newName}` : newName
        await fileManager.renameFile(oldPath, newPath)
      } catch (error) {
        console.error("Failed to rename file:", error)
      }
    },
    [fileManager],
  )

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fileManager.refreshFileTree()
    } catch (error) {
      console.error("Failed to refresh file tree:", error)
    } finally {
      setIsRefreshing(false)
    }
  }, [fileManager])

  return (
    <div className={`file-explorer flex flex-col h-full bg-gray-50 border-r border-gray-200 ${className || ""}`}>
      {/* Header */}
      <div className="file-explorer-header p-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-900">Files</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCreateDialog({ type: "file", parentPath: "" })}
              className="h-6 w-6 p-0"
            >
              <Plus className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCreateDialog({ type: "directory", parentPath: "" })}
              className="h-6 w-6 p-0"
            >
              <FolderPlus className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="h-6 w-6 p-0">
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              handleSearch(e.target.value)
            }}
            className="pl-7 h-7 text-xs"
          />
        </div>
      </div>

      {/* Content */}
      <div className="file-explorer-content flex-1 overflow-auto">
        {searchQuery && searchResults.length > 0 ? (
          <div className="search-results p-2">
            <div className="text-xs text-gray-500 mb-2">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
            </div>
            {searchResults.map((result, index) => (
              <div
                key={index}
                className="search-result p-2 hover:bg-gray-100 cursor-pointer rounded text-xs"
                onClick={() => handleFileOpen(result.path)}
              >
                <div className="font-medium text-gray-900">{result.name}</div>
                <div className="text-gray-500 truncate">{result.path}</div>
                {result.matches.length > 0 && (
                  <div className="text-gray-400 text-xs mt-1">
                    {result.matches.length} match{result.matches.length !== 1 ? "es" : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : searchQuery && !isSearching ? (
          <div className="p-4 text-center text-gray-500 text-sm">No files found</div>
        ) : (
          fileTree && (
            <FileTree
              node={fileTree}
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              onFileOpen={handleFileOpen}
              onContextMenu={handleContextMenu}
            />
          )
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          filePath={contextMenu.filePath}
          isDirectory={contextMenu.isDirectory}
          onClose={() => setContextMenu(null)}
          onDelete={handleDeleteFile}
          onRename={handleRenameFile}
          onCreate={(type) => {
            setCreateDialog({ type, parentPath: contextMenu.filePath })
            setContextMenu(null)
          }}
        />
      )}

      {/* Create Dialog */}
      {createDialog && (
        <CreateFileDialog
          type={createDialog.type}
          parentPath={createDialog.parentPath}
          onConfirm={handleCreateFile}
          onCancel={() => setCreateDialog(null)}
        />
      )}
    </div>
  )
}
