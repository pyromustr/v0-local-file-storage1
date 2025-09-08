import { EventEmitter } from "events"

export interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  tags?: Record<string, string>
}

export interface SystemMetrics {
  memory: {
    used: number
    total: number
    percentage: number
  }
  cpu: {
    usage: number
  }
  fileSystem: {
    operations: number
    averageTime: number
  }
  terminal: {
    activeSessions: number
    totalCommands: number
  }
  cache: {
    hitRate: number
    size: number
  }
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetric[] = []
  private maxMetrics = 1000
  private monitoringInterval: NodeJS.Timeout | null = null
  private startTime = Date.now()

  // Counters
  private fileOperations = 0
  private fileOperationTimes: number[] = []
  private terminalCommands = 0
  private activeSessions = 0

  constructor() {
    super()
  }

  start(intervalMs = 5000): void {
    if (this.monitoringInterval) return

    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics()
    }, intervalMs)

    this.emit("started")
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    this.emit("stopped")
  }

  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      tags,
    }

    this.metrics.push(metric)

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    this.emit("metric", metric)
  }

  recordFileOperation(operationType: string, duration: number): void {
    this.fileOperations++
    this.fileOperationTimes.push(duration)

    // Keep only recent operation times
    if (this.fileOperationTimes.length > 100) {
      this.fileOperationTimes = this.fileOperationTimes.slice(-100)
    }

    this.recordMetric("file_operation", duration, { type: operationType })
  }

  recordTerminalCommand(): void {
    this.terminalCommands++
    this.recordMetric("terminal_command", 1)
  }

  setActiveSessions(count: number): void {
    this.activeSessions = count
    this.recordMetric("active_sessions", count)
  }

  private collectSystemMetrics(): void {
    const metrics = this.getSystemMetrics()

    // Record individual metrics
    this.recordMetric("memory_usage", metrics.memory.percentage)
    this.recordMetric("cpu_usage", metrics.cpu.usage)
    this.recordMetric("file_operations_total", metrics.fileSystem.operations)
    this.recordMetric("file_operation_avg_time", metrics.fileSystem.averageTime)
    this.recordMetric("terminal_sessions", metrics.terminal.activeSessions)
    this.recordMetric("cache_hit_rate", metrics.cache.hitRate)

    this.emit("systemMetrics", metrics)
  }

  getSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage()
    const avgFileOpTime =
      this.fileOperationTimes.length > 0
        ? this.fileOperationTimes.reduce((a, b) => a + b, 0) / this.fileOperationTimes.length
        : 0

    return {
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
      cpu: {
        usage: process.cpuUsage().user / 1000000, // Convert to seconds
      },
      fileSystem: {
        operations: this.fileOperations,
        averageTime: avgFileOpTime,
      },
      terminal: {
        activeSessions: this.activeSessions,
        totalCommands: this.terminalCommands,
      },
      cache: {
        hitRate: 0, // Will be updated by cache manager
        size: 0,
      },
    }
  }

  getMetrics(name?: string, since?: number): PerformanceMetric[] {
    let filtered = this.metrics

    if (name) {
      filtered = filtered.filter((m) => m.name === name)
    }

    if (since) {
      filtered = filtered.filter((m) => m.timestamp >= since)
    }

    return filtered
  }

  getAverageMetric(name: string, since?: number): number {
    const metrics = this.getMetrics(name, since)
    if (metrics.length === 0) return 0

    return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length
  }

  getUptime(): number {
    return Date.now() - this.startTime
  }

  generateReport(): {
    uptime: number
    totalMetrics: number
    systemMetrics: SystemMetrics
    averages: Record<string, number>
  } {
    const systemMetrics = this.getSystemMetrics()
    const oneHourAgo = Date.now() - 3600000

    return {
      uptime: this.getUptime(),
      totalMetrics: this.metrics.length,
      systemMetrics,
      averages: {
        memoryUsage: this.getAverageMetric("memory_usage", oneHourAgo),
        cpuUsage: this.getAverageMetric("cpu_usage", oneHourAgo),
        fileOperationTime: this.getAverageMetric("file_operation", oneHourAgo),
      },
    }
  }

  dispose(): void {
    this.stop()
    this.metrics = []
    this.removeAllListeners()
  }
}
