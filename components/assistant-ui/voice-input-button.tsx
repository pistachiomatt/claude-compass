"use client"

import { useState, useEffect, useCallback } from "react"
import { Mic, MicOff } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useComposerRuntime } from "@assistant-ui/react"
import { useDeepgramTranscription } from "@/hooks/useDeepgramTranscription"
import { cn } from "@/lib/utils"

const LISTENING_MESSAGES = [
  "I’m listening...",
  "Speak your mind...",
  "Mind-dump it...",
  "Go on...",
  "Tell me more...",
]

const MESSAGE_ROTATE_INTERVAL = 8000

interface VoiceInputButtonProps {
  onSendAfterStop?: () => void
  className?: string
}

export function VoiceInputButton({ onSendAfterStop, className }: VoiceInputButtonProps) {
  const composerRuntime = useComposerRuntime()
  const [messageIndex, setMessageIndex] = useState(0)
  const [volume, setVolume] = useState(0)

  const handleTranscript = useCallback(
    (transcript: string) => {
      composerRuntime.setText(transcript)
    },
    [composerRuntime],
  )

  const handleVolumeChange = useCallback((vol: number) => {
    setVolume(vol)
  }, [])

  const { isListening, isConnecting, startListening, stopListening, resetTranscript, isAvailable } =
    useDeepgramTranscription({
      onTranscript: handleTranscript,
      onVolumeChange: handleVolumeChange,
    })

  // Rotate messages while listening
  useEffect(() => {
    if (!isListening) {
      setMessageIndex(0)
      return
    }

    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % LISTENING_MESSAGES.length)
    }, MESSAGE_ROTATE_INTERVAL)

    return () => clearInterval(interval)
  }, [isListening])

  const handleClick = useCallback(() => {
    if (isListening) {
      stopListening()
      // Don't auto-send, let user review and send manually
    } else {
      resetTranscript()
      startListening()
    }
  }, [isListening, stopListening, startListening, resetTranscript])

  // Don't render if Deepgram is not configured
  if (!isAvailable) {
    return null
  }

  const isActive = isListening || isConnecting

  return (
    <motion.button
      type="button"
      layout
      onClick={handleClick}
      disabled={isConnecting}
      initial={false}
      animate={{
        backgroundColor: isActive ? "var(--secondary-foreground)" : "#FAF9F1",
      }}
      transition={{
        layout: { type: "spring", stiffness: 150, damping: 21 },
        backgroundColor: { duration: 0.15 },
      }}
      className={cn(
        "relative flex h-[34px] items-center justify-center gap-1 rounded-full transition-colors",
        isActive
          ? "px-3 text-primary-foreground"
          : "w-[34px] text-muted-foreground hover:bg-accent hover:text-foreground",
        isConnecting && "cursor-wait",
        className,
      )}
      aria-label={isActive ? "Stop voice input" : "Start voice input"}
    >
      {/* Mic icon */}
      <motion.div
        layout
        animate={{ scale: isActive ? [1, 1.1, 1] : 1 }}
        transition={{
          scale: {
            repeat: isActive ? Infinity : 0,
            duration: 1.5,
            ease: "easeInOut",
          },
          layout: { type: "spring", stiffness: 400, damping: 30 },
        }}
        className="flex-shrink-0 z-2 relative"
      >
        {isActive ? <MicOff className="size-5" /> : <Mic className="size-5" />}
      </motion.div>

      {/* Rotating message label */}
      <AnimatePresence mode="popLayout">
        {isActive && (
          <motion.span
            layout
            key={messageIndex}
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: 0.3 }}
            className="whitespace-nowrap text-sm font-medium relative z-2"
          >
            {LISTENING_MESSAGES[messageIndex]}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Outer volume-reactive ring */}
      {isListening && (
        <motion.div
          className="pointer-events-none absolute -inset-1 rounded-full z-1"
          style={{
            backgroundColor: "var(--secondary-foreground)",
            scaleX: 1 + volume * 0.2,
            scaleY: 1 + volume * 0.4,
            opacity: volume * 0.4,
          }}
        />
      )}
    </motion.button>
  )
}
