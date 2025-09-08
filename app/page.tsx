"use client"

import { useState, useEffect } from "react"
import { FileExplorer } from "../components/file-explorer/FileExplorer"
import { TerminalPanel } from "../components/terminal/TerminalPanel"
import { PreviewPanel } from "../components/preview/PreviewPanel"
import { ProjectManager } from "../components/project/ProjectManager"
import { FileManager } from "../lib/local-container/file-manager"
import { TerminalManager } from "../lib/local-container/terminal-manager"
import { PreviewManager } from "../lib/local-container/preview-manager"
import { ProjectManager as ProjectManagerClass } from "../lib/local-container/project-manager"
import { getLocalContainer } from "../lib/local-container"
import { OptimizedFileSystem } from "../lib/local-container/optimized-file-system"
import { PerformanceMonitor } from "../lib/local-container/performance-monitor"
import { Button } from "../components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../components/ui/resizable"
import { Folder, Terminal, Globe, Settings, Play } from "lucide-react"

export default function Page() {
  const [fileManager, setFileManager] = useState<FileManager | null>(null)
  const [terminalManager, setTerminalManager] = useState<TerminalManager | null>(null)
  const [previewManager, setPreviewManager] = useState<PreviewManager | null>(null)
  const [projectManager, setProjectManager] = useState<ProjectManagerClass | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initializeManagers()
  }, [])

  const initializeManagers = async () => {
    try {
      // Initialize container
      const container = await getLocalContainer("workspace")

      // Initialize performance monitor
      const performanceMonitor = new PerformanceMonitor()
      performanceMonitor.start()

      // Initialize optimized file system
      const optimizedFS = new OptimizedFileSystem("workspace", performanceMonitor)

      // Initialize managers
      const fileManagerInstance = new FileManager(optimizedFS, "workspace")
      const terminalManagerInstance = new TerminalManager("workspace")
      const previewManagerInstance = new PreviewManager(container)
      const projectManagerInstance = new ProjectManagerClass(container)

      // Initialize file manager
      await fileManagerInstance.initialize()

      setFileManager(fileManagerInstance)
      setTerminalManager(terminalManagerInstance)
      setPreviewManager(previewManagerInstance)
      setProjectManager(projectManagerInstance)
      setIsInitialized(true)
    } catch (err) {
      console.error("Failed to initialize managers:", err)
      setError(err instanceof Error ? err.message : "Failed to initialize")
    }
  }

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath)
  }

  const handleFileOpen = (filePath: string) => {
    // Open file in editor (would be implemented with a code editor component)
    console.log("Opening file:", filePath)
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Initialization Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  if (!isInitialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing Bolt Local...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Play className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Bolt Local</h1>
            </div>
            <div className="text-sm text-gray-500">Local Development Environment</div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Sidebar - File Explorer */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
            <div className="h-full bg-white border-r border-gray-200">
              <Tabs defaultValue="files" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-2 bg-gray-50 rounded-none border-b">
                  <TabsTrigger value="files" className="flex items-center gap-2">
                    <Folder className="w-4 h-4" />
                    Files
                  </TabsTrigger>
                  <TabsTrigger value="project" className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Project
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="files" className="flex-1 m-0 p-0">
                  {fileManager && (
                    <FileExplorer
                      fileManager={fileManager}
                      onFileSelect={handleFileSelect}
                      onFileOpen={handleFileOpen}
                      className="h-full"
                    />
                  )}
                </TabsContent>

                <TabsContent value="project" className="flex-1 m-0 p-4 overflow-auto">
                  {projectManager && <ProjectManager projectManager={projectManager} className="h-full" />}
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Center - Editor/Preview */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full bg-white">
              <Tabs defaultValue="editor" className="h-full flex flex-col">
                <TabsList className="bg-gray-50 rounded-none border-b justify-start">
                  <TabsTrigger value="editor">Editor</TabsTrigger>
                  <TabsTrigger value="preview" className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Preview
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="editor" className="flex-1 m-0 p-0">
                  <div className="h-full flex items-center justify-center text-gray-500">
                    {selectedFile ? (
                      <div className="text-center">
                        <p className="mb-2">Selected: {selectedFile}</p>
                        <p className="text-sm">Code editor would be implemented here</p>
                      </div>
                    ) : (
                      <p>Select a file to edit</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="flex-1 m-0 p-0">
                  {previewManager && <PreviewPanel previewManager={previewManager} className="h-full" />}
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Right Sidebar - Terminal */}
          <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
            <div className="h-full bg-gray-900">
              <div className="h-full flex flex-col">
                <div className="bg-gray-800 px-3 py-2 border-b border-gray-700">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Terminal className="w-4 h-4" />
                    <span className="text-sm font-medium">Terminal</span>
                  </div>
                </div>

                <div className="flex-1">
                  <TerminalPanel />
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
