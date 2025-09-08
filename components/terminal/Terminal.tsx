"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Terminal as XTerm } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import { WebLinksAddon } from "@xterm/addon-web-links"
import "@xterm/xterm/css/xterm.css"

interface TerminalProps {
  sessionId: string
  onCommand?: (command: string) => void
  className?: string
}

export function Terminal({ sessionId, onCommand, className }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [currentLine, setCurrentLine] = useState("")
  const [isReady, setIsReady] = useState(false)

  const initializeTerminal = useCallback(() => {
    if (!terminalRef.current || xtermRef.current) return

    const terminal = new XTerm({
      theme: {
        background: "#1a1a1a",
        foreground: "#ffffff",
        cursor: "#ffffff",
        selection: "#3e3e3e",
      },
      fontFamily: "JetBrains Mono, Consolas, Monaco, monospace",
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      allowTransparency: true,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)

    terminal.open(terminalRef.current)
    fitAddon.fit()

    // Set up terminal event handlers
    terminal.onData((data) => {
      handleTerminalInput(data)
    })

    terminal.onKey(({ key, domEvent }) => {
      handleKeyPress(key, domEvent)
    })

    xtermRef.current = terminal
    fitAddonRef.current = fitAddon
    setIsReady(true)

    // Write initial prompt
    writePrompt()
  }, [sessionId])

  const handleTerminalInput = useCallback(
    (data: string) => {
      const terminal = xtermRef.current
      if (!terminal) return

      const code = data.charCodeAt(0)

      // Handle special keys
      if (code === 13) {
        // Enter
        terminal.write("\r\n")
        if (currentLine.trim()) {
          executeCommand(currentLine.trim())
          setCurrentLine("")
        }
        writePrompt()
      } else if (code === 127) {
        // Backspace
        if (currentLine.length > 0) {
          setCurrentLine((prev) => prev.slice(0, -1))
          terminal.write("\b \b")
        }
      } else if (code === 3) {
        // Ctrl+C
        terminal.write("^C\r\n")
        setCurrentLine("")
        writePrompt()
      } else if (code >= 32) {
        // Printable characters
        setCurrentLine((prev) => prev + data)
        terminal.write(data)
      }
    },
    [currentLine],
  )

  const handleKeyPress = useCallback((key: string, domEvent: KeyboardEvent) => {
    // Handle special key combinations
    if (domEvent.ctrlKey) {
      switch (domEvent.key) {
        case "c":
          // Ctrl+C handled in handleTerminalInput
          break
        case "l":
          // Ctrl+L - clear screen
          domEvent.preventDefault()
          clearTerminal()
          break
      }
    }
  }, [])

  const executeCommand = useCallback(
    async (command: string) => {
      onCommand?.(command)

      try {
        const response = await fetch("/api/terminal/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            command: command.split(" ")[0],
            args: command.split(" ").slice(1),
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        // Handle streaming response
        const reader = response.body?.getReader()
        if (!reader) return

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = new TextDecoder().decode(value)
          const lines = text.split("\n")

          for (const line of lines) {
            if (line.trim()) {
              try {
                const output = JSON.parse(line)
                writeOutput(output.data, output.type === "stderr")
              } catch {
                // If not JSON, write as plain text
                writeOutput(line)
              }
            }
          }
        }
      } catch (error) {
        writeOutput(`Error executing command: ${error}`, true)
      }
    },
    [sessionId, onCommand],
  )

  const writeOutput = useCallback((text: string, isError = false) => {
    const terminal = xtermRef.current
    if (!terminal) return

    if (isError) {
      terminal.write(`\x1b[31m${text}\x1b[0m\r\n`) // Red text
    } else {
      terminal.write(`${text}\r\n`)
    }
  }, [])

  const writePrompt = useCallback(() => {
    const terminal = xtermRef.current
    if (!terminal) return

    const prompt = "\x1b[32m$\x1b[0m " // Green $ prompt
    terminal.write(prompt)
  }, [])

  const clearTerminal = useCallback(() => {
    const terminal = xtermRef.current
    if (!terminal) return

    terminal.clear()
    writePrompt()
  }, [writePrompt])

  const resizeTerminal = useCallback(() => {
    if (fitAddonRef.current && xtermRef.current) {
      fitAddonRef.current.fit()
    }
  }, [])

  useEffect(() => {
    initializeTerminal()

    // Handle window resize
    window.addEventListener("resize", resizeTerminal)

    return () => {
      window.removeEventListener("resize", resizeTerminal)
      if (xtermRef.current) {
        xtermRef.current.dispose()
      }
    }
  }, [initializeTerminal, resizeTerminal])

  useEffect(() => {
    // Resize when component mounts or updates
    const timer = setTimeout(resizeTerminal, 100)
    return () => clearTimeout(timer)
  }, [resizeTerminal])

  return (
    <div className={`terminal-container ${className || ""}`}>
      <div
        ref={terminalRef}
        className="terminal-content"
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#1a1a1a",
        }}
      />
    </div>
  )
}
