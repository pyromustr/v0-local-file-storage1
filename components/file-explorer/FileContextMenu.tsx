"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Edit, Trash2, Plus, FolderPlus } from "lucide-react"

interface FileContextMenuProps {
  x: number
  y: number
  filePath: string
  isDirectory: boolean
  onClose: () => void
  onDelete: (filePath: string) => void
  onRename: (oldPath: string, newName: string) => void
  onCreate: (type: "file" | "directory") => void
}

export function FileContextMenu({
  x,
  y,
  filePath,
  isDirectory,
  onClose,
  onDelete,
  onRename,
  onCreate,
}: FileContextMenuProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState("")
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [onClose])

  const handleRename = () => {
    const fileName = filePath.split("/").pop() || ""
    setNewName(fileName)
    setIsRenaming(true)
  }

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newName.trim() && newName !== filePath.split("/").pop()) {
      onRename(filePath, newName.trim())
    }
    onClose()
  }

  const handleDelete = () => {
    onDelete(filePath)
    onClose()
  }

  const handleCreateFile = () => {
    onCreate("file")
    onClose()
  }

  const handleCreateDirectory = () => {
    onCreate("directory")
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-48"
      style={{ left: x, top: y }}
    >
      {isRenaming ? (
        <form onSubmit={handleRenameSubmit} className="p-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => setIsRenaming(false)}
            autoFocus
            className="h-7 text-xs"
          />
        </form>
      ) : (
        <>
          <Button variant="ghost" size="sm" className="w-full justify-start h-8 px-3 text-xs" onClick={handleRename}>
            <Edit className="w-3 h-3 mr-2" />
            Rename
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start h-8 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleDelete}
          >
            <Trash2 className="w-3 h-3 mr-2" />
            Delete
          </Button>

          {isDirectory && (
            <>
              <div className="border-t border-gray-100 my-1" />
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 px-3 text-xs"
                onClick={handleCreateFile}
              >
                <Plus className="w-3 h-3 mr-2" />
                New File
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 px-3 text-xs"
                onClick={handleCreateDirectory}
              >
                <FolderPlus className="w-3 h-3 mr-2" />
                New Directory
              </Button>
            </>
          )}
        </>
      )}
    </div>
  )
}
