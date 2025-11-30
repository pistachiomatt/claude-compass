"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Lightbulb, HelpCircle } from "lucide-react"
import { STICKY_COLORS } from "./types"

interface PeekingDrawerProps {
  hmw?: string[]
  openQuestions?: string[]
}

const PEEK_HEIGHT = 44 // How much shows by default
const CARD_HEIGHT = 140 // Full height when expanded
const CARD_WIDTH = 200

interface PeekingCardProps {
  content: string
  color: "yellow" | "purple"
  icon: typeof Lightbulb | typeof HelpCircle
  index: number
}

function PeekingCard({ content, color, icon: Icon, index }: PeekingCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const colors = STICKY_COLORS[color]

  return (
    <motion.div
      initial={{ y: CARD_HEIGHT - PEEK_HEIGHT + 20, opacity: 0 }}
      animate={{
        y: isHovered ? 0 : CARD_HEIGHT - PEEK_HEIGHT,
        opacity: 1,
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
        delay: index * 0.03,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex-shrink-0 rounded-t-lg cursor-pointer relative"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderBottom: "none",
        color: colors.text,
        boxShadow: isHovered
          ? `0 -8px 24px -4px oklch(0 0 0 / 0.15), 0 -4px 8px -2px oklch(0 0 0 / 0.08)`
          : `0 -2px 8px -2px oklch(0 0 0 / 0.06)`,
      }}
    >
      {/* Top peek section - always visible */}
      <div className="p-3 flex items-start gap-2">
        <Icon
          className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-60"
        />
        <span
          className="text-xs leading-relaxed line-clamp-5"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: isHovered ? 6 : 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {content}
        </span>
      </div>

      {/* Hover indicator dot when peeking */}
      {!isHovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: colors.border }}
        />
      )}

      {/* Subtle corner fold */}
      <div
        className="absolute top-0 right-0 w-2.5 h-2.5 pointer-events-none opacity-30"
        style={{
          background: `linear-gradient(225deg, transparent 50%, ${colors.border} 50%)`,
          borderRadius: "0 6px 0 0",
        }}
      />
    </motion.div>
  )
}

export function PeekingDrawer({ hmw = [], openQuestions = [] }: PeekingDrawerProps) {
  if (hmw.length === 0 && openQuestions.length === 0) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      style={{ height: CARD_HEIGHT }}
    >
      {/* Scrollable container */}
      <div
        className="h-full overflow-x-auto overflow-y-visible pointer-events-auto px-6"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        <div className="h-full flex items-end gap-3 min-w-max pb-0">
          {/* HMW Questions */}
          {hmw.map((question, index) => (
            <PeekingCard
              key={`hmw-${index}`}
              content={question}
              color="yellow"
              icon={Lightbulb}
              index={index}
            />
          ))}

          {/* Divider between types */}
          {hmw.length > 0 && openQuestions.length > 0 && (
            <div
              className="w-px self-end bg-border/50"
              style={{ height: PEEK_HEIGHT - 8, marginBottom: 4 }}
            />
          )}

          {/* Open Questions */}
          {openQuestions.map((question, index) => (
            <PeekingCard
              key={`oq-${index}`}
              content={question}
              color="purple"
              icon={HelpCircle}
              index={hmw.length + index}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
