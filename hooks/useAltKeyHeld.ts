"use client"

import { useEffect, useState } from "react"

/**
 * Track whether the Alt/Option key is currently held down.
 * Useful for revealing hidden UI on modifier key press.
 */
export function useAltKeyHeld() {
  const [isHeld, setIsHeld] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.altKey && setIsHeld(true)
    const onKeyUp = (e: KeyboardEvent) => !e.altKey && setIsHeld(false)

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [])

  return isHeld
}
