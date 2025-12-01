"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type { VirtualFiles } from "@/db/schema"
import { FileViewerDialog } from "./FileViewerDialog"

interface FileViewerContextValue {
  files: VirtualFiles
  openFile: (filePath: string) => void
  // Panel state (for non-mind files)
  panelFilePath: string | null
  panelContent: string
  closePanel: () => void
  expandPanel: () => void
}

const FileViewerContext = createContext<FileViewerContextValue | null>(null)

export function useFileViewer() {
  return useContext(FileViewerContext)
}

/**
 * Extract relative path from an absolute temp path.
 * e.g. "/private/var/folders/.../T/compass/abc123/research/file.md" → "research/file.md"
 * or "./mind.md" → "mind.md"
 */
function extractRelativePath(absolutePath: string): string {
  // Handle relative paths like "./mind.md"
  if (absolutePath.startsWith("./")) {
    return absolutePath.slice(2)
  }

  // Look for compass temp dir pattern and extract path after chatId
  const compassMatch = absolutePath.match(/compass\/[^/]+\/(.+)$/)
  if (compassMatch) {
    return compassMatch[1]
  }

  // Fallback: just use the filename
  return absolutePath.split("/").pop() || absolutePath
}

interface FileViewerProviderProps {
  files: VirtualFiles
  children: ReactNode
}

export function FileViewerProvider({ files, children }: FileViewerProviderProps) {
  // Panel state for non-mind files (shown side-by-side with chat)
  const [panelFilePath, setPanelFilePath] = useState<string | null>(null)
  // Dialog state for mind.md or expanded view
  const [dialogFilePath, setDialogFilePath] = useState<string | null>(null)

  const openFile = useCallback(
    (filePath: string) => {
      const relativePath = extractRelativePath(filePath)
      // Check if file exists
      if (!files[relativePath]) return

      // Skip whiteboard files - not user-viewable
      if (relativePath === "whiteboard.yml" || relativePath === "whiteboard.md") return

      // mind.md opens in dialog, everything else in panel
      if (relativePath === "mind.md") {
        setDialogFilePath(relativePath)
      } else {
        setPanelFilePath(relativePath)
      }
    },
    [files],
  )

  const closePanel = useCallback(() => {
    setPanelFilePath(null)
  }, [])

  const expandPanel = useCallback(() => {
    if (panelFilePath) {
      setDialogFilePath(panelFilePath)
      setPanelFilePath(null)
    }
  }, [panelFilePath])

  const panelContent = panelFilePath ? files[panelFilePath]?.content ?? "" : ""
  const dialogContent = dialogFilePath ? files[dialogFilePath]?.content ?? "" : ""

  return (
    <FileViewerContext.Provider
      value={{
        files,
        openFile,
        panelFilePath,
        panelContent,
        closePanel,
        expandPanel,
      }}
    >
      {children}
      <FileViewerDialog
        open={!!dialogFilePath}
        onOpenChange={open => !open && setDialogFilePath(null)}
        fileName={dialogFilePath || ""}
        content={dialogContent}
      />
    </FileViewerContext.Provider>
  )
}
