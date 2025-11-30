"use client"

import { motion } from "framer-motion"

interface ArrowProps {
  from: DOMRect
  to: DOMRect
  containerOffset: { x: number; y: number }
}

export function Arrow({ from, to, containerOffset }: ArrowProps) {
  // Calculate center points relative to container
  const fromX = from.left + from.width / 2 - containerOffset.x
  const fromY = from.top + from.height - containerOffset.y
  const toX = to.left + to.width / 2 - containerOffset.x
  const toY = to.top - containerOffset.y

  // Calculate control points for a smooth bezier curve
  const deltaY = toY - fromY
  const controlOffset = Math.min(Math.abs(deltaY) * 0.5, 80)

  const controlPoint1 = { x: fromX, y: fromY + controlOffset }
  const controlPoint2 = { x: toX, y: toY - controlOffset }

  // Create the curved path
  const pathD = `M ${fromX} ${fromY} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${toX} ${toY}`

  // Arrowhead calculations
  const arrowSize = 6
  const angle = Math.atan2(toY - controlPoint2.y, toX - controlPoint2.x)
  const arrowPoint1 = {
    x: toX - arrowSize * Math.cos(angle - Math.PI / 6),
    y: toY - arrowSize * Math.sin(angle - Math.PI / 6),
  }
  const arrowPoint2 = {
    x: toX - arrowSize * Math.cos(angle + Math.PI / 6),
    y: toY - arrowSize * Math.sin(angle + Math.PI / 6),
  }

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      {/* Arrow line */}
      <motion.path
        d={pathD}
        fill="none"
        stroke="oklch(0.6 0 0 / 0.4)"
        strokeWidth={1.5}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      />

      {/* Arrowhead */}
      <motion.path
        d={`M ${toX} ${toY} L ${arrowPoint1.x} ${arrowPoint1.y} L ${arrowPoint2.x} ${arrowPoint2.y} Z`}
        fill="oklch(0.6 0 0 / 0.4)"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, delay: 0.6 }}
        style={{ transformOrigin: `${toX}px ${toY}px` }}
      />
    </motion.g>
  )
}
