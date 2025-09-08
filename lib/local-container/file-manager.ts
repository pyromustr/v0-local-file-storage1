import type { LocalFileSystem, FileStats } from "./types"
import { FileWatcher, type FileChangeEvent } from "./file-watcher"
import { EventEmitter } from "events"
import path from "path"

export interface FileNode {
  name: string
  path: string
  type: "file" | "directory"
  size?: number
  mtime?: Date
  children?: FileNode[]
  expanded?: boolean
}

export interface FileSearchResult {
  path: string
  name: string
  type: "file" | "directory"
  matches: Array<{
    line: number
    content: string
    start: number
    end: number
  }>
}

export class FileManager extends EventEmitter {
  private fs: LocalFileSystem
  private watcher: FileWatcher
  private fileTree: FileNode | null = null

  constructor(fs: LocalFileSystem, workdir: string) {
    super()
    this.fs = fs
    this.watcher = new FileWatcher(workdir)

    // Forward file change events
    this.watcher.on("change", (event: FileChangeEvent) => {
      this.emit("fileChange", event)
      this.refreshFileTree() // Refresh tree on changes
    })
  }

  async initialize(): Promise<void> {
    await this.refreshFileTree()
    this.watcher.start()
  }

  async refreshFileTree(): Promise<FileNode> {
    this.fileTree = await this.buildFileTree(".")
    this.emit("treeUpdated", this.fileTree)
    return this.fileTree
  }

