"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion } from "framer-motion"
import type { WhiteboardItem } from "./types"
import { STICKY_COLORS, GRID_CONFIG, type StickyColor } from "./types"

interface StickyNoteProps {
  item: WhiteboardItem
  color: StickyColor
  delay?: number
  onPositionUpdate?: (rect: DOMRect) => void
}

export function StickyNote({
  item,
  color,
  delay = 0,
  onPositionUpdate,
}: StickyNoteProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const colors = STICKY_COLORS[color]

  const updatePosition = useCallback(() => {
    if (ref.current && onPositionUpdate) {
      onPositionUpdate(ref.current.getBoundingClientRect())
    }
  }, [onPositionUpdate])

  useEffect(() => {
    updatePosition()
    // Update on resize
    window.addEventListener("resize", updatePosition)
    return () => window.removeEventListener("resize", updatePosition)
  }, [updatePosition, item])

  return (
    <motion.div
      ref={ref}
      layout
      layoutId={item.id}
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{
        opacity: 1,
        scale: isDragging ? 1.03 : 1,
        y: 0,
        rotate: isDragging ? 1.5 : 0,
        zIndex: isDragging ? 50 : 1,
      }}
      exit={{ opacity: 0, scale: 0.8, y: -10 }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 28,
        delay,
        layout: { type: "spring", stiffness: 300, damping: 30 },
      }}
      drag
      dragMomentum={false}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => {
        setIsDragging(false)
        updatePosition()
      }}
      className="rounded-lg p-4 cursor-grab active:cursor-grabbing relative h-full"
      style={{
        minHeight: GRID_CONFIG.stickyMinHeight,
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        boxShadow: isDragging
          ? `0 16px 32px -4px oklch(0 0 0 / 0.12), 0 6px 12px -2px oklch(0 0 0 / 0.08)`
          : `0 2px 8px -2px oklch(0 0 0 / 0.06), 0 1px 2px -1px oklch(0 0 0 / 0.04)`,
      }}
    >
      {/* Heading */}
      <h3 className="wb-sticky-heading">{item.heading}</h3>

      {/* Body text */}
      {item.body && <p className="wb-sticky-body">{item.body}</p>}

      {/* Subtle corner fold */}
      <div
        className="absolute bottom-0 right-0 w-3 h-3 pointer-events-none opacity-30"
        style={{
          background: `linear-gradient(135deg, transparent 50%, ${colors.border} 50%)`,
          borderRadius: "0 0 6px 0",
        }}
      />
    </motion.div>
  )
}
