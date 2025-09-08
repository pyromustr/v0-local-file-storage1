import { promises as fs } from "fs"
import path from "path"
import type { LocalFileSystem, FileStats } from "./types"

export class NodeFileSystem implements LocalFileSystem {
  private basePath: string

  constructor(basePath: string) {
    this.basePath = path.resolve(basePath)
  }

  private resolvePath(filePath: string): string {
    const resolved = path.resolve(this.basePath, filePath)
    // Security check: ensure path is within basePath
    if (!resolved.startsWith(this.basePath)) {
      throw new Error(`Path ${filePath} is outside of allowed directory`)
    }
    return resolved
  }

  async readFile(filePath: string): Promise<string> {
    const fullPath = this.resolvePath(filePath)
    return await fs.readFile(fullPath, "utf-8")
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(filePath)
    const dir = path.dirname(fullPath)

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(fullPath, content, "utf-8")
  }

  async readdir(dirPath: string): Promise<string[]> {
    const fullPath = this.resolvePath(dirPath)
    return await fs.readdir(fullPath)
  }

  async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
    const fullPath = this.resolvePath(dirPath)
    await fs.mkdir(fullPath, options)
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(filePath)
      await fs.access(fullPath)
      return true
    } catch {
      return false
    }
  }

  async remove(filePath: string): Promise<void> {
    const fullPath = this.resolvePath(filePath)
    const stats = await fs.stat(fullPath)

    if (stats.isDirectory()) {
      await fs.rmdir(fullPath, { recursive: true })
    } else {
      await fs.unlink(fullPath)
    }
  }

  async stat(filePath: string): Promise<FileStats> {
    const fullPath = this.resolvePath(filePath)
    const stats = await fs.stat(fullPath)

    return {
      isFile: () => stats.isFile(),
      isDirectory: () => stats.isDirectory(),
      size: stats.size,
      mtime: stats.mtime,
    }
  }
}