  private async buildFileTree(dirPath: string): Promise<FileNode> {
    const stats = await this.fs.stat(dirPath)
    const name = path.basename(dirPath) || "root"

    const node: FileNode = {
      name,
      path: dirPath,
      type: stats.isDirectory() ? "directory" : "file",
      size: stats.size,
      mtime: stats.mtime,
    }

    if (stats.isDirectory()) {
      try {
        const entries = await this.fs.readdir(dirPath)
        node.children = []

        for (const entry of entries) {
          // Skip hidden files and common ignore patterns
          if (this.shouldIgnoreFile(entry)) continue

          const entryPath = path.join(dirPath, entry)
          try {
            const childNode = await this.buildFileTree(entryPath)
            node.children.push(childNode)
          } catch (error) {
            console.warn(`Failed to read ${entryPath}:`, error)
          }
        }

        // Sort children: directories first, then files
        node.children.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === "directory" ? -1 : 1
          }
          return a.name.localeCompare(b.name)
        })
      } catch (error) {
        console.warn(`Failed to read directory ${dirPath}:`, error)
      }
    }

    return node
  }

  private shouldIgnoreFile(filename: string): boolean {
    const ignorePatterns = [
      /^\./, // Hidden files
      /node_modules/,
      /\.git$/,
      /dist$/,
      /build$/,
      /\.next$/,
      /coverage$/,
      /\.nyc_output$/,
    ]

    return ignorePatterns.some((pattern) => pattern.test(filename))
  }

  async createFile(filePath: string, content = ""): Promise<void> {
    await this.fs.writeFile(filePath, content)
    this.emit("fileCreated", { path: filePath, content })
  }

  async createDirectory(dirPath: string): Promise<void> {
    await this.fs.mkdir(dirPath, { recursive: true })
    this.emit("directoryCreated", { path: dirPath })
  }

  async deleteFile(filePath: string): Promise<void> {
    await this.fs.remove(filePath)
    this.emit("fileDeleted", { path: filePath })
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    // Read content, write to new location, delete old
    const stats = await this.fs.stat(oldPath)

    if (stats.isFile()) {
      const content = await this.fs.readFile(oldPath)
      await this.fs.writeFile(newPath, content)
    } else {
      await this.fs.mkdir(newPath, { recursive: true })
      // Copy directory contents recursively
      await this.copyDirectory(oldPath, newPath)
    }

    await this.fs.remove(oldPath)
    this.emit("fileRenamed", { oldPath, newPath })
  }

  private async copyDirectory(srcDir: string, destDir: string): Promise<void> {
    const entries = await this.fs.readdir(srcDir)

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry)
      const destPath = path.join(destDir, entry)
      const stats = await this.fs.stat(srcPath)

      if (stats.isDirectory()) {
        await this.fs.mkdir(destPath, { recursive: true })
        await this.copyDirectory(srcPath, destPath)
      } else {
        const content = await this.fs.readFile(srcPath)
        await this.fs.writeFile(destPath, content)
      }
    }
  }

  async readFile(filePath: string): Promise<string> {
    return await this.fs.readFile(filePath)
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await this.fs.writeFile(filePath, content)
    this.emit("fileUpdated", { path: filePath, content })
  }

  async searchFiles(
    query: string,
    options: {
      includeContent?: boolean
      filePattern?: RegExp
      maxResults?: number
    } = {},
  ): Promise<FileSearchResult[]> {
    const results: FileSearchResult[] = []
    const { includeContent = false, filePattern, maxResults = 100 } = options

    await this.searchInNode(this.fileTree || (await this.refreshFileTree()), query, results, {
      includeContent,
      filePattern,
      maxResults,
    })

    return results.slice(0, maxResults)
  }

  private async searchInNode(
    node: FileNode,
    query: string,
    results: FileSearchResult[],
    options: { includeContent?: boolean; filePattern?: RegExp; maxResults?: number },
  ): Promise<void> {
    if (results.length >= (options.maxResults || 100)) return

    // Check if filename matches
    const nameMatches = node.name.toLowerCase().includes(query.toLowerCase())

    if (node.type === "file") {
      if (nameMatches || !options.filePattern || options.filePattern.test(node.name)) {
        const result: FileSearchResult = {
          path: node.path,
          name: node.name,
          type: "file",
          matches: [],
        }

        // Search file content if requested
        if (options.includeContent && this.isTextFile(node.name)) {
          try {
            const content = await this.fs.readFile(node.path)
            const lines = content.split("\n")

            lines.forEach((line, index) => {
              const lowerLine = line.toLowerCase()
              const lowerQuery = query.toLowerCase()
              let searchIndex = 0

              while ((searchIndex = lowerLine.indexOf(lowerQuery, searchIndex)) !== -1) {
                result.matches.push({
                  line: index + 1,
                  content: line,
                  start: searchIndex,
                  end: searchIndex + query.length,
                })
                searchIndex += query.length
              }
            })
          } catch (error) {
            console.warn(`Failed to read file ${node.path} for content search:`, error)
          }
        }

        if (nameMatches || result.matches.length > 0) {
          results.push(result)
        }
      }
    } else if (node.children) {
      // Search in directory children
      for (const child of node.children) {
        await this.searchInNode(child, query, results, options)
        if (results.length >= (options.maxResults || 100)) break
      }
    }
  }

  private isTextFile(filename: string): boolean {
    const textExtensions = [
      ".txt",
      ".md",
      ".js",
      ".ts",
      ".jsx",
      ".tsx",
      ".json",
      ".css",
      ".scss",
      ".html",
      ".xml",
      ".yaml",
      ".yml",
      ".toml",
      ".ini",
      ".conf",
      ".py",
      ".java",
      ".c",
      ".cpp",
      ".h",
      ".hpp",
      ".rs",
      ".go",
      ".php",
      ".rb",
      ".sh",
      ".bash",
      ".zsh",
      ".fish",
      ".ps1",
      ".bat",
      ".cmd",
    ]

    const ext = path.extname(filename).toLowerCase()
    return textExtensions.includes(ext) || !ext // Include files without extension
  }

  getFileTree(): FileNode | null {
    return this.fileTree
  }

  async fileExists(filePath: string): Promise<boolean> {
    return await this.fs.exists(filePath)
  }

  async getFileStats(filePath: string): Promise<FileStats> {
    return await this.fs.stat(filePath)
  }

  dispose(): void {
    this.watcher.stop()
    this.removeAllListeners()
  }
}
