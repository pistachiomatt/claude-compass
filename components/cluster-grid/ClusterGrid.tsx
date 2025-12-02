"use client"

import { useRef, useState, useEffect, useCallback, useMemo, createContext, useContext } from "react"
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion"
import type { ClusterGridData, ClusterGridItem, DragState, ClusterColor } from "./types"
import { CLUSTER_COLOR_VALUES, DEFAULT_CLUSTER_COLORS } from "./types"
import {
  calculateItemLayouts,
  calculateContentBounds,
  calculateClusterPositions,
  calculateInsertPosition,
  moveItem,
  normalizePositions,
  DEFAULT_LAYOUT_CONFIG,
  type ItemLayout,
  type LayoutConfig,
} from "./layout"

// ============================================================================
// Animation Config - gentle, graceful springs
// ============================================================================

const SPRING_CONFIG = {
  layout: { type: "spring" as const, stiffness: 400, damping: 35 },
  ghost: { type: "spring" as const, stiffness: 300, damping: 30 },
  enter: { type: "spring" as const, stiffness: 350, damping: 25 },
}

// ============================================================================
// Context
// ============================================================================

interface ClusterGridContextValue {
  dragState: DragState | null
  config: LayoutConfig
}

const ClusterGridContext = createContext<ClusterGridContextValue | null>(null)

// ============================================================================
// Props
// ============================================================================

interface ClusterGridProps {
  data: ClusterGridData
  onDataChange?: (data: ClusterGridData) => void
  config?: Partial<LayoutConfig>
  className?: string
}

// ============================================================================
// Item Card Component - handles hover effects
// ============================================================================

interface ItemCardProps {
  item: ClusterGridItem
  layout: ItemLayout
  colors: { bg: string; border: string; text: string }
  config: LayoutConfig
  isReady: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onMeasure: (el: HTMLDivElement | null) => void
}

