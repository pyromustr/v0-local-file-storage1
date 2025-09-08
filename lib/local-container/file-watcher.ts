import { watch, type FSWatcher } from "chokidar"
import { EventEmitter } from "events"
import path from "path"

export interface FileChangeEvent {
  type: "add" | "change" | "unlink" | "addDir" | "unlinkDir"
  path: string
  stats?: {
    size: number
    mtime: Date
    isFile: boolean
    isDirectory: boolean
  }
}

export class FileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null
  private watchedPath: string
  private isWatching = false

  constructor(watchPath: string) {
    super()
    this.watchedPath = path.resolve(watchPath)
  }

  start(): void {
    if (this.isWatching) return

    this.watcher = watch(this.watchedPath, {
      ignored: /(^|[/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: false,
      followSymlinks: false,
      depth: 10,
    })

    this.watcher
      .on("add", (filePath, stats) => {
        this.emit("change", {
          type: "add",
          path: path.relative(this.watchedPath, filePath),
          stats: stats
            ? {
                size: stats.size,
                mtime: stats.mtime,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory(),
              }
            : undefined,
        } as FileChangeEvent)
      })
      .on("change", (filePath, stats) => {
        this.emit("change", {
          type: "change",
          path: path.relative(this.watchedPath, filePath),
          stats: stats
            ? {
                size: stats.size,
                mtime: stats.mtime,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory(),
              }
            : undefined,
        } as FileChangeEvent)
      })
      .on("unlink", (filePath) => {
        this.emit("change", {
          type: "unlink",
          path: path.relative(this.watchedPath, filePath),
        } as FileChangeEvent)
      })
      .on("addDir", (dirPath, stats) => {
        this.emit("change", {
          type: "addDir",
          path: path.relative(this.watchedPath, dirPath),
          stats: stats
            ? {
                size: stats.size,
                mtime: stats.mtime,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory(),
              }
            : undefined,
        } as FileChangeEvent)
      })
      .on("unlinkDir", (dirPath) => {
        this.emit("change", {
          type: "unlinkDir",
          path: path.relative(this.watchedPath, dirPath),
        } as FileChangeEvent)
      })
      .on("error", (error) => {
        this.emit("error", error)
      })

    this.isWatching = true
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    this.isWatching = false
  }

  isActive(): boolean {
    return this.isWatching
  }
}
