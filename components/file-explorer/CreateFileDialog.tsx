"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"

interface CreateFileDialogProps {
  type: "file" | "directory"
  parentPath: string
  onConfirm: (name: string, type: "file" | "directory", parentPath: string) => void
  onCancel: () => void
}

export function CreateFileDialog({ type, parentPath, onConfirm, onCancel }: CreateFileDialogProps) {
  const [name, setName] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onConfirm(name.trim(), type, parentPath)
    }
  }

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New {type === "file" ? "File" : "Directory"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === "file" ? "filename.txt" : "directory-name"}
                autoFocus
              />
            </div>

            {parentPath && (
              <div>
                <Label>Location</Label>
                <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">{parentPath}</div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create {type === "file" ? "File" : "Directory"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
