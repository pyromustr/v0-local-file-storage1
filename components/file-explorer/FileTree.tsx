"use client"

import type React from "react"

import { useState, useCallback } from "react"
import type { FileNode } from "../../lib/local-container/file-manager"
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react"

interface FileTreeProps {
  node: FileNode
  selectedFile?: string | null
  onFileSelect?: (filePath: string) => void
  onFileOpen?: (filePath: string) => void
  onContextMenu?: (event: React.MouseEvent, filePath: string, isDirectory: boolean) => void
  level?: number
}

export function FileTree({ node, selectedFile, onFileSelect, onFileOpen, onContextMenu, level = 0 }: FileTreeProps) {
  const [expanded, setExpanded] = useState(node.expanded ?? level < 2)

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()

      if (node.type === "directory") {
        setExpanded(!expanded)
      } else {
        onFileSelect?.(node.path)
      }
    },
    [node.type, node.path, expanded, onFileSelect],
  )

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()

      if (node.type === "file") {
        onFileOpen?.(node.path)
      }
    },
    [node.type, node.path, onFileOpen],
  )

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      onContextMenu?.(event, node.path, node.type === "directory")
    },
    [node.path, node.type, onContextMenu],
  )

  const isSelected = selectedFile === node.path
  const paddingLeft = level * 12 + 8

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-item flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 ${
          isSelected ? "bg-blue-100 text-blue-900" : "text-gray-700"
        }`}
        style={{ paddingLeft }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {node.type === "directory" && (
          <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </div>
        )}

        <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center ml-1">
          {node.type === "directory" ? (
            expanded ? (
              <FolderOpen className="w-3 h-3 text-blue-500" />
            ) : (
              <Folder className="w-3 h-3 text-blue-500" />
            )
          ) : (
            <File className="w-3 h-3 text-gray-500" />
          )}
        </div>

        <span className="ml-2 text-xs truncate flex-1">{node.name}</span>

        {node.type === "file" && node.size !== undefined && (
          <span className="text-xs text-gray-400 ml-2">{formatFileSize(node.size)}</span>
        )}
      </div>

      {node.type === "directory" && expanded && node.children && (
        <div className="file-tree-children">
          {node.children.map((child) => (
            <FileTree
              key={child.path}
              node={child}
              selectedFile={selectedFile}
              onFileSelect={onFileSelect}
              onFileOpen={onFileOpen}
              onContextMenu={onContextMenu}
              level={level + 1}
            />
          ))}
        </div>
      )}
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
