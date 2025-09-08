import { NodeFileSystem } from "./file-system"
import { CacheManager } from "./cache-manager"
import type { PerformanceMonitor } from "./performance-monitor"
import { logger } from "./logger"
import type { FileStats } from "./types"

export class OptimizedFileSystem extends NodeFileSystem {
  private cache: CacheManager<string>
  private statsCache: CacheManager<FileStats>
  private performanceMonitor: PerformanceMonitor

  constructor(basePath: string, performanceMonitor: PerformanceMonitor) {
    super(basePath)
    this.cache = new CacheManager<string>(500, 60000) // 1 minute TTL for file contents
    this.statsCache = new CacheManager<FileStats>(1000, 30000) // 30 seconds TTL for stats
    this.performanceMonitor = performanceMonitor

    // Log cache events
    this.cache.on("hit", (key) => logger.debug("File cache hit", { key }))
    this.cache.on("miss", (key) => logger.debug("File cache miss", { key }))
  }

  async readFile(filePath: string): Promise<string> {
    const startTime = Date.now()

    try {
      // Check cache first
      const cached = this.cache.get(filePath)
      if (cached !== undefined) {
        this.performanceMonitor.recordFileOperation("read_cached", Date.now() - startTime)
        return cached
      }

      // Read from file system
      const content = await super.readFile(filePath)

      // Cache the content
      this.cache.set(filePath, content)

      this.performanceMonitor.recordFileOperation("read", Date.now() - startTime)
      logger.debug("File read", { path: filePath, size: content.length })

      return content
    } catch (error) {
      this.performanceMonitor.recordFileOperation("read_error", Date.now() - startTime)
      logger.error("Failed to read file", error as Error, { path: filePath })
      throw error
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const startTime = Date.now()

    try {
      await super.writeFile(filePath, content)

      // Update cache
      this.cache.set(filePath, content)

      // Invalidate stats cache
      this.statsCache.delete(filePath)

      this.performanceMonitor.recordFileOperation("write", Date.now() - startTime)
      logger.debug("File written", { path: filePath, size: content.length })
    } catch (error) {
      this.performanceMonitor.recordFileOperation("write_error", Date.now() - startTime)
      logger.error("Failed to write file", error as Error, { path: filePath })
      throw error
    }
  }

  async stat(filePath: string): Promise<FileStats> {
    const startTime = Date.now()

    try {
      // Check cache first
      const cached = this.statsCache.get(filePath)
      if (cached !== undefined) {
        this.performanceMonitor.recordFileOperation("stat_cached", Date.now() - startTime)
        return cached
      }

      // Get stats from file system
      const stats = await super.stat(filePath)

      // Cache the stats
      this.statsCache.set(filePath, stats)

      this.performanceMonitor.recordFileOperation("stat", Date.now() - startTime)
      return stats
    } catch (error) {
      this.performanceMonitor.recordFileOperation("stat_error", Date.now() - startTime)
      logger.error("Failed to get file stats", error as Error, { path: filePath })
      throw error
    }
  }

  async remove(filePath: string): Promise<void> {
    const startTime = Date.now()

    try {
      await super.remove(filePath)

      // Invalidate caches
      this.cache.delete(filePath)
      this.statsCache.delete(filePath)

      this.performanceMonitor.recordFileOperation("remove", Date.now() - startTime)
      logger.debug("File removed", { path: filePath })
    } catch (error) {
      this.performanceMonitor.recordFileOperation("remove_error", Date.now() - startTime)
      logger.error("Failed to remove file", error as Error, { path: filePath })
      throw error
    }
  }

  getCacheStats(): {
    fileCache: any
    statsCache: any
  } {
    return {
      fileCache: this.cache.getStats(),
      statsCache: this.statsCache.getStats(),
    }
  }

  clearCache(): void {
    this.cache.clear()
    this.statsCache.clear()
    logger.info("File system cache cleared")
  }

  dispose(): void {
    this.cache.dispose()
    this.statsCache.dispose()
  }
}
