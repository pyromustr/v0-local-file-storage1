export interface LocalFileSystem {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  readdir(path: string): Promise<string[]>
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
  exists(path: string): Promise<boolean>
  remove(path: string): Promise<void>
  stat(path: string): Promise<FileStats>
}

export interface FileStats {
  isFile(): boolean
  isDirectory(): boolean
  size: number
  mtime: Date
}

export interface LocalTerminal {
  spawn(command: string, args?: string[], options?: SpawnOptions): Promise<Process>
  exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>
}

export interface SpawnOptions {
  cwd?: string
  env?: Record<string, string>
}

export interface Process {
  pid: number
  stdout: ReadableStream<string>
  stderr: ReadableStream<string>
  stdin: WritableStream<string>
  kill(signal?: string): void
  onExit: (callback: (code: number) => void) => void
}

export interface LocalContainer {
  fs: LocalFileSystem
  terminal: LocalTerminal
  workdir: string
  mount(hostPath: string, containerPath?: string): Promise<void>
  unmount(containerPath: string): Promise<void>
}
