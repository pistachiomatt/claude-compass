"use client"

import type { ToolCallMessagePartComponent } from "@assistant-ui/react"
import { CheckIcon, XCircleIcon } from "lucide-react"

import { ActionCard } from "@/components/ui/action-card"
import { Spinner } from "@/components/ui/spinner"
import { useFileViewer } from "@/components/chat/FileViewerContext"
import { useAltKeyHeld } from "@/hooks/useAltKeyHeld"

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

// Tool display config: [activeVerb, pastVerb, preposition?]
const TOOL_VERBS: Record<string, [string, string, string?]> = {
  write: ["Writing", "Wrote", "to"],
  read: ["Reading", "Read"],
  edit: ["Updating", "Updated"],
  update: ["Updating", "Updated"],
}

const FILE_TOOLS = ["write", "edit", "update"]

function getHeadings(
  toolName: string,
  argsText: string,
  isCancelled: boolean,
): { active: string; inactive: string } {
  const filePath = getFilePath(argsText)
  const fileName = filePath?.split("/").pop()

  const verbs = TOOL_VERBS[toolName.toLowerCase()]
  if (!verbs) {
    return {
      active: `Using ${toolName}...`,
      inactive: isCancelled ? `Cancelled: ${toolName}` : `Used ${toolName}`,
    }
  }

  const [active, past, prep] = verbs
  const target = fileName ? `${prep ? `${prep} ` : ""}${fileName}` : ""

  return {
    active: `${active}${target ? ` ${target}` : ""}...`,
    inactive: isCancelled ? `Cancelled: ${past}` : `${past}${target ? ` ${target}` : ""}`,
  }
}

export const ToolFallback: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const isOptionHeld = useAltKeyHeld()
  const fileViewer = useFileViewer()

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

  // Check if this is a clickable file tool (Write, Edit, Update)
  const filePath = getFilePath(argsText)
  const isWhiteboardFile =
    filePath?.endsWith("whiteboard.yml") || filePath?.endsWith("whiteboard.md")
  const isClickable =
    isComplete &&
    FILE_TOOLS.includes(toolName.toLowerCase()) &&
    filePath &&
    fileViewer &&
    !isWhiteboardFile

  const handleClick = () => {
    if (isClickable && filePath) {
      fileViewer.openFile(filePath)
    }
  }

  return (
    <ActionCard
      icon={icon}
      iconSize={16}
      activeHeading={headings.active}
      inactiveHeading={headings.inactive}
      isActive={isRunning}
      hasContent={true}
      className="aui-tool-fallback-root"
      onClick={isClickable ? handleClick : undefined}
      actionLabel={isClickable ? "View" : undefined}
    >
      <div className="text-xs">
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
