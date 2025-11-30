"use client"

import { useEffect, useState } from "react"
import type { ToolCallMessagePartComponent } from "@assistant-ui/react"
import { CheckIcon, XCircleIcon } from "lucide-react"

import { ActionCard } from "@/components/ui/action-card"
import { Spinner } from "@/components/ui/spinner"

/**
 * Parse args to extract filepath for file operations
 */
function getFilePath(argsText: string): string | null {
  try {
    const args = JSON.parse(argsText)
    return args.file_path || args.filePath || args.path || null
  } catch {
    return null
  }
}

/**
 * Generate headings based on tool name and args
 */
function getHeadings(
  toolName: string,
  argsText: string,
  isCancelled: boolean,
): { active: string; inactive: string } {
  const filePath = getFilePath(argsText)
  const fileName = filePath?.split("/").pop() || filePath

  // File operation tools with custom headings
  if (fileName) {
    switch (toolName.toLowerCase()) {
      case "write":
        return {
          active: `Writing to ${fileName}...`,
          inactive: isCancelled ? `Cancelled: Write ${fileName}` : `Wrote to ${fileName}`,
        }
      case "read":
        return {
          active: `Reading ${fileName}...`,
          inactive: isCancelled ? `Cancelled: Read ${fileName}` : `Read ${fileName}`,
        }
      case "edit":
      case "update":
        return {
          active: `Updating ${fileName}...`,
          inactive: isCancelled ? `Cancelled: Update ${fileName}` : `Updated ${fileName}`,
        }
      default:
        return {
          active: `Using ${toolName}...`,
          inactive: isCancelled ? `Cancelled: ${toolName}` : `Used ${toolName}`,
        }
    }
  } else {
    switch (toolName.toLowerCase()) {
      case "write":
        return {
          active: `Writing...`,
          inactive: isCancelled ? `Cancelled: Write` : `Wrote`,
        }
      case "read":
        return {
          active: `Reading...`,
          inactive: isCancelled ? `Cancelled: Read` : `Read`,
        }
      case "edit":
        return {
          active: `Updating...`,
          inactive: isCancelled ? `Cancelled: Update` : `Updated`,
        }
      default:
        return {
          active: `Using ${toolName}...`,
          inactive: isCancelled ? `Cancelled: ${toolName}` : `Used ${toolName}`,
        }
    }
  }
}

export const ToolFallback: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const [isOptionHeld, setIsOptionHeld] = useState(false)

  // Track Option/Alt key state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) setIsOptionHeld(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) setIsOptionHeld(false)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  const isRunning = status?.type === "running"
  const isCancelled = status?.type === "incomplete" && status.reason === "cancelled"
  const isComplete = status?.type === "complete"

  // Determine which icon to show
  const icon = isCancelled ? XCircleIcon : isComplete ? CheckIcon : Spinner

  // Get headings based on tool name
  const headings = getHeadings(toolName, argsText, isCancelled)

  // Format result for display
  const resultText =
    result === undefined
      ? null
      : typeof result === "string"
        ? result
        : JSON.stringify(result, null, 2)

  return (
    <ActionCard
      icon={icon}
      iconSize={16}
      activeHeading={headings.active}
      inactiveHeading={headings.inactive}
      isActive={isRunning}
      hasContent={true}
      className="aui-tool-fallback-root"
    >
      <div className="text-sm">
        <pre className="whitespace-pre-wrap overflow-x-auto font-mono">{argsText}</pre>
        {isOptionHeld && resultText && (
          <>
            <hr className="my-3 border-muted-foreground/20" />
            <pre className="whitespace-pre-wrap overflow-x-auto font-mono">{resultText}</pre>
          </>
        )}
      </div>
    </ActionCard>
  )
}
