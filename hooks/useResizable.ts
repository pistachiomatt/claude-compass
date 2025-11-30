import { useState, useRef, useEffect, useCallback } from "react"

interface UseResizableOptions {
  defaultWidth: number
  minWidth: number
  maxWidth: number
}

export function useResizable({ defaultWidth, minWidth, maxWidth }: UseResizableOptions) {
  const [width, setWidth] = useState(defaultWidth)
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return

      // Calculate delta (negative because we're dragging from the left edge)
      const delta = startX.current - e.clientX
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta))
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [minWidth, maxWidth])

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isResizing.current = true
      startX.current = e.clientX
      startWidth.current = width
      document.body.style.cursor = "ew-resize"
      document.body.style.userSelect = "none"
    },
    [width],
  )

  return { width, handleResizeStart }
}
