"use client"

import { useRef, useState, useEffect, useCallback, useMemo, createContext, useContext } from "react"
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
// Cluster Component
// ============================================================================

interface ClusterProps {
  name: string
  items: ClusterGridItem[]
  color: ClusterColor
  ghostAt: [number, number] | null // Show ghost at this position
  ghostHeight: number | null // Height of the ghost (matches dragged item)
  excludeItemId: string | null // Don't render this item (it's being dragged)
  onPointerDown: (e: React.PointerEvent, item: ClusterGridItem) => void
  onBoundsChange: (width: number, height: number) => void // Report measured bounds
  onItemHeightsChange: (heights: Map<string, number>) => void // Report item heights
}

function Cluster({ name, items, color, ghostAt, ghostHeight, excludeItemId, onPointerDown, onBoundsChange, onItemHeightsChange }: ClusterProps) {
  const context = useContext(ClusterGridContext)
  const config = context?.config || DEFAULT_LAYOUT_CONFIG
  const colors = CLUSTER_COLOR_VALUES[color]

  // Measure item heights
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [measuredHeights, setMeasuredHeights] = useState<Map<string, number>>(new Map())
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const measureHeights = () => {
      const newHeights = new Map<string, number>()
      itemRefs.current.forEach((el, id) => {
        newHeights.set(id, el.offsetHeight)
      })
      setMeasuredHeights(newHeights)
      // Mark as ready once we have measurements
      if (newHeights.size > 0) {
        setIsReady(true)
      }
    }

    // Measure after initial render
    requestAnimationFrame(measureHeights)

    // Re-measure on resize
    const observer = new ResizeObserver(measureHeights)
    itemRefs.current.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [items])

  // Report item heights to parent
  useEffect(() => {
    if (measuredHeights.size > 0) {
      onItemHeightsChange(measuredHeights)
    }
  }, [measuredHeights, onItemHeightsChange])

  // Calculate layouts
  const layouts = useMemo(() => {
    const itemsWithHeights = items.map((item) => ({
      id: item.id,
      at: item.at,
      height: measuredHeights.get(item.id) || config.minItemHeight,
    }))

    return calculateItemLayouts(
      itemsWithHeights,
      config,
      ghostAt || undefined,
      excludeItemId || undefined,
      ghostHeight || undefined
    )
  }, [items, measuredHeights, config, ghostAt, excludeItemId, ghostHeight])

  // Create layout map for quick lookup
  const layoutMap = useMemo(() => {
    const map = new Map<string, ItemLayout>()
    layouts.forEach((l) => map.set(l.id, l))
    return map
  }, [layouts])

  // Content bounds
  const bounds = useMemo(() => calculateContentBounds(layouts), [layouts])

  // Report bounds to parent
  useEffect(() => {
    onBoundsChange(
      bounds.width || config.columnWidth,
      bounds.height || config.minItemHeight
    )
  }, [bounds, config.columnWidth, config.minItemHeight, onBoundsChange])

  return (
    <div data-cluster-name={name}>
      {/* Cluster heading */}
      <h2 className="wb-cluster-heading mb-4">{name}</h2>

      {/* Items container */}
      <div
        className="relative"
        style={{
          width: bounds.width || config.columnWidth,
          minHeight: bounds.height || config.minItemHeight,
          transition: "min-height 0.2s ease-out",
        }}
      >
        {/* Render actual items */}
        {items.map((item) => {
          // Skip the item being dragged (it's rendered at root level)
          if (item.id === excludeItemId) return null

          const layout = layoutMap.get(item.id)
          if (!layout) return null

          return (
            <div
              key={item.id}
              ref={(el) => {
                if (el) itemRefs.current.set(item.id, el)
                else itemRefs.current.delete(item.id)
              }}
              className="absolute rounded-lg p-4 cursor-grab active:cursor-grabbing"
              style={{
                width: config.columnWidth,
                minHeight: config.minItemHeight,
                transform: `translate(${layout.x}px, ${layout.y}px)`,
                transition: "transform 0.2s ease-out, opacity 0.15s ease-out",
                opacity: isReady ? 1 : 0,
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                color: colors.text,
                boxShadow: "0 2px 8px -2px oklch(0 0 0 / 0.06)",
              }}
              onPointerDown={(e) => onPointerDown(e, item)}
            >
              <h3 className="wb-sticky-heading">{item.heading}</h3>
              {item.body && <p className="wb-sticky-body mt-1">{item.body}</p>}
            </div>
          )
        })}

        {/* Render ghost placeholder */}
        {ghostAt && (
          <div
            className="absolute rounded-lg p-4"
            style={{
              width: config.columnWidth,
              height: ghostHeight || config.minItemHeight,
              transform: `translate(${layoutMap.get("__ghost__")?.x ?? 0}px, ${layoutMap.get("__ghost__")?.y ?? 0}px)`,
              transition: "transform 0.2s ease-out, height 0.15s ease-out",
              backgroundColor: colors.bg,
              border: `2px dashed ${colors.border}`,
              opacity: 0.5,
            }}
          />
        )}
      </div>
    </div>
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
  const [dragState, setDragState] = useState<DragState | null>(null)

  // Track measured bounds from each cluster
  const [measuredBounds, setMeasuredBounds] = useState<
    Record<string, { width: number; height: number }>
  >({})

  // Track measured item heights per cluster (for accurate insert position calculation)
  const itemHeightsRef = useRef<Record<string, Map<string, number>>>({})

  // Refs for current values (avoid stale closures)
  const dataRef = useRef(data)
  const dragStateRef = useRef(dragState)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    dragStateRef.current = dragState
  }, [dragState])

  // Handle bounds change from a cluster
  const handleBoundsChange = useCallback((clusterName: string, width: number, height: number) => {
    setMeasuredBounds((prev) => {
      const existing = prev[clusterName]
      if (existing && existing.width === width && existing.height === height) {
        return prev // No change
      }
      return { ...prev, [clusterName]: { width, height } }
    })
  }, [])

  // Handle item heights change from a cluster
  const handleItemHeightsChange = useCallback((clusterName: string, heights: Map<string, number>) => {
    itemHeightsRef.current[clusterName] = heights
  }, [])

  // Calculate cluster positions using measured bounds
  const clusterPositions = useMemo(() => {
    const clusterData: Record<string, { at: [number, number]; contentWidth: number; contentHeight: number }> = {}
    for (const [name, cluster] of Object.entries(data.clusters)) {
      const measured = measuredBounds[name]
      clusterData[name] = {
        at: cluster.at,
        contentWidth: measured?.width || config.columnWidth,
        contentHeight: measured?.height || config.minItemHeight,
      }
    }
    return calculateClusterPositions(clusterData, config)
  }, [data.clusters, measuredBounds, config])

  // Find cluster at point
  const findClusterAtPoint = useCallback((clientX: number, clientY: number): string | null => {
    for (const [name, element] of clusterRefs.current.entries()) {
      const rect = element.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return name
      }
    }
    return null
  }, [])

  // Start drag
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
    []
  )

  // Pointer move during drag
  useEffect(() => {
    if (!dragState) return

    const handlePointerMove = (e: PointerEvent) => {
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return

      const newX = e.clientX - containerRect.left - dragState.offsetX
      const newY = e.clientY - containerRect.top - dragState.offsetY

      // Find which cluster we're over
      const clusterAtPoint = findClusterAtPoint(e.clientX, e.clientY)

      // Calculate insert position within that cluster
      let insertPosition = dragState.insertPosition
      if (clusterAtPoint) {
        const clusterElement = clusterRefs.current.get(clusterAtPoint)
        const clusterRect = clusterElement?.getBoundingClientRect()
        if (clusterRect) {
          // Calculate dragged card's position relative to cluster content area
          const dragCardLeft = e.clientX - dragState.offsetX - clusterRect.left
          const dragCardTop = e.clientY - dragState.offsetY - clusterRect.top - 40 // Account for heading

          // Get layouts for this cluster (without ghost, without dragged item)
          const cluster = dataRef.current.clusters[clusterAtPoint]
          if (cluster) {
            // Use measured heights for accurate positioning
            const clusterHeights = itemHeightsRef.current[clusterAtPoint]
            const itemsWithHeights = cluster.items
              .filter((i) => i.id !== dragState.itemId)
              .map((item) => ({
                id: item.id,
                at: item.at,
                height: clusterHeights?.get(item.id) || config.minItemHeight,
              }))
            const layouts = calculateItemLayouts(itemsWithHeights, config)
            insertPosition = calculateInsertPosition(layouts, dragCardLeft, dragCardTop, config, dragState.itemHeight)
          }
        }
      }

      setDragState((prev) => {
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
        // Dropped outside any cluster - no change
        setDragState(null)
        return
      }

      if (currentCluster === sourceCluster) {
        // Reorder within same cluster
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
        // Cross-cluster transfer
        const sourceItems = currentData.clusters[sourceCluster]?.items || []
        const targetItems = currentData.clusters[currentCluster]?.items || []
        const itemToMove = sourceItems.find((i) => i.id === itemId)

        if (itemToMove) {
          // Remove from source
          const newSourceItems = normalizePositions(
            sourceItems.filter((i) => i.id !== itemId)
          )

          // Add to target at insert position, shifting others
          const newItem: ClusterGridItem = { ...itemToMove, at: insertPosition }
          const targetWithShifted = targetItems.map((item) => {
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

  // Context value
  const contextValue = useMemo<ClusterGridContextValue>(
    () => ({ dragState, config }),
    [dragState, config]
  )

  // Get dragged item info for rendering
  const getDraggedItemInfo = () => {
    if (!dragState) return null
    const sourceCluster = data.clusters[dragState.sourceCluster]
    if (!sourceCluster) return null
    const item = sourceCluster.items.find((i) => i.id === dragState.itemId)
    if (!item) return null

    // Use target cluster color if hovering over different cluster
    const colorName =
      dragState.currentCluster && dragState.currentCluster !== dragState.sourceCluster
        ? DEFAULT_CLUSTER_COLORS[dragState.currentCluster] || "yellow"
        : DEFAULT_CLUSTER_COLORS[dragState.sourceCluster] || "yellow"

    return { item, colors: CLUSTER_COLOR_VALUES[colorName] }
  }

  const draggedItemInfo = getDraggedItemInfo()

  return (
    <ClusterGridContext.Provider value={contextValue}>
      <div ref={containerRef} className={`relative ${className}`}>
        {/* Render clusters */}
        {Object.entries(data.clusters).map(([name, cluster]) => {
          const pos = clusterPositions[name] || { x: 0, y: 0 }
          const color = DEFAULT_CLUSTER_COLORS[name] || "yellow"

          // Determine ghost position and height for this cluster
          let ghostAt: [number, number] | null = null
          let ghostHeight: number | null = null
          if (dragState?.currentCluster === name) {
            ghostAt = dragState.insertPosition
            ghostHeight = dragState.itemHeight
          }

          // Exclude dragged item from its source cluster
          const excludeItemId = dragState?.sourceCluster === name ? dragState.itemId : null

          return (
            <div
              key={name}
              ref={(el) => {
                if (el) clusterRefs.current.set(name, el)
                else clusterRefs.current.delete(name)
              }}
              className="absolute"
              style={{
                left: pos.x,
                top: pos.y,
                transition: "top 0.3s ease-out, left 0.3s ease-out",
              }}
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
                onItemHeightsChange={(heights) => handleItemHeightsChange(name, heights)}
              />
            </div>
          )
        })}

        {/* Render dragged item at root level */}
        {dragState && draggedItemInfo && (
          <div
            className="rounded-lg p-4 pointer-events-none"
            style={{
              position: "absolute",
              left: dragState.currentX,
              top: dragState.currentY,
              width: dragState.itemWidth,
              minHeight: config.minItemHeight,
              backgroundColor: draggedItemInfo.colors.bg,
              border: `1px solid ${draggedItemInfo.colors.border}`,
              color: draggedItemInfo.colors.text,
              boxShadow: "0 16px 32px -4px oklch(0 0 0 / 0.15)",
              zIndex: 1000,
              cursor: "grabbing",
              transition: "background-color 0.15s, border-color 0.15s",
            }}
          >
            <h3 className="wb-sticky-heading">{draggedItemInfo.item.heading}</h3>
            {draggedItemInfo.item.body && (
              <p className="wb-sticky-body mt-1">{draggedItemInfo.item.body}</p>
            )}
          </div>
        )}
      </div>
    </ClusterGridContext.Provider>
  )
}
