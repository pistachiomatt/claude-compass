"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, ChevronUp } from "lucide-react"
import { ChatContainer } from "./ChatContainer"
import { ResearchPanel } from "./ResearchPanel"
import { useFileViewer } from "./FileViewerContext"
import { useResizable } from "@/hooks/useResizable"

const CHAT_WITHOUT_WHITEBOARD_WIDTH = "42rem"
const CHAT_DOCKED_WIDTH = { default: 420, min: 320, max: 800 }
const RESEARCH_PANEL_WIDTH = 420

interface FloatingPanelsProps {
  chatId: string
  hasWhiteboardContent: boolean
}

export function FloatingPanels({ chatId, hasWhiteboardContent }: FloatingPanelsProps) {
  const fileViewer = useFileViewer()
  const hasResearchPanel = !!fileViewer?.panelFilePath

  // Chat visibility state
  const [isChatVisible, setIsChatVisible] = useState(true)
  const [isChatHovered, setIsChatHovered] = useState(false)
  const [focusTrigger, setFocusTrigger] = useState(0)
  const [pendingFocus, setPendingFocus] = useState(false)

  // Chat resize
  const { width: chatWidth, handleResizeStart } = useResizable({
    defaultWidth: CHAT_DOCKED_WIDTH.default,
    minWidth: CHAT_DOCKED_WIDTH.min,
    maxWidth: CHAT_DOCKED_WIDTH.max,
  })

  // When docked (whiteboard content exists), show on right side
  const isDocked = hasWhiteboardContent

  return (
    <>
      {/* Research panel - slides in from right, sits next to chat */}
      <AnimatePresence>
        {hasResearchPanel && fileViewer && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute z-40 top-20 bottom-6 right-6"
            style={{ width: RESEARCH_PANEL_WIDTH }}
          >
            <ResearchPanel
              fileName={fileViewer.panelFilePath ?? ""}
              content={fileViewer.panelContent}
              onClose={fileViewer.closePanel}
              onExpand={fileViewer.expandPanel}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating chat thread */}
      <motion.div
        initial={false}
        animate={{
          x: isDocked ? 0 : "-50%",
          left: isDocked ? "auto" : "50%",
          // When research panel is open, shift chat left by panel width + gap
          right: isDocked ? (hasResearchPanel ? RESEARCH_PANEL_WIDTH + 24 + 12 : 24) : "auto",
          y: isChatVisible ? 0 : "calc(100% - 48px)",
        }}
        transition={{ type: "spring", stiffness: 150, damping: 21 }}
        className="absolute z-40 top-20 bottom-6"
        style={{
          width: isDocked ? chatWidth : "100%",
          maxWidth: isDocked ? chatWidth : CHAT_WITHOUT_WHITEBOARD_WIDTH,
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
        {/* Resize handle on left edge (only when docked) */}
        {isDocked && (
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-50 hover:bg-primary/10 active:bg-primary/20 transition-colors"
            onMouseDown={handleResizeStart}
          />
        )}

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

          <ChatContainer chatId={chatId} className="h-full" focusTrigger={focusTrigger} />
        </div>
      </motion.div>
    </>
  )
}
