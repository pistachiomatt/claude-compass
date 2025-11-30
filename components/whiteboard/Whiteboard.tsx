"use client"

import { useRef, useState, useEffect, useCallback, useMemo } from "react"
import type { WhiteboardData, WhiteboardCluster, WhiteboardItem } from "./types"
import { GRID_CONFIG, CLUSTER_COLORS, STICKY_COLORS, type StickyColor } from "./types"
import { PeekingDrawer } from "./PeekingDrawer"

// Packery and Draggabilly types (dynamic import)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PackeryInstance = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DraggabillyInstance = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DraggabillyClass = any

interface WhiteboardProps {
  data: WhiteboardData
  onDataChange?: (data: WhiteboardData) => void
  className?: string
}

// Sort items by at[] position: row-major order (row first, then column)
function sortItemsByPosition(items: WhiteboardItem[]): WhiteboardItem[] {
  return [...items].sort((a, b) => {
    // Sort by row first, then by column
    if (a.at[1] !== b.at[1]) return a.at[1] - b.at[1]
    return a.at[0] - b.at[0]
  })
}

// Calculate cluster width from item positions
function getClusterWidth(items: WhiteboardItem[]): number {
  if (items.length === 0) return GRID_CONFIG.stickyMinWidth + GRID_CONFIG.itemGap
  const maxCol = Math.max(...items.map((item) => item.at[0]))
  const numCols = maxCol + 1
  // Width = numCols * (sticky width + gap)
  return numCols * (GRID_CONFIG.stickyMinWidth + GRID_CONFIG.itemGap)
}

// Gap between clusters
const CLUSTER_GAP = GRID_CONFIG.clusterGap

interface ClusterProps {
  name: string
  cluster: WhiteboardCluster
  color: StickyColor
  onHeightChange: (height: number) => void
  onItemsReorder: (items: WhiteboardItem[]) => void
}

