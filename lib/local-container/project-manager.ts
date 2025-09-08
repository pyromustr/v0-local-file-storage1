import JSZip from "jszip"
import { promises as fs } from "fs"
import path from "path"
import type { LocalContainer, FileStats } from "./types"
import { EventEmitter } from "events"

export interface ProjectMetadata {
  name: string
  description?: string
  version?: string
  author?: string
  createdAt: Date
  updatedAt: Date
  type: "web" | "node" | "react" | "vue" | "angular" | "static" | "other"
  dependencies?: Record<string, string>
  scripts?: Record<string, string>
}

export interface ExportOptions {
  includeNodeModules?: boolean
  includeDotFiles?: boolean
  excludePatterns?: string[]
  compression?: "none" | "fast" | "best"
}

export interface ImportOptions {
  overwrite?: boolean
  targetDirectory?: string
  preserveStructure?: boolean
}

export class ProjectManager extends EventEmitter {
  private container: LocalContainer
  private projectPath: string

  constructor(container: LocalContainer) {
    super()
    this.container = container
    this.projectPath = container.workdir
  }

  async exportProject(options: ExportOptions = {}): Promise<Buffer> {
    const { includeNodeModules = false, includeDotFiles = false, excludePatterns = [], compression = "fast" } = options

    const zip = new JSZip()

    // Default exclude patterns
    const defaultExcludes = [
      "node_modules/**",
      ".git/**",
      "dist/**",
      "build/**",
      ".next/**",
      "coverage/**",
      ".nyc_output/**",
      "*.log",
      ".DS_Store",
      "Thumbs.db",
    ]

    if (!includeNodeModules) {
      defaultExcludes.push("node_modules/**")
    }

    if (!includeDotFiles) {
      defaultExcludes.push(".*")
    }

    const allExcludes = [...defaultExcludes, ...excludePatterns]

    // Add project metadata
    const metadata = await this.generateProjectMetadata()
    zip.file("bolt-project.json", JSON.stringify(metadata, null, 2))

    // Add files recursively
    await this.addDirectoryToZip(zip, ".", allExcludes)

    // Generate ZIP buffer
    const compressionLevel = compression === "none" ? 0 : compression === "fast" ? 1 : 9

    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: compressionLevel },
    })

    this.emit("projectExported", { size: buffer.length, metadata })
    return buffer
  }

  private async addDirectoryToZip(zip: JSZip, dirPath: string, excludePatterns: string[]): Promise<void> {
    try {
      const entries = await this.container.fs.readdir(dirPath)

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry)
        const relativePath = path.relative(".", entryPath)

        // Check if file should be excluded
        if (this.shouldExclude(relativePath, excludePatterns)) {
          continue
        }

        try {
          const stats = await this.container.fs.stat(entryPath)

          if (stats.isDirectory()) {
            // Add directory and recurse
            zip.folder(relativePath)
            await this.addDirectoryToZip(zip, entryPath, excludePatterns)
          } else if (stats.isFile()) {
            // Add file content
            const content = await this.container.fs.readFile(entryPath)
            zip.file(relativePath, content)
          }
        } catch (error) {
          console.warn(`Failed to process ${entryPath}:`, error)
        }
      }
    } catch (error) {
      console.warn(`Failed to read directory ${dirPath}:`, error)
    }
  }

  private shouldExclude(filePath: string, excludePatterns: string[]): boolean {
    const normalizedPath = filePath.replace(/\\/g, "/")

    return excludePatterns.some((pattern) => {
      // Convert glob pattern to regex
      const regexPattern = pattern
        .replace(/\./g, "\\.")
        .replace(/\*\*/g, ".*")
        .replace(/\*/g, "[^/]*")
        .replace(/\?/g, "[^/]")

      const regex = new RegExp(`^${regexPattern}$`)
      return regex.test(normalizedPath)
    })
  }

  async importProject(zipBuffer: Buffer, options: ImportOptions = {}): Promise<void> {
    const { overwrite = false, targetDirectory, preserveStructure = true } = options

    const zip = new JSZip()
    const zipContent = await zip.loadAsync(zipBuffer)

    // Check if target directory should be cleared
    const importPath = targetDirectory || this.projectPath

    if (overwrite && (await this.container.fs.exists(importPath))) {
      // Backup existing project first
      await this.createBackup()

      // Clear directory (except for .git if it exists)
      await this.clearDirectory(importPath, [".git"])
    }

    // Ensure import directory exists
    await this.container.fs.mkdir(importPath, { recursive: true })

    // Extract files
    const extractPromises: Promise<void>[] = []

    zipContent.forEach((relativePath, file) => {
      if (!file.dir && relativePath !== "bolt-project.json") {
        const extractPromise = this.extractFile(file, relativePath, importPath, preserveStructure)
        extractPromises.push(extractPromise)
      }
    })

    await Promise.all(extractPromises)

    // Load project metadata if available
    const metadataFile = zipContent.file("bolt-project.json")
    if (metadataFile) {
      const metadataContent = await metadataFile.async("string")
      const metadata = JSON.parse(metadataContent)
      this.emit("projectImported", { metadata, path: importPath })
    } else {
      this.emit("projectImported", { path: importPath })
    }
  }

  private async extractFile(
    file: JSZip.JSZipObject,
    relativePath: string,
    importPath: string,
    preserveStructure: boolean,
  ): Promise<void> {
    try {
      const content = await file.async("string")
      const targetPath = preserveStructure
        ? path.join(importPath, relativePath)
        : path.join(importPath, path.basename(relativePath))

      await this.container.fs.writeFile(targetPath, content)
    } catch (error) {
      console.warn(`Failed to extract ${relativePath}:`, error)
    }
  }

  private async clearDirectory(dirPath: string, preserve: string[] = []): Promise<void> {
    try {
      const entries = await this.container.fs.readdir(dirPath)

      for (const entry of entries) {
        if (preserve.includes(entry)) continue

        const entryPath = path.join(dirPath, entry)
        await this.container.fs.remove(entryPath)
      }
    } catch (error) {
      console.warn(`Failed to clear directory ${dirPath}:`, error)
    }
  }

  async cloneRepository(repoUrl: string, targetPath?: string): Promise<void> {
    const clonePath = targetPath || this.projectPath

    try {
      // Use git clone command
      const process = await this.container.terminal.spawn("git", ["clone", repoUrl, clonePath])

      // Wait for process to complete
      await new Promise<void>((resolve, reject) => {
        process.onExit((code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`Git clone failed with exit code ${code}`))
          }
        })
      })

      this.emit("repositoryCloned", { url: repoUrl, path: clonePath })
    } catch (error) {
      console.error("Failed to clone repository:", error)
      throw error
    }
  }

  async createBackup(backupName?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const name = backupName || `backup-${timestamp}`
    const backupPath = path.join(process.cwd(), "backups", name)

    // Create backup directory
    await fs.mkdir(path.dirname(backupPath), { recursive: true })

    // Export current project
    const zipBuffer = await this.exportProject({
      includeNodeModules: false,
      includeDotFiles: true,
    })

    // Save backup
    await fs.writeFile(`${backupPath}.zip`, zipBuffer)

    this.emit("backupCreated", { name, path: `${backupPath}.zip` })
    return `${backupPath}.zip`
  }

  async restoreBackup(backupPath: string): Promise<void> {
    const zipBuffer = await fs.readFile(backupPath)
    await this.importProject(zipBuffer, { overwrite: true })

    this.emit("backupRestored", { path: backupPath })
  }

  async listBackups(): Promise<Array<{ name: string; path: string; size: number; createdAt: Date }>> {
    const backupsDir = path.join(process.cwd(), "backups")

    try {
      await fs.access(backupsDir)
    } catch {
      return []
    }

    const entries = await fs.readdir(backupsDir)
    const backups: Array<{ name: string; path: string; size: number; createdAt: Date }> = []

    for (const entry of entries) {
      if (entry.endsWith(".zip")) {
        const backupPath = path.join(backupsDir, entry)
        const stats = await fs.stat(backupPath)

        backups.push({
          name: entry.replace(".zip", ""),
          path: backupPath,
          size: stats.size,
          createdAt: stats.birthtime,
        })
      }
    }

    return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  private async generateProjectMetadata(): Promise<ProjectMetadata> {
    const metadata: ProjectMetadata = {
      name: path.basename(this.projectPath),
      createdAt: new Date(),
      updatedAt: new Date(),
      type: "other",
    }

    try {
      // Try to read package.json for additional metadata
      const packageJsonExists = await this.container.fs.exists("package.json")

      if (packageJsonExists) {
        const packageJson = JSON.parse(await this.container.fs.readFile("package.json"))

        metadata.name = packageJson.name || metadata.name
        metadata.description = packageJson.description
        metadata.version = packageJson.version
        metadata.author = packageJson.author
        metadata.dependencies = packageJson.dependencies
        metadata.scripts = packageJson.scripts

        // Detect project type based on dependencies
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }

        if (deps.react) metadata.type = "react"
        else if (deps.vue) metadata.type = "vue"
        else if (deps["@angular/core"]) metadata.type = "angular"
        else if (deps.express || deps.fastify || deps.koa) metadata.type = "node"
        else if (packageJson.scripts?.build || packageJson.scripts?.dev) metadata.type = "web"
        else metadata.type = "static"
      }
    } catch (error) {
      console.warn("Failed to read package.json for metadata:", error)
    }

    return metadata
  }

  async getProjectInfo(): Promise<{
    metadata: ProjectMetadata
    stats: {
      totalFiles: number
      totalSize: number
      lastModified: Date
    }
  }> {
    const metadata = await this.generateProjectMetadata()
    const stats = await this.calculateProjectStats()

    return { metadata, stats }
  }

  private async calculateProjectStats(): Promise<{
    totalFiles: number
    totalSize: number
    lastModified: Date
  }> {
    let totalFiles = 0
    let totalSize = 0
    let lastModified = new Date(0)

    await this.walkDirectory(".", (filePath, stats) => {
      if (stats.isFile()) {
        totalFiles++
        totalSize += stats.size
        if (stats.mtime > lastModified) {
          lastModified = stats.mtime
        }
      }
    })

    return { totalFiles, totalSize, lastModified }
  }

  private async walkDirectory(dirPath: string, callback: (filePath: string, stats: FileStats) => void): Promise<void> {
    try {
      const entries = await this.container.fs.readdir(dirPath)

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry)

        // Skip common ignore patterns
        if (this.shouldExclude(entryPath, ["node_modules/**", ".git/**", "dist/**", "build/**"])) {
          continue
        }

        try {
          const stats = await this.container.fs.stat(entryPath)
          callback(entryPath, stats)

          if (stats.isDirectory()) {
            await this.walkDirectory(entryPath, callback)
          }
        } catch (error) {
          console.warn(`Failed to stat ${entryPath}:`, error)
        }
      }
    } catch (error) {
      console.warn(`Failed to read directory ${dirPath}:`, error)
    }
  }
}
