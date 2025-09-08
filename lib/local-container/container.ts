import path from "path"
import type { LocalContainer, LocalFileSystem, LocalTerminal } from "./types"
import { NodeFileSystem } from "./file-system"
import { NodeTerminal } from "./terminal"

export class LocalContainerImpl implements LocalContainer {
  public fs: LocalFileSystem
  public terminal: LocalTerminal
  public workdir: string
  private mountPoints: Map<string, string> = new Map()

  constructor(workdir: string) {
    this.workdir = path.resolve(workdir)
    this.fs = new NodeFileSystem(this.workdir)
    this.terminal = new NodeTerminal(this.workdir)
  }

  async mount(hostPath: string, containerPath?: string): Promise<void> {
    const mountPath = containerPath || path.basename(hostPath)
    const fullHostPath = path.resolve(hostPath)
    const fullContainerPath = path.resolve(this.workdir, mountPath)

    this.mountPoints.set(fullContainerPath, fullHostPath)

    // Create symbolic link or copy files
    try {
      const { promises: fs } = await import("fs")
      await fs.symlink(fullHostPath, fullContainerPath)
    } catch (error) {
      console.warn(`Failed to create symlink, copying files instead: ${error}`)
      await this.copyDirectory(fullHostPath, fullContainerPath)
    }
  }

  async unmount(containerPath: string): Promise<void> {
    const fullContainerPath = path.resolve(this.workdir, containerPath)

    if (this.mountPoints.has(fullContainerPath)) {
      const { promises: fs } = await import("fs")
      await fs.unlink(fullContainerPath)
      this.mountPoints.delete(fullContainerPath)
    }
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    const { promises: fs } = await import("fs")

    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath)
      } else {
        await fs.copyFile(srcPath, destPath)
      }
    }
  }

  static async boot(options: { workdirName: string }): Promise<LocalContainer> {
    const workdir = path.resolve(process.cwd(), options.workdirName)
    const container = new LocalContainerImpl(workdir)

    // Ensure working directory exists
    const { promises: fs } = await import("fs")
    await fs.mkdir(workdir, { recursive: true })

    return container
  }
}
