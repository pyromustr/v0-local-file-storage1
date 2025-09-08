import { LocalContainerImpl } from "./container" // Declare the variable before using it
export { LocalContainerImpl as LocalContainer } from "./container"
export type {
  LocalContainer,
  LocalFileSystem,
  LocalTerminal,
  Process,
  SpawnOptions,
  FileStats,
} from "./types"

// Compatibility layer for existing WebContainer code
export const webcontainer = {
  boot: LocalContainerImpl.boot,
}

// Context for hot reloading
interface LocalContainerContext {
  loaded: boolean
}

export const localContainerContext: LocalContainerContext = {
  loaded: false,
}

let containerInstance: Promise<LocalContainerImpl> | null = null

export function getLocalContainer(workdirName = "workdir"): Promise<LocalContainerImpl> {
  if (!containerInstance) {
    containerInstance = LocalContainerImpl.boot({ workdirName }).then((container) => {
      localContainerContext.loaded = true
      return container
    })
  }
  return containerInstance
}
