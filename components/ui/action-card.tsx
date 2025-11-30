"use client"

import dynamic from "next/dynamic"
import { Children, memo, useLayoutEffect, useRef, useState, type FC, type ReactNode } from "react"
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Dynamic import to avoid SSR issues with Lottie
const Lottie = dynamic(() => import("lottie-react"), { ssr: false })

const COLLAPSED_HEIGHT = 46
const EXPANDED_HEIGHT = 128
const CONTENT_HEIGHT = EXPANDED_HEIGHT - COLLAPSED_HEIGHT

/**
 * Icon component that renders either a Lottie animation or a Lucide icon.
 * Lottie animations play when active, Lucide icons are static.
 */
const ActionIcon: FC<{
  lottieData?: object
  icon?: LucideIcon | FC<React.ComponentProps<"svg">>
  isActive: boolean
  size?: number
  className?: string
}> = ({ lottieData, icon: Icon, isActive, size = 20, className }) => {
  const sizeStyle = { width: size, height: size }

  if (lottieData) {
    return (
      <Lottie
        animationData={lottieData}
        loop={isActive}
        autoplay={isActive}
        className={cn("shrink-0", className)}
        style={{
          ...sizeStyle,
          filter: "grayscale(1) brightness(0.6)",
        }}
        rendererSettings={{
          preserveAspectRatio: "xMidYMid slice",
        }}
        // @ts-expect-error - lottie-react types are incomplete
        speed={2}
      />
    )
  }

  if (Icon) {
    return (
      <Icon
        className={cn("shrink-0 text-muted-foreground", className)}
        style={sizeStyle}
      />
    )
  }

  return null
}

/**
 * Credits crawl container - content smoothly crawls upward using Framer Motion.
 * Uses motion values (not React state) to avoid infinite re-render loops.
 */
const CreditsCrawl: FC<{
  children: ReactNode
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
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-popover to-transparent"
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

export interface ActionCardProps {
  /** Lottie animation data - animates when active */
  lottieData?: object
  /** Lucide icon or custom SVG component - used if no lottieData provided */
  icon?: LucideIcon | FC<React.ComponentProps<"svg">>
  /** Icon size in pixels (default: 20) */
  iconSize?: number
  /** Heading shown when active (e.g., "Thinking...") */
  activeHeading: string
  /** Heading shown when inactive (e.g., "See my thinking") */
  inactiveHeading: string
  /** Whether the card is actively streaming/working */
  isActive: boolean
  /** Whether there's content to show */
  hasContent: boolean
  /** Content to display when expanded */
  children: ReactNode
  /** Additional class names */
  className?: string
}

/**
 * A collapsible card for displaying streaming actions like thinking, tool calls, etc.
 *
 * Features:
 * - Animated Lottie or static Lucide icon
 * - Auto-expands during streaming, collapses after
 * - Credits crawl effect while streaming
 * - Full content view when expanded after streaming
 */
const ActionCardImpl: FC<ActionCardProps> = ({
  lottieData,
  icon,
  iconSize,
  activeHeading,
  inactiveHeading,
  isActive,
  hasContent,
  children,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  // Auto-expand when content arrives while active
  const shouldExpand = isExpanded || (isActive && hasContent)

  // Determine height: collapsed, active-expanded (fixed), or full-expanded (auto)
  const getHeight = () => {
    if (!shouldExpand || !hasContent) return COLLAPSED_HEIGHT
    if (isActive) return EXPANDED_HEIGHT
    return "auto" // Full content when expanded after streaming
  }

  return (
    <motion.div
      className={cn(
        "mb-4 w-full overflow-hidden rounded-lg border font-sans",
        isActive ? "border-muted-foreground/40" : "border-muted-foreground/20",
        shouldExpand && "bg-popover shadow-sm",
        className,
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
        <ActionIcon lottieData={lottieData} icon={icon} isActive={isActive} size={iconSize} />

        <span className="relative text-sm font-medium custom-tracking-tight">
          {isActive ? activeHeading : inactiveHeading}
          {isActive && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 shimmer motion-reduce:animate-none"
            >
              {activeHeading}
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
            {isActive ? (
              <CreditsCrawl>{children}</CreditsCrawl>
            ) : (
              <div className="space-y-0.5">{children}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export const ActionCard = memo(ActionCardImpl)
ActionCard.displayName = "ActionCard"
