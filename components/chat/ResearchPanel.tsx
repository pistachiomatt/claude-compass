"use client"

import { AnimatedMarkdown } from "flowtoken"
import "flowtoken/dist/styles.css"
import { X, Expand } from "lucide-react"
import { motion } from "framer-motion"

interface ResearchPanelProps {
  fileName: string
  content: string
  onClose: () => void
  onExpand: () => void
}

export function ResearchPanel({ fileName, content, onClose, onExpand }: ResearchPanelProps) {
  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="h-full rounded-3xl border bg-background shadow-lg overflow-hidden relative flex flex-col"
    >
      {/* Header with file name and actions */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="font-mono text-sm text-muted-foreground truncate">{fileName}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onExpand}
            className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Expand to full view"
          >
            <Expand className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="aui-md font-serif">
          <AnimatedMarkdown content={content} animation={null} />
        </div>
      </div>
    </motion.div>
  )
}