function Cluster({ name, cluster, color, onHeightChange, onItemsReorder }: ClusterProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const packeryRef = useRef<PackeryInstance>(null)
  const draggiesRef = useRef<Map<string, DraggabillyInstance>>(new Map())
  const draggabillyClassRef = useRef<DraggabillyClass>(null)
  const knownItemIdsRef = useRef<Set<string>>(new Set())
  const [isInitialized, setIsInitialized] = useState(false)
  const colors = STICKY_COLORS[color]

  // Refs to avoid stale closures in Packery event handlers
  const clusterItemsRef = useRef(cluster.items)
  const onItemsReorderRef = useRef(onItemsReorder)

  // Keep refs up to date
  useEffect(() => {
    clusterItemsRef.current = cluster.items
  }, [cluster.items])

  useEffect(() => {
    onItemsReorderRef.current = onItemsReorder
  }, [onItemsReorder])

  // Sort items by at[] position for rendering
  const sortedItems = useMemo(() => sortItemsByPosition(cluster.items), [cluster.items])

  // Calculate width from items
  const clusterWidth = getClusterWidth(cluster.items)

  // Initialize Packery once on mount
  useEffect(() => {
    let mounted = true

    const initPackery = async () => {
      if (!containerRef.current || packeryRef.current) return

      const PackeryModule = await import("packery")
      const DraggabillyModule = await import("draggabilly")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const PackeryClass = (PackeryModule as any).default || (PackeryModule as any).Packery || PackeryModule
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const DraggabillyClassImport = (DraggabillyModule as any).default || DraggabillyModule

      if (!mounted || !containerRef.current) return

      draggabillyClassRef.current = DraggabillyClassImport

      const pckry = new PackeryClass(containerRef.current, {
        itemSelector: ".wb-item",
        columnWidth: GRID_CONFIG.stickyMinWidth + GRID_CONFIG.itemGap,
        gutter: GRID_CONFIG.itemGap,
        transitionDuration: "0.3s",
        stagger: 30,
        resize: false, // We handle resize manually
      })

      packeryRef.current = pckry

      // Bind Draggabilly to existing items
      const items = containerRef.current.querySelectorAll(".wb-item") as NodeListOf<HTMLElement>
      items.forEach((item) => {
        const itemId = item.dataset.itemId
        if (itemId) {
          const draggie = new DraggabillyClassImport(item)
          pckry.bindDraggabillyEvents(draggie)
          draggiesRef.current.set(itemId, draggie)
          knownItemIdsRef.current.add(itemId)
        }
      })

      // Listen for layout complete to report height
      pckry.on("layoutComplete", () => {
        if (containerRef.current) {
          // Use maxY from packery which is the actual content height
          const height = pckry.maxY || containerRef.current.offsetHeight
          onHeightChange(height)
        }
      })

      // Listen for drag end to sync positions back to data
      pckry.on("dragItemPositioned", () => {
        // Use refs to get current values (avoid stale closures)
        const currentItems = clusterItemsRef.current
        const currentOnItemsReorder = onItemsReorderRef.current

        // Get items in their new visual order
        const orderedElements = pckry.getItemElements() as HTMLElement[]
        const numCols = Math.max(1, ...currentItems.map((i) => i.at[0] + 1))

        const reorderedItems: WhiteboardItem[] = orderedElements.map((el, index) => {
          const itemId = el.dataset.itemId
          const originalItem = currentItems.find((i) => i.id === itemId)
          if (!originalItem) {
            throw new Error(`Item ${itemId} not found in cluster`)
          }
          // Calculate new grid position (row-major order)
          const col = index % numCols
          const row = Math.floor(index / numCols)
          return {
            ...originalItem,
            at: [col, row] as [number, number],
          }
        })
        currentOnItemsReorder(reorderedItems)
      })

      // Initial layout to get height
      pckry.layout()
      setIsInitialized(true)
    }

    initPackery()

    return () => {
      mounted = false
      draggiesRef.current.forEach((d) => d.destroy?.())
      packeryRef.current?.destroy?.()
      packeryRef.current = null
      draggiesRef.current.clear()
      knownItemIdsRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync items with Packery when data changes
  useEffect(() => {
    if (!isInitialized || !packeryRef.current || !containerRef.current || !draggabillyClassRef.current) return

    const pckry = packeryRef.current
    const DraggabillyClassImport = draggabillyClassRef.current
    const currentItemIds = new Set(cluster.items.map((item) => item.id))
    const knownIds = knownItemIdsRef.current

    // Find new items (in currentItemIds but not in knownIds)
    const newItemIds = [...currentItemIds].filter((id) => !knownIds.has(id))

    // Find removed items (in knownIds but not in currentItemIds)
    const removedItemIds = [...knownIds].filter((id) => !currentItemIds.has(id))

    // Handle removed items
    removedItemIds.forEach((itemId) => {
      const elem = containerRef.current?.querySelector(`[data-item-id="${itemId}"]`) as HTMLElement
      if (elem) {
        // Unbind draggabilly
        const draggie = draggiesRef.current.get(itemId)
        if (draggie) {
          pckry.unbindDraggabillyEvents(draggie)
          draggie.destroy()
          draggiesRef.current.delete(itemId)
        }
        // Remove from Packery (this also removes from DOM)
        pckry.remove(elem)
      }
      knownIds.delete(itemId)
    })

    // Handle new items - wait a tick for React to render them
    if (newItemIds.length > 0) {
      requestAnimationFrame(() => {
        if (!containerRef.current || !packeryRef.current) return

        const newElems: HTMLElement[] = []
        newItemIds.forEach((itemId) => {
          const elem = containerRef.current?.querySelector(`[data-item-id="${itemId}"]`) as HTMLElement
          if (elem) {
            newElems.push(elem)
            // Bind draggabilly
            const draggie = new DraggabillyClassImport(elem)
            packeryRef.current.bindDraggabillyEvents(draggie)
            draggiesRef.current.set(itemId, draggie)
            knownIds.add(itemId)
          }
        })
        if (newElems.length > 0) {
          // Tell Packery about new items
          packeryRef.current.appended(newElems)
        }
        // Reorder and layout after adding new items
        reorderPackeryItems()
      })
    } else {
      // No new items, but positions may have changed - reorder and layout
      reorderPackeryItems()
    }

    // Reorder Packery's internal items array to match sorted DOM order, then layout
    function reorderPackeryItems() {
      if (!containerRef.current || !packeryRef.current) return

      // Get DOM elements in their current (sorted) order
      const domElements = Array.from(
        containerRef.current.querySelectorAll(".wb-item")
      ) as HTMLElement[]

      // Reorder pckry.items to match DOM order
      // This preserves Item instances (and Draggabilly bindings) while reordering
      const reorderedItems = domElements
        .map((el) => packeryRef.current.getItem(el))
        .filter(Boolean)

      if (reorderedItems.length > 0) {
        packeryRef.current.items = reorderedItems
        packeryRef.current.layout()
      }
    }
  }, [sortedItems, isInitialized, cluster.items])

  // Re-layout when width changes
  useEffect(() => {
    if (packeryRef.current && isInitialized) {
      packeryRef.current.layout()
    }
  }, [clusterWidth, isInitialized])

  return (
    <div>
      {/* Cluster heading */}
      <h2 className="wb-cluster-heading mb-4">{name}</h2>

      {/* Packery container - width calculated from data */}
      <div
        ref={containerRef}
        className="relative"
        style={{ width: clusterWidth }}
        data-cluster-name={name}
      >
        {/* Render items in sorted order so DOM order matches desired layout order */}
        {sortedItems.map((item) => (
          <div
            key={item.id}
            data-item-id={item.id}
            className="wb-item rounded-lg p-4 cursor-grab active:cursor-grabbing"
            style={{
              width: GRID_CONFIG.stickyMinWidth,
              minHeight: GRID_CONFIG.stickyMinHeight,
              backgroundColor: colors.bg,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              boxShadow: `0 2px 8px -2px oklch(0 0 0 / 0.06), 0 1px 2px -1px oklch(0 0 0 / 0.04)`,
            }}
          >
            <h3 className="wb-sticky-heading">{item.heading}</h3>
            {item.body && <p className="wb-sticky-body">{item.body}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Whiteboard({ data, onDataChange, className = "" }: WhiteboardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 60, y: 60 })
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Track measured cluster heights for dynamic positioning
  const [clusterHeights, setClusterHeights] = useState<Record<string, number>>({})

  // Calculate cluster positions based on their at[] and measured heights
  const getClusterPosition = useCallback(
    (clusterName: string, cluster: WhiteboardCluster) => {
      const col = cluster.at[0]
      const row = cluster.at[1]

      // Calculate X position: sum of widths of all clusters in previous columns + gaps
      const allClusters = Object.entries(data.clusters)

      // Get max width per column
      const colWidths: Record<number, number> = {}
      allClusters.forEach(([, c]) => {
        const width = getClusterWidth(c.items)
        colWidths[c.at[0]] = Math.max(colWidths[c.at[0]] || 0, width)
      })

      let x = 0
      for (let c = 0; c < col; c++) {
        x += (colWidths[c] || 0) + CLUSTER_GAP
      }

      // Calculate Y position: sum of heights of clusters above in same column + gaps
      const clustersAbove = allClusters
        .filter(([, c]) => c.at[0] === col && c.at[1] < row)
        .sort((a, b) => a[1].at[1] - b[1].at[1])

      let y = 0
      clustersAbove.forEach(([clusterAboveName]) => {
        const height = clusterHeights[clusterAboveName] || 200 // Default height until measured
        y += height + CLUSTER_GAP
      })

      return { x, y }
    },
    [data.clusters, clusterHeights]
  )

  // Handle cluster height change
  const handleClusterHeightChange = useCallback((clusterName: string, height: number) => {
    setClusterHeights((prev) => {
      if (prev[clusterName] === height) return prev
      return { ...prev, [clusterName]: height }
    })
  }, [])

  // Handle items reorder from drag
  const handleItemsReorder = useCallback(
    (clusterName: string, items: WhiteboardItem[]) => {
      if (!onDataChange) return
      const newData: WhiteboardData = {
        ...data,
        clusters: {
          ...data.clusters,
          [clusterName]: {
            ...data.clusters[clusterName],
            items,
          },
        },
      }
      onDataChange(newData)
    },
    [data, onDataChange]
  )

  // Pan handlers - check if clicking on background elements
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // Only pan if clicking on the container background or canvas (not on items)
    if (
      target === containerRef.current ||
      target === canvasRef.current ||
      target.classList.contains("wb-dot-grid")
    ) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      e.preventDefault()
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  // Zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setZoom((z) => Math.min(2, Math.max(0.25, z * delta)))
    }
  }

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Canvas container with dot grid */}
      <div
        ref={containerRef}
        className="w-full h-full wb-dot-grid select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{
          cursor: isPanning ? "grabbing" : "grab",
          backgroundPosition: `${pan.x % GRID_CONFIG.dotGap}px ${pan.y % GRID_CONFIG.dotGap}px`,
        }}
      >
        {/* Transform layer for pan/zoom */}
        <div
          ref={canvasRef}
          className="absolute"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: "0 0",
            willChange: isPanning ? "transform" : "auto",
          }}
        >
          {/* Render each cluster */}
          {Object.entries(data.clusters).map(([name, cluster]) => {
            const pos = getClusterPosition(name, cluster)
            return (
              <div
                key={name}
                className="absolute"
                style={{
                  left: pos.x,
                  top: pos.y,
                  transition: "top 0.3s ease-out, left 0.3s ease-out",
                }}
              >
                <Cluster
                  name={name}
                  cluster={cluster}
                  color={CLUSTER_COLORS[name] || "yellow"}
                  onHeightChange={(h) => handleClusterHeightChange(name, h)}
                  onItemsReorder={(items) => handleItemsReorder(name, items)}
                />
              </div>
            )
          })}

          {/* Floating items */}
          {data.floating?.map((item) => {
            const floatingColors = STICKY_COLORS.orange
            return (
              <div
                key={item.id}
                className="absolute wb-item rounded-lg p-4"
                style={{
                  left: item.at[0] * GRID_CONFIG.cellSize,
                  top: item.at[1] * GRID_CONFIG.cellSize,
                  width: GRID_CONFIG.stickyMinWidth,
                  minHeight: GRID_CONFIG.stickyMinHeight,
                  backgroundColor: floatingColors.bg,
                  border: `1px solid ${floatingColors.border}`,
                  color: floatingColors.text,
                  boxShadow: `0 2px 8px -2px oklch(0 0 0 / 0.06), 0 1px 2px -1px oklch(0 0 0 / 0.04)`,
                }}
              >
                <h3 className="wb-sticky-heading">{item.content}</h3>
              </div>
            )
          })}
        </div>
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-16 right-4 bg-background/80 backdrop-blur-sm rounded-md px-3 py-1.5 text-xs text-muted-foreground border">
        {Math.round(zoom * 100)}%
      </div>

      {/* Stage indicator */}
      <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm rounded-md px-3 py-1.5 text-xs font-medium border">
        Stage: {data.stage}
      </div>

      {/* Peeking drawer */}
      <PeekingDrawer hmw={data.hmw} openQuestions={data.open_questions} />
    </div>
  )
}
