"use client"

import { useParams } from "next/navigation"
import { useMemo, useCallback, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, ChevronUp } from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { ChatContainer } from "@/components/chat/ChatContainer"
import { ChatHeader } from "@/components/chat/ChatHeader"
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

const CHAT_WITHOUT_WHITEBOARD_WIDTH = "42rem"
const CHAT_WITH_WHITEBOARD_WIDTH = 420

export default function ChatPage() {
  const { id } = useParams<{ id: string }>()

  const { data: chat, isLoading } = trpc.chat.getById.useQuery(id)
  const { updateWhiteboard } = useUpdateWhiteboard(id)

  // Chat visibility state
  const [isChatVisible, setIsChatVisible] = useState(true)
  const [isChatHovered, setIsChatHovered] = useState(false)
  const [focusTrigger, setFocusTrigger] = useState(0)
  const [pendingFocus, setPendingFocus] = useState(false)

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
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, oklch(0.7 0 0 / 0.3) 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      />

      <ChatHeader />

      {/* Whiteboard layer (ClusterGrid) */}
      <div
        className="absolute inset-0 pt-16 overflow-auto"
        style={{ paddingRight: `${CHAT_WITH_WHITEBOARD_WIDTH + 60}px` }}
      >
        {clusterGridData && (
          <div className="inline-block p-8">
            <ClusterGrid data={clusterGridData} onDataChange={handleDataChange} />
          </div>
        )}
      </div>

      {/* Floating chat thread */}
      <motion.div
        initial={false}
        animate={{
          x: hasContent ? 0 : "-50%",
          left: hasContent ? "auto" : "50%",
          right: hasContent ? 24 : "auto",
          y: isChatVisible ? 0 : "calc(100% - 48px)",
        }}
        transition={{ type: "spring", stiffness: 150, damping: 21 }}
        className="absolute z-40 top-20 bottom-6"
        style={{
          width: hasContent ? CHAT_WITH_WHITEBOARD_WIDTH : "100%",
          maxWidth: hasContent ? CHAT_WITH_WHITEBOARD_WIDTH : CHAT_WITHOUT_WHITEBOARD_WIDTH,
        }}
        onHoverStart={() => setIsChatHovered(true)}
        onHoverEnd={() => setIsChatHovered(false)}
        onAnimationComplete={() => {
          if (pendingFocus && isChatVisible) {
            setFocusTrigger(n => n + 1)
            setPendingFocus(false)
          }
        }}
      >
        <div className="h-full rounded-3xl border bg-background shadow-lg overflow-hidden relative">
          {/* Hide button - appears on hover when chat is visible */}
          <AnimatePresence>
            {isChatVisible && isChatHovered && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setIsChatVisible(false)}
                className="absolute top-3 right-3 z-50 p-1.5 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Show button - visible when chat is hidden */}
          <AnimatePresence>
            {!isChatVisible && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setIsChatVisible(true)
                  setPendingFocus(true)
                }}
                className="absolute inset-x-0 top-0 h-10 z-50 flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronUp className="w-4 h-4" />
                <span className="text-xs font-medium">Show chat</span>
              </motion.button>
            )}
          </AnimatePresence>

          <ChatContainer chatId={id} className="h-full" focusTrigger={focusTrigger} />
        </div>
      </motion.div>
    </div>
  )
}