function ItemCard({
  item,
  layout,
  colors,
  config,
  isReady,
  onPointerDown,
  onMeasure,
}: ItemCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, x: layout.x, y: layout.y }}
      animate={{
        opacity: isReady ? 1 : 0,
        scale: 1,
        x: layout.x,
        y: layout.y,
        rotate: isHovered ? 1.5 : 0,
      }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={SPRING_CONFIG.layout}
      ref={onMeasure}
      className="absolute rounded-lg p-4 cursor-grab active:cursor-grabbing"
      style={{
        width: config.columnWidth,
        minHeight: config.minItemHeight,
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
      }}
      whileHover={{
        boxShadow: "0 8px 24px -4px oklch(0 0 0 / 0.12)",
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onPointerDown={onPointerDown}
    >
      <h3 className="wb-sticky-heading">{item.heading}</h3>
      {item.body && <p className="wb-sticky-body mt-1">{item.body}</p>}
    </motion.div>
  )
}

// ============================================================================
// Cluster Component
// ============================================================================

interface ClusterProps {
  name: string
  items: ClusterGridItem[]
  color: ClusterColor
  ghostAt: [number, number] | null
  ghostHeight: number | null
  excludeItemId: string | null
  onPointerDown: (e: React.PointerEvent, item: ClusterGridItem) => void
  onBoundsChange: (width: number, height: number) => void
  onItemHeightsChange: (heights: Map<string, number>) => void
  onContentRef: (el: HTMLDivElement | null) => void
}

function Cluster({
  name,
  items,
  color,
  ghostAt,
  ghostHeight,
  excludeItemId,
  onPointerDown,
  onBoundsChange,
  onItemHeightsChange,
  onContentRef,
}: ClusterProps) {
  const context = useContext(ClusterGridContext)
  const config = context?.config || DEFAULT_LAYOUT_CONFIG
  const colors = CLUSTER_COLOR_VALUES[color]

  // Measure item heights
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [measuredHeights, setMeasuredHeights] = useState<Map<string, number>>(new Map())
  const [isReady, setIsReady] = useState(false)
  const observerRef = useRef<ResizeObserver | null>(null)

  // Set up ResizeObserver once
  useEffect(() => {
    const measureHeights = () => {
      const newHeights = new Map<string, number>()
      itemRefs.current.forEach((el, id) => {
        newHeights.set(id, el.offsetHeight)
      })
      if (newHeights.size > 0) {
        setMeasuredHeights(newHeights)
        setIsReady(true)
      }
    }

    observerRef.current = new ResizeObserver(measureHeights)

    // Initial measure after render
    requestAnimationFrame(measureHeights)

    return () => observerRef.current?.disconnect()
  }, [])

  // Re-measure when items change
  useEffect(() => {
    const measureHeights = () => {
      const newHeights = new Map<string, number>()
      itemRefs.current.forEach((el, id) => {
        newHeights.set(id, el.offsetHeight)
      })
      if (newHeights.size > 0) {
        setMeasuredHeights(newHeights)
        setIsReady(true)
      }
    }
    requestAnimationFrame(measureHeights)
  }, [items])

  // Callback for registering refs and observing
  const handleMeasureRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      itemRefs.current.set(id, el)
      observerRef.current?.observe(el)
    } else {
      const existing = itemRefs.current.get(id)
      if (existing) {
        observerRef.current?.unobserve(existing)
      }
      itemRefs.current.delete(id)
    }
  }, [])

  useEffect(() => {
    if (measuredHeights.size > 0) {
      onItemHeightsChange(measuredHeights)
    }
  }, [measuredHeights, onItemHeightsChange])

  // Calculate layouts
  const layouts = useMemo(() => {
    const itemsWithHeights = items.map(item => ({
      id: item.id,
      at: item.at,
      height: measuredHeights.get(item.id) || config.minItemHeight,
    }))

    return calculateItemLayouts(
      itemsWithHeights,
      config,
      ghostAt || undefined,
      excludeItemId || undefined,
      ghostHeight || undefined,
    )
  }, [items, measuredHeights, config, ghostAt, excludeItemId, ghostHeight])

  const layoutMap = useMemo(() => {
    const map = new Map<string, ItemLayout>()
    layouts.forEach(l => map.set(l.id, l))
    return map
  }, [layouts])

  const bounds = useMemo(() => calculateContentBounds(layouts), [layouts])

  useEffect(() => {
    onBoundsChange(bounds.width || config.columnWidth, bounds.height || config.minItemHeight)
  }, [bounds, config.columnWidth, config.minItemHeight, onBoundsChange])

  const ghostLayout = layoutMap.get("__ghost__")

  return (
    <div data-cluster-name={name}>
      <h2 className="wb-cluster-heading mb-4">{name}</h2>

      <motion.div
        ref={onContentRef}
        className="relative"
        animate={{
          width: bounds.width || config.columnWidth,
          minHeight: bounds.height || config.minItemHeight,
        }}
        transition={SPRING_CONFIG.layout}
      >
        <AnimatePresence mode="popLayout">
          {items.map(item => {
            if (item.id === excludeItemId) return null

            const layout = layoutMap.get(item.id)
            if (!layout) return null

            return (
              <ItemCard
                key={item.id}
                item={item}
                layout={layout}
                colors={colors}
                config={config}
                isReady={isReady}
                onPointerDown={e => onPointerDown(e, item)}
                onMeasure={el => handleMeasureRef(item.id, el)}
              />
            )
          })}
        </AnimatePresence>

        {/* Ghost placeholder */}
        <AnimatePresence>
          {ghostAt && ghostLayout && (
            <motion.div
              key="ghost"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{
                opacity: 0.5,
                scale: 1,
                x: ghostLayout.x,
                y: ghostLayout.y,
                height: ghostHeight || config.minItemHeight,
              }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={SPRING_CONFIG.ghost}
              className="absolute rounded-lg"
              style={{
                width: config.columnWidth,
                backgroundColor: colors.bg,
                border: `2px dashed ${colors.border}`,
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

// ============================================================================
// Dragged Item Component - rubber band physics
// ============================================================================

interface DraggedItemProps {
  dragState: DragState
  item: ClusterGridItem
  colors: { bg: string; border: string; text: string }
  config: LayoutConfig
}

function DraggedItem({ dragState, item, colors, config }: DraggedItemProps) {
  // Use springs for smooth rubber-band following
  const x = useMotionValue(dragState.currentX)
  const y = useMotionValue(dragState.currentY)

  const springX = useSpring(x, { stiffness: 600, damping: 40 })
  const springY = useSpring(y, { stiffness: 600, damping: 40 })

  // Subtle rotation based on horizontal velocity
  const rotate = useTransform(springX, latest => {
    const velocity = springX.getVelocity()
    return Math.max(-8, Math.min(8, velocity / 150))
  })

  // Update target position when drag moves
  useEffect(() => {
    x.set(dragState.currentX)
    y.set(dragState.currentY)
  }, [dragState.currentX, dragState.currentY, x, y])

  return (
    <motion.div
      className="rounded-lg p-4 pointer-events-none"
      style={{
        position: "absolute",
        x: springX,
        y: springY,
        rotate,
        width: dragState.itemWidth,
        minHeight: config.minItemHeight,
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        zIndex: 1000,
        cursor: "grabbing",
      }}
      initial={{ scale: 1, boxShadow: "0 2px 8px -2px oklch(0 0 0 / 0.06)" }}
      animate={{
        scale: 1.02,
        boxShadow: "0 20px 40px -8px oklch(0 0 0 / 0.2)",
      }}
      exit={{
        scale: 1,
        boxShadow: "0 2px 8px -2px oklch(0 0 0 / 0.06)",
      }}
      transition={{ duration: 0.2 }}
    >
      <h3 className="wb-sticky-heading">{item.heading}</h3>
      {item.body && <p className="wb-sticky-body mt-1">{item.body}</p>}
    </motion.div>
  )
}

// ============================================================================
// Main ClusterGrid Component
// ============================================================================

export function ClusterGrid({
  data,
  onDataChange,
  config: configOverride,
  className = "",
}: ClusterGridProps) {
  const config = { ...DEFAULT_LAYOUT_CONFIG, ...configOverride }
  const containerRef = useRef<HTMLDivElement>(null)
  const clusterRefs = useRef<Map<string, HTMLElement>>(new Map())
  // Content refs point to the actual content container (where items are positioned)
  // This is what Packery calls the "packer" area - the coordinate space for item positions
  const contentRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [dragState, setDragState] = useState<DragState | null>(null)

  const [measuredBounds, setMeasuredBounds] = useState<
    Record<string, { width: number; height: number }>
  >({})

  const itemHeightsRef = useRef<Record<string, Map<string, number>>>({})

  const dataRef = useRef(data)
  const dragStateRef = useRef(dragState)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    dragStateRef.current = dragState
  }, [dragState])

  const handleBoundsChange = useCallback((clusterName: string, width: number, height: number) => {
    setMeasuredBounds(prev => {
      const existing = prev[clusterName]
      if (existing && existing.width === width && existing.height === height) {
        return prev
      }
      return { ...prev, [clusterName]: { width, height } }
    })
  }, [])

  const handleItemHeightsChange = useCallback(
    (clusterName: string, heights: Map<string, number>) => {
      itemHeightsRef.current[clusterName] = heights
    },
    [],
  )

  const { clusterPositions, totalBounds } = useMemo(() => {
    const clusterData: Record<
      string,
      { at: [number, number]; contentWidth: number; contentHeight: number }
    > = {}
    for (const [name, cluster] of Object.entries(data.clusters)) {
      const measured = measuredBounds[name]
      clusterData[name] = {
        at: cluster.at,
        contentWidth: measured?.width || config.columnWidth,
        contentHeight: measured?.height || config.minItemHeight,
      }
    }
    const positions = calculateClusterPositions(clusterData, config)

    // Calculate total bounds for container sizing
    let maxX = 0
    let maxY = 0
    for (const [name, pos] of Object.entries(positions)) {
      const clusterInfo = clusterData[name]
      if (clusterInfo) {
        maxX = Math.max(maxX, pos.x + clusterInfo.contentWidth)
        maxY = Math.max(maxY, pos.y + clusterInfo.contentHeight + 40) // +40 for heading
      }
    }

    return { clusterPositions: positions, totalBounds: { width: maxX, height: maxY } }
  }, [data.clusters, measuredBounds, config])

  const findClusterAtPoint = useCallback((clientX: number, clientY: number): string | null => {
    for (const [name, element] of clusterRefs.current.entries()) {
      const rect = element.getBoundingClientRect()
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return name
      }
    }
    return null
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, item: ClusterGridItem, clusterName: string) => {
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return

      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      const itemRect = (e.currentTarget as HTMLElement).getBoundingClientRect()

      setDragState({
        itemId: item.id,
        sourceCluster: clusterName,
        sourcePosition: item.at,
        currentCluster: clusterName,
        insertPosition: item.at,
        currentX: itemRect.left - containerRect.left,
        currentY: itemRect.top - containerRect.top,
        offsetX: e.clientX - itemRect.left,
        offsetY: e.clientY - itemRect.top,
        itemWidth: itemRect.width,
        itemHeight: itemRect.height,
      })
    },
    [],
  )

  useEffect(() => {
    if (!dragState) return

    const handlePointerMove = (e: PointerEvent) => {
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return

      const newX = e.clientX - containerRect.left - dragState.offsetX
      const newY = e.clientY - containerRect.top - dragState.offsetY

      const clusterAtPoint = findClusterAtPoint(e.clientX, e.clientY)

      let insertPosition = dragState.insertPosition
      if (clusterAtPoint) {
        // Use contentRef for position calculation - this is the actual coordinate space
        // where items are positioned
        const contentElement = contentRefs.current.get(clusterAtPoint)
        const contentRect = contentElement?.getBoundingClientRect()
        if (contentRect) {
          // Calculate drag position relative to content area
          const dragCardLeft = e.clientX - dragState.offsetX - contentRect.left
          const dragCardTop = e.clientY - dragState.offsetY - contentRect.top

          const cluster = dataRef.current.clusters[clusterAtPoint]
          if (cluster) {
            const clusterHeights = itemHeightsRef.current[clusterAtPoint]
            const itemsWithHeights = cluster.items
              .filter(i => i.id !== dragState.itemId)
              .map(item => ({
                id: item.id,
                at: item.at,
                height: clusterHeights?.get(item.id) || config.minItemHeight,
              }))
            const layouts = calculateItemLayouts(itemsWithHeights, config)
            // Use top-left position like Packery does
            insertPosition = calculateInsertPosition(
              layouts,
              dragCardLeft,
              dragCardTop,
              config,
              dragState.itemHeight,
            )
          }
        }
      }

      setDragState(prev => {
        if (!prev) return null
        return {
          ...prev,
          currentX: newX,
          currentY: newY,
          currentCluster: clusterAtPoint,
          insertPosition,
        }
      })
    }

    const handlePointerUp = () => {
      const state = dragStateRef.current
      if (!state || !onDataChange) {
        setDragState(null)
        return
      }

      const currentData = dataRef.current
      const { itemId, sourceCluster, currentCluster, insertPosition, sourcePosition } = state

      if (!currentCluster) {
        setDragState(null)
        return
      }

      if (currentCluster === sourceCluster) {
        const [newCol, newRow] = insertPosition
        const [oldCol, oldRow] = sourcePosition

        if (newCol !== oldCol || newRow !== oldRow) {
          const cluster = currentData.clusters[sourceCluster]
          const newItems = moveItem(cluster.items, itemId, insertPosition)

          onDataChange({
            ...currentData,
            clusters: {
              ...currentData.clusters,
              [sourceCluster]: {
                ...cluster,
                items: normalizePositions(newItems),
              },
            },
          })
        }
      } else {
        const sourceItems = currentData.clusters[sourceCluster]?.items || []
        const targetItems = currentData.clusters[currentCluster]?.items || []
        const itemToMove = sourceItems.find(i => i.id === itemId)

        if (itemToMove) {
          const newSourceItems = normalizePositions(sourceItems.filter(i => i.id !== itemId))

          const newItem: ClusterGridItem = { ...itemToMove, at: insertPosition }
          const targetWithShifted = targetItems.map(item => {
            const [col, row] = item.at
            if (col === insertPosition[0] && row >= insertPosition[1]) {
              return { ...item, at: [col, row + 1] as [number, number] }
            }
            return item
          })
          const newTargetItems = normalizePositions([...targetWithShifted, newItem])

          onDataChange({
            ...currentData,
            clusters: {
              ...currentData.clusters,
              [sourceCluster]: {
                ...currentData.clusters[sourceCluster],
                items: newSourceItems,
              },
              [currentCluster]: {
                ...currentData.clusters[currentCluster],
                items: newTargetItems,
              },
            },
          })
        }
      }

      setDragState(null)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [dragState, findClusterAtPoint, onDataChange, config])

  const contextValue = useMemo<ClusterGridContextValue>(
    () => ({ dragState, config }),
    [dragState, config],
  )

  const getDraggedItemInfo = () => {
    if (!dragState) return null
    const sourceCluster = data.clusters[dragState.sourceCluster]
    if (!sourceCluster) return null
    const item = sourceCluster.items.find(i => i.id === dragState.itemId)
    if (!item) return null

    const colorName =
      dragState.currentCluster && dragState.currentCluster !== dragState.sourceCluster
        ? DEFAULT_CLUSTER_COLORS[dragState.currentCluster] || "yellow"
        : DEFAULT_CLUSTER_COLORS[dragState.sourceCluster] || "yellow"

    return { item, colors: CLUSTER_COLOR_VALUES[colorName] }
  }

  const draggedItemInfo = getDraggedItemInfo()

  return (
    <ClusterGridContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={`relative ${className}`}
        style={{
          minWidth: totalBounds.width || undefined,
          minHeight: totalBounds.height || undefined,
        }}
      >
        {/* Render clusters */}
        {Object.entries(data.clusters).map(([name, cluster]) => {
          const pos = clusterPositions[name] || { x: 0, y: 0 }
          const color = DEFAULT_CLUSTER_COLORS[name] || "yellow"

          let ghostAt: [number, number] | null = null
          let ghostHeight: number | null = null
          if (dragState?.currentCluster === name) {
            ghostAt = dragState.insertPosition
            ghostHeight = dragState.itemHeight
          }

          const excludeItemId = dragState?.sourceCluster === name ? dragState.itemId : null

          return (
            <motion.div
              key={name}
              ref={el => {
                if (el) clusterRefs.current.set(name, el)
                else clusterRefs.current.delete(name)
              }}
              className="absolute"
              animate={{ x: pos.x, y: pos.y }}
              transition={SPRING_CONFIG.layout}
            >
              <Cluster
                name={name}
                items={cluster.items}
                color={color}
                ghostAt={ghostAt}
                ghostHeight={ghostHeight}
                excludeItemId={excludeItemId}
                onPointerDown={(e, item) => handlePointerDown(e, item, name)}
                onBoundsChange={(w, h) => handleBoundsChange(name, w, h)}
                onItemHeightsChange={heights => handleItemHeightsChange(name, heights)}
                onContentRef={el => {
                  if (el) contentRefs.current.set(name, el)
                  else contentRefs.current.delete(name)
                }}
              />
            </motion.div>
          )
        })}

        {/* Render dragged item with rubber band physics */}
        <AnimatePresence>
          {dragState && draggedItemInfo && (
            <DraggedItem
              key="dragged"
              dragState={dragState}
              item={draggedItemInfo.item}
              colors={draggedItemInfo.colors}
              config={config}
            />
          )}
        </AnimatePresence>
      </div>
    </ClusterGridContext.Provider>
  )
}
