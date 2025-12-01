"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { StickyQuestion } from "./types"
import { CLUSTER_COLOR_VALUES } from "./types"

// Colors for sticky questions
const STICKY_COLORS = {
  hmw: CLUSTER_COLOR_VALUES.yellow,
  open_question: CLUSTER_COLOR_VALUES.blue,
}

const CARD_WIDTH = 200
const CARD_HEIGHT_APPROX = 100 // Approximate height for offset calculation
const HIDDEN_PERCENT = 0.7 // 70% hidden, 30% peeking
const HOVER_LIFT = CARD_HEIGHT_APPROX * HIDDEN_PERCENT + 20 // Lift to fully reveal + extra
const SPACE_FOR_CARDS = HOVER_LIFT + 20 // for the shadow of the cards
const NEW_CARD_DELAY = 0.4 // Delay before new card slides in (seconds)

// Generate a stable random rotation based on question id
function getRandomRotation(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash = hash & hash
  }
  // Range: -2 to 2 degrees
  return ((Math.abs(hash) % 400) - 200) / 100
}

interface StickyQuestionCardProps {
  question: StickyQuestion
  isNew: boolean
}

function StickyQuestionCard({ question, isNew }: StickyQuestionCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [hasEntered, setHasEntered] = useState(!isNew) // Track if entrance animation is done
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const colors = STICKY_COLORS[question.type]
  const rotation = getRandomRotation(question.id)

  // Mark entrance complete after delay (so hover doesn't have delay)
  useEffect(() => {
    if (isNew && !hasEntered) {
      const timer = setTimeout(() => setHasEntered(true), NEW_CARD_DELAY * 1000)
      return () => clearTimeout(timer)
    }
  }, [isNew, hasEntered])

  const handleHoverStart = () => {
    // Clear any pending hover-out
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setIsHovered(true)
  }

  const handleHoverEnd = () => {
    // Delay hover-out by 1s
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false)
    }, 1000)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  // Target y position - always responds to hover
  const targetY = isHovered ? -HOVER_LIFT : 0

  return (
    <motion.div
      layout
      initial={
        isNew ? { opacity: 0, y: 80, rotate: rotation } : { opacity: 1, y: 0, rotate: rotation }
      }
      animate={{
        opacity: 1,
        y: targetY,
        rotate: rotation,
      }}
      exit={{ opacity: 0, y: 20, transition: { duration: 0.2 } }}
      transition={{
        layout: { type: "spring", stiffness: 300, damping: 30 },
        // Only apply entrance delay before hasEntered; after that, respond immediately
        opacity: !hasEntered ? { duration: 0.15, delay: NEW_CARD_DELAY } : { duration: 0.15 },
        y: !hasEntered
          ? { type: "spring", stiffness: 300, damping: 12, delay: NEW_CARD_DELAY }
          : { type: "spring", stiffness: 400, damping: 28 },
      }}
      className="rounded-lg p-3 cursor-default select-none shrink-0"
      style={{
        width: CARD_WIDTH,
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        boxShadow: isHovered
          ? "0 8px 32px -4px oklch(0 0 0 / 0.15)"
          : "0 2px 8px -2px oklch(0 0 0 / 0.08)",
      }}
      onHoverStart={handleHoverStart}
      onHoverEnd={handleHoverEnd}
    >
      <p className="text-sm font-medium leading-snug line-clamp-4">{question.text}</p>
      <span className="mt-2 block text-xs opacity-60">
        {question.type === "hmw" ? "How might we..." : "Open question"}
      </span>
    </motion.div>
  )
}

interface StickyQuestionsBarProps {
  questions: StickyQuestion[]
  /** Width to reserve on the right side (for chat panel) */
  rightPadding?: number
}

export function StickyQuestionsBar({ questions, rightPadding = 0 }: StickyQuestionsBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevIdsRef = useRef<Set<string>>(new Set())
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  // Track which questions are new (IDs are stable hashes of text content)
  useEffect(() => {
    const currentNewIds = new Set<string>()

    questions.forEach(q => {
      if (!prevIdsRef.current.has(q.id)) {
        currentNewIds.add(q.id)
      }
    })

    // Update prev IDs for next comparison
    prevIdsRef.current = new Set(questions.map(q => q.id))

    if (currentNewIds.size > 0) {
      setNewIds(currentNewIds)
      // Scroll to beginning when new items are added
      scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" })
      // Clear "new" status after animation completes (delay + bounce duration + buffer)
      const timer = setTimeout(() => setNewIds(new Set()), (NEW_CARD_DELAY + 0.7 + 0.2) * 1000)
      return () => clearTimeout(timer)
    }
  }, [questions])

  if (!questions.length) return null

  // Calculate offset to push cards partially off-screen
  const bottomOffset = CARD_HEIGHT_APPROX * HIDDEN_PERCENT

  return (
    <div
      className="fixed left-0 z-30"
      style={{
        bottom: -bottomOffset,
        right: rightPadding,
      }}
    >
      {/* Heading */}
      <h2 className="wb-cluster-heading mb-3 pl-8">Questions</h2>

      {/* Scrollable container with fade - overflow visible to prevent hover clipping */}
      <div className="relative" style={{ overflow: "visible" }}>
        {/* Right fade gradient */}
        <div
          className="absolute right-0 w-24 pointer-events-none z-10"
          style={{
            top: -HOVER_LIFT,
            bottom: 0,
            background: "linear-gradient(to right, transparent, oklch(0.99 0 0))",
          }}
        />

        {/* Scrollable area with top padding for hover lift */}
        <div
          ref={scrollRef}
          className="flex gap-3 px-8 pb-2 pointer-events-auto"
          style={{
            paddingTop: SPACE_FOR_CARDS,
            marginTop: -SPACE_FOR_CARDS,
            overflowX: "auto",
            overflowY: "visible",
            scrollbarWidth: "thin",
            scrollbarColor: "oklch(0.7 0 0 / 0.3) transparent",
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {questions.map(question => (
              <StickyQuestionCard
                key={question.id}
                question={question}
                isNew={newIds.has(question.id)}
              />
            ))}
          </AnimatePresence>

          {/* Spacer for fade area */}
          <div className="shrink-0 w-16" />
        </div>
      </div>
    </div>
  )
}
