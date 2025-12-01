"use client"

import { useParams } from "next/navigation"
import { useMemo, useCallback, useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { ChatHeader } from "@/components/chat/ChatHeader"
import { MindDialog } from "@/components/chat/MindDialog"
import { FileViewerProvider } from "@/components/chat/FileViewerContext"
import { FloatingPanels } from "@/components/chat/FloatingPanels"
import { ClusterGrid, type ClusterGridData } from "@/components/cluster-grid"
import { useUpdateWhiteboard } from "@/hooks/useUpdateWhiteboard"
import {
  parseWhiteboardYml,
  whiteboardYmlToClusterGridData,
  clusterGridDataToWhiteboardYml,
  serializeWhiteboardYml,
  hasWhiteboardContent,
  type WhiteboardYml,
} from "@/lib/whiteboard/parseWhiteboardYml"
import { Spinner } from "@/components/ui/spinner"

export default function ChatPage() {
  const { id } = useParams<{ id: string }>()

  const { data: chat, isLoading } = trpc.chat.getById.useQuery(id)
  const { updateWhiteboard } = useUpdateWhiteboard(id)

  // Mind dialog state
  const [isMindDialogOpen, setIsMindDialogOpen] = useState(false)

  // Parse whiteboard.yml from chat.files
  const { whiteboardYml, clusterGridData, hasContent } = useMemo(() => {
    const whiteboardFile = chat?.files?.["whiteboard.yml"]
    if (!whiteboardFile?.content) {
      return { whiteboardYml: null, clusterGridData: null, hasContent: false }
    }

    const parsed = parseWhiteboardYml(whiteboardFile.content)
    if (!parsed) {
      return { whiteboardYml: null, clusterGridData: null, hasContent: false }
    }

    return {
      whiteboardYml: parsed,
      clusterGridData: whiteboardYmlToClusterGridData(parsed),
      hasContent: hasWhiteboardContent(parsed),
    }
  }, [chat?.files])

  // Extract mind.md content
  const mindContent = chat?.files?.["mind.md"]?.content ?? ""

  // Handle cluster grid data changes (user drag-drop)
  const handleDataChange = useCallback(
    (newData: ClusterGridData) => {
      // Convert back to whiteboard.yml format, preserving other fields
      const updatedYml = clusterGridDataToWhiteboardYml(newData, whiteboardYml as WhiteboardYml)
      const yamlContent = serializeWhiteboardYml(updatedYml)

      // Immediately write to backend
      updateWhiteboard(yamlContent)
    },
    [whiteboardYml, updateWhiteboard],
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    )
  }

  if (!chat) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Chat not found</div>
      </div>
    )
  }

  return (
    <FileViewerProvider files={chat.files ?? {}}>
      <div className="relative h-screen w-screen overflow-hidden bg-background">
        {/* Dot grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, oklch(0.7 0 0 / 0.3) 1px, transparent 1px)`,
            backgroundSize: "20px 20px",
          }}
        />

        <ChatHeader onAvatarClick={() => setIsMindDialogOpen(true)} />

        <MindDialog
          open={isMindDialogOpen}
          onOpenChange={setIsMindDialogOpen}
          content={mindContent}
        />

        {/* Whiteboard layer (ClusterGrid) */}
        <div className="absolute inset-0 pt-16 overflow-auto">
          {clusterGridData && (
            <div className="inline-block p-8">
              <ClusterGrid data={clusterGridData} onDataChange={handleDataChange} />
            </div>
          )}
        </div>

        {/* Floating panels (chat + research) */}
        <FloatingPanels chatId={id} hasWhiteboardContent={hasContent} />
      </div>
    </FileViewerProvider>
  )
}
