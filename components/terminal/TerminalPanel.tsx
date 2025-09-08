"use client"

import { useState, useCallback } from "react"
import { Terminal } from "./Terminal"
import { Button } from "../ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Plus, X, TerminalIcon } from "lucide-react"

interface TerminalSession {
  id: string
  name: string
  active: boolean
}

export function TerminalPanel() {
  const [sessions, setSessions] = useState<TerminalSession[]>([{ id: "default", name: "Terminal 1", active: true }])
  const [activeSessionId, setActiveSessionId] = useState("default")

  const createNewSession = useCallback(() => {
    const newId = `terminal_${Date.now()}`
    const newSession: TerminalSession = {
      id: newId,
      name: `Terminal ${sessions.length + 1}`,
      active: true,
    }

    setSessions((prev) => [...prev.map((s) => ({ ...s, active: false })), newSession])
    setActiveSessionId(newId)
  }, [sessions.length])

  const closeSession = useCallback(
    (sessionId: string) => {
      if (sessions.length <= 1) return // Keep at least one session

      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== sessionId)
        if (sessionId === activeSessionId && filtered.length > 0) {
          setActiveSessionId(filtered[0].id)
        }
        return filtered
      })

      // Clean up session on server
      fetch("/api/terminal/session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
    },
    [sessions.length, activeSessionId],
  )

  const handleCommand = useCallback((command: string) => {
    console.log(`Executed command: ${command}`)
  }, [])

  return (
    <div className="terminal-panel h-full flex flex-col bg-gray-900">
      <div className="terminal-header flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">Terminal</span>
        </div>
        <Button variant="ghost" size="sm" onClick={createNewSession} className="text-gray-400 hover:text-white">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <Tabs value={activeSessionId} onValueChange={setActiveSessionId} className="flex-1 flex flex-col">
        <TabsList className="bg-gray-800 border-b border-gray-700 rounded-none justify-start">
          {sessions.map((session) => (
            <TabsTrigger key={session.id} value={session.id} className="relative group data-[state=active]:bg-gray-700">
              <span className="text-xs">{session.name}</span>
              {sessions.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 p-0 h-4 w-4 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeSession(session.id)
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {sessions.map((session) => (
          <TabsContent key={session.id} value={session.id} className="flex-1 m-0 p-0">
            <Terminal sessionId={session.id} onCommand={handleCommand} className="h-full" />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
