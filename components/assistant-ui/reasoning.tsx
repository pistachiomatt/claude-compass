"use client"

import dynamic from "next/dynamic"
import { Children, memo, useLayoutEffect, useRef, useState, type FC, type ReactNode } from "react"
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion"

// Dynamic import to avoid SSR issues with Lottie
const Lottie = dynamic(() => import("lottie-react"), { ssr: false })

import {
  useAssistantState,
  type ReasoningMessagePartComponent,
  type ReasoningGroupComponent,
} from "@assistant-ui/react"

import brainAnimation from "@/public/brain-animation.json"
import { cn } from "@/lib/utils"

const COLLAPSED_HEIGHT = 46
const EXPANDED_HEIGHT = 128 // ~3 lines

/**
 * Animated brain icon using Lottie.
 * Monochrome via CSS filter, 2x playback speed. Stops when not active.
 */
const ThinkingIcon: FC<{ className?: string; isAnimating?: boolean }> = ({
  className,
  isAnimating = true,
}) => (
  <Lottie
    animationData={brainAnimation}
    loop={isAnimating}
    autoplay={isAnimating}
    className={cn("size-5 shrink-0", className)}
    style={{
      filter: "grayscale(1) brightness(0.6)",
    }}
    rendererSettings={{
      preserveAspectRatio: "xMidYMid slice",
    }}
    // @ts-expect-error - lottie-react types are incomplete
    speed={2}
  />
)

const CONTENT_HEIGHT = EXPANDED_HEIGHT - COLLAPSED_HEIGHT

/**
 * Credits crawl container - content smoothly crawls upward using Framer Motion.
 * Uses motion values (not React state) to avoid infinite re-render loops.
 */
const CreditsCrawl: FC<{
  children: ReactNode
  isStreaming: boolean
}> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const items = Children.toArray(children)

  // Motion value for scroll offset (not React state = no re-renders)
  const offsetValue = useMotionValue(0)
  const springOffset = useSpring(offsetValue, {
    stiffness: 300,
    damping: 30,
  })

  // Fade opacity based on scroll offset
  const fadeOpacity = useTransform(offsetValue, [0, 8], [0, 1])

  // Update offset when content size changes (ResizeObserver → motion value only, no React state)
  // Throttled to min 100ms so lines don't scroll too fast
  useLayoutEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    let lastUpdate = 0
    let pendingUpdate: number | null = null

    const updateOffset = () => {
      const now = Date.now()
      const timeSinceLastUpdate = now - lastUpdate

      if (timeSinceLastUpdate < 100) {
        // Throttle: schedule update for later
        if (pendingUpdate === null) {
          pendingUpdate = window.setTimeout(() => {
            pendingUpdate = null
            updateOffset()
          }, 100 - timeSinceLastUpdate)
        }
        return
      }

      lastUpdate = now
      const containerHeight = container.clientHeight
      const contentHeight = content.scrollHeight
      const newOffset = Math.max(0, contentHeight - containerHeight)
      offsetValue.set(newOffset) // Motion value, not setState = no re-render loop
    }

    updateOffset()

    const observer = new ResizeObserver(updateOffset)
    observer.observe(content)
    return () => {
      observer.disconnect()
      if (pendingUpdate !== null) {
        window.clearTimeout(pendingUpdate)
      }
    }
  }, [offsetValue])

  return (
    <div className="relative">
      {/* Gradient fade at top */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-background to-transparent"
        style={{ opacity: fadeOpacity }}
      />

      <div
        ref={containerRef}
        className="relative overflow-hidden"
        style={{ height: CONTENT_HEIGHT }}
      >
        <motion.div
          ref={contentRef}
          className="space-y-0.5 pb-2"
          style={{ y: useTransform(springOffset, v => -v) }}
        >
          {items.map((child, index) => (
            <motion.div
              key={(child as { key?: string })?.key ?? index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              {child}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

/**
 * Single reasoning text part.
 */
const ReasoningImpl: ReasoningMessagePartComponent = ({ text }) => (
  <p className="whitespace-pre-line text-sm leading-tight custom-tracking-tight">{text}</p>
)

/**
 * Collapsible wrapper that groups consecutive reasoning parts.
 * Features:
 * - Bordered box with transparent background
 * - Animated Lottie brain icon (monochrome, 2x speed)
 * - "Thinking..." label with shimmer when active
 * - Expands to show content when available
 */
const ReasoningGroupImpl: ReasoningGroupComponent = ({ children, startIndex, endIndex }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  // Check if streaming (returns primitive boolean)
  const isStreaming = useAssistantState(({ message }) => {
    if (message.status?.type !== "running") return false
    const lastIndex = message.parts.length - 1
    if (lastIndex < 0) return false
    const lastType = message.parts[lastIndex]?.type
    if (lastType !== "reasoning") return false
    return lastIndex >= startIndex && lastIndex <= endIndex
  })

  // Check if there's content (returns primitive boolean)
  const hasContent = useAssistantState(({ message }) => {
    for (let i = startIndex; i <= endIndex && i < message.parts.length; i++) {
      const part = message.parts[i]
      if (part?.type === "reasoning" && "text" in part) {
        if (typeof part.text === "string" && part.text.trim().length > 0) {
          return true
        }
      }
    }
    return false
  })

  // Auto-expand when content arrives while streaming
  const shouldExpand = isExpanded || (isStreaming && hasContent)

  // Determine height: collapsed, streaming-expanded (fixed), or full-expanded (auto)
  const getHeight = () => {
    if (!shouldExpand || !hasContent) return COLLAPSED_HEIGHT
    if (isStreaming) return EXPANDED_HEIGHT
    return "auto" // Full content when expanded after streaming
  }

  return (
    <motion.div
      className={cn(
        "aui-reasoning-root mb-4 w-full overflow-hidden rounded-lg border font-sans transition-colors",
        isStreaming ? "border-muted-foreground/40" : "border-muted-foreground/20",
      )}
      initial={false}
      animate={{
        height: getHeight(),
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 38,
      }}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        disabled={!hasContent}
        className={cn(
          "flex w-full items-center gap-1 px-3 py-3",
          hasContent && "cursor-pointer",
          !hasContent && "cursor-default",
        )}
      >
        <ThinkingIcon isAnimating={isStreaming} />

        <span className={cn("relative text-sm font-medium custom-tracking-tight")}>
          {isStreaming ? "Thinking..." : "See my thinking"}
          {isStreaming && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 motion-reduce:animate-none"
            >
              Thinking...
            </span>
          )}
        </span>

        {/* Expand/collapse indicator */}
        {hasContent && (
          <motion.svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ml-auto text-muted-foreground"
            animate={{ rotate: shouldExpand ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </motion.svg>
        )}
      </button>

      {/* Content area */}
      <AnimatePresence>
        {shouldExpand && hasContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="px-4 pb-4 mt-[-6px]"
          >
            {isStreaming ? (
              <CreditsCrawl isStreaming={isStreaming}>{children}</CreditsCrawl>
            ) : (
              <div className="space-y-0.5">{children}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export const Reasoning = memo(ReasoningImpl)
Reasoning.displayName = "Reasoning"

export const ReasoningGroup = memo(ReasoningGroupImpl)
ReasoningGroup.displayName = "ReasoningGroup"
