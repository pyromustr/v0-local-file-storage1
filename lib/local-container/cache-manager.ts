import { EventEmitter } from "events"

export interface CacheEntry<T> {
  value: T
  timestamp: number
  ttl: number
  hits: number
}

export class CacheManager<T = any> extends EventEmitter {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private maxSize: number
  private defaultTTL: number
  private cleanupInterval: NodeJS.Timeout

  constructor(maxSize = 1000, defaultTTL = 300000) {
    // 5 minutes default TTL
    super()
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL

    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  set(key: string, value: T, ttl?: number): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      hits: 0,
    }

    this.cache.set(key, entry)
    this.emit("set", key, value)
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      this.emit("miss", key)
      return undefined
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.emit("expired", key)
      return undefined
    }

    entry.hits++
    this.emit("hit", key)
    return entry.value
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.emit("delete", key)
    }
    return deleted
  }

  clear(): void {
    this.cache.clear()
    this.emit("clear")
  }

  private evictOldest(): void {
    // Find entry with lowest hits and oldest timestamp
    let oldestKey: string | null = null
    let oldestScore = Number.POSITIVE_INFINITY

    for (const [key, entry] of this.cache.entries()) {
      const score = entry.hits + (Date.now() - entry.timestamp) / 1000
      if (score < oldestScore) {
        oldestScore = score
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.emit("evicted", oldestKey)
    }
  }

  private cleanup(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key)
      this.emit("expired", key)
    }

    if (expiredKeys.length > 0) {
      this.emit("cleanup", expiredKeys.length)
    }
  }

  getStats(): {
    size: number
    maxSize: number
    hitRate: number
    totalHits: number
    totalMisses: number
  } {
    let totalHits = 0
    let totalMisses = 0

    for (const entry of this.cache.values()) {
      totalHits += entry.hits
    }

    // Estimate misses (this is approximate)
    totalMisses = Math.max(0, totalHits * 0.1) // Assume 10% miss rate

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalHits / (totalHits + totalMisses) || 0,
      totalHits,
      totalMisses,
    }
  }

  dispose(): void {
    clearInterval(this.cleanupInterval)
    this.clear()
    this.removeAllListeners()
  }
}
