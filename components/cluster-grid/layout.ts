/**
 * ClusterGrid Layout Calculations
 *
 * Items have explicit 2D positions: at: [column, row]
 * Layout is column-based: each column stacks items vertically.
 * When dragging, items shift to make room for the ghost.
 */

export interface LayoutConfig {
  columnWidth: number
  itemGap: number
  clusterGap: number
  minItemHeight: number
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  columnWidth: 180,
  itemGap: 12,
  clusterGap: 48,
  minItemHeight: 80,
}

export interface ItemLayout {
  id: string
  x: number
  y: number
  width: number
  height: number
  column: number
  row: number
  isGhost?: boolean
}

interface ItemInput {
  id: string
  at: [number, number] // [column, row]
  height: number
}

/**
 * Calculate item layouts from 2D positions.
 * Items in each column stack vertically based on their row order.
 *
 * @param items - Items with id, at:[col,row], and measured height
 * @param config - Layout configuration
 * @param ghostAt - Optional: show a ghost at this [col, row], shifting items below
 * @param excludeId - Optional: exclude this item from layout (it's being dragged)
 * @param ghostHeight - Optional: height of the ghost (should match dragged item)
 */
export function calculateItemLayouts(
  items: ItemInput[],
  config: LayoutConfig,
  ghostAt?: [number, number],
  excludeId?: string,
  ghostHeight?: number
): ItemLayout[] {
  const { columnWidth, itemGap, minItemHeight } = config

  // Filter out excluded item
  const activeItems = excludeId ? items.filter((i) => i.id !== excludeId) : items

  // Group items by column
  const columns: Map<number, ItemInput[]> = new Map()
  for (const item of activeItems) {
    const col = item.at[0]
    if (!columns.has(col)) {
      columns.set(col, [])
    }
    columns.get(col)!.push(item)
  }

  // Sort each column by row
  for (const colItems of columns.values()) {
    colItems.sort((a, b) => a.at[1] - b.at[1])
  }

  // If ghost, add it to the appropriate column
  if (ghostAt) {
    const [ghostCol, ghostRow] = ghostAt
    if (!columns.has(ghostCol)) {
      columns.set(ghostCol, [])
    }
    // Insert ghost at the right position
    const colItems = columns.get(ghostCol)!
    const ghostItem: ItemInput = {
      id: "__ghost__",
      at: ghostAt,
      height: ghostHeight || minItemHeight,
    }

    // Find insert index
    let insertIdx = colItems.findIndex((item) => item.at[1] >= ghostRow)
    if (insertIdx === -1) insertIdx = colItems.length

    colItems.splice(insertIdx, 0, ghostItem)
  }

  // Calculate layouts
  const layouts: ItemLayout[] = []

  for (const [col, colItems] of columns.entries()) {
    let y = 0
    for (const item of colItems) {
      layouts.push({
        id: item.id,
        x: col * (columnWidth + itemGap),
        y,
        width: columnWidth,
        height: item.height,
        column: col,
        row: item.at[1],
        isGhost: item.id === "__ghost__",
      })
      y += item.height + itemGap
    }
  }

  return layouts
}

/**
 * Calculate the bounding box of all items.
 */
export function calculateContentBounds(layouts: ItemLayout[]): { width: number; height: number } {
  if (layouts.length === 0) {
    return { width: 0, height: 0 }
  }

  let maxX = 0
  let maxY = 0

  for (const item of layouts) {
    maxX = Math.max(maxX, item.x + item.width)
    maxY = Math.max(maxY, item.y + item.height)
  }

  return { width: maxX, height: maxY }
}

/**
 * Calculate positions for multiple clusters based on their grid positions.
 * Uses masonry layout: each column stacks independently (no row alignment).
 */
export function calculateClusterPositions(
  clusters: Record<string, { at: [number, number]; contentWidth: number; contentHeight: number }>,
  config: LayoutConfig
): Record<string, { x: number; y: number }> {
  const { clusterGap } = config
  const entries = Object.entries(clusters)

  // Calculate max width per column (for X positioning)
  const colWidths: Record<number, number> = {}
  for (const [, cluster] of entries) {
    const col = cluster.at[0]
    colWidths[col] = Math.max(colWidths[col] || 0, cluster.contentWidth)
  }

  // Group clusters by column, sorted by row
  const columns: Map<number, Array<{ name: string; row: number; height: number }>> = new Map()
  for (const [name, cluster] of entries) {
    const col = cluster.at[0]
    if (!columns.has(col)) {
      columns.set(col, [])
    }
    columns.get(col)!.push({
      name,
      row: cluster.at[1],
      height: cluster.contentHeight + 40, // +40 for heading
    })
  }

  // Sort each column by row
  for (const colClusters of columns.values()) {
    colClusters.sort((a, b) => a.row - b.row)
  }

  const result: Record<string, { x: number; y: number }> = {}

  // Calculate positions - each column stacks independently
  for (const [col, colClusters] of columns.entries()) {
    // X: sum of widths of columns before this one
    let x = 0
    for (let c = 0; c < col; c++) {
      x += (colWidths[c] || 0) + clusterGap
    }

    // Y: stack clusters in this column, accumulating heights
    let y = 0
    for (const cluster of colClusters) {
      result[cluster.name] = { x, y }
      y += cluster.height + clusterGap
    }
  }

  return result
}

/**
 * Find which [col, row] an item should be inserted at based on dragged card position.
 * Uses 10% of target card height as threshold - when dragged card's bottom is
 * 10% into a card, that card shifts down.
 */
export function calculateInsertPosition(
  layouts: ItemLayout[],
  dragX: number,
  dragY: number,
  config: LayoutConfig,
  dragHeight?: number
): [number, number] {
  const { columnWidth, itemGap } = config
  const effectiveHeight = dragHeight || config.minItemHeight

  // Filter out ghost from calculations
  const realItems = layouts.filter((item) => !item.isGhost)

  if (realItems.length === 0) {
    return [0, 0]
  }

  // Find the max column in use
  const maxCol = Math.max(...realItems.map((item) => item.column))

  // Calculate column from drag position
  let col = Math.floor(dragX / (columnWidth + itemGap))
  col = Math.max(0, Math.min(col, maxCol))

  // Find items in this column
  const colItems = realItems
    .filter((item) => item.column === col)
    .sort((a, b) => a.y - b.y)

  if (colItems.length === 0) {
    return [col, 0]
  }

  const dragBottom = dragY + effectiveHeight
  const firstItem = colItems[0]
  const lastItem = colItems[colItems.length - 1]

  // If not yet 10% into the first item, insert at top
  if (dragBottom <= firstItem.y + firstItem.height * 0.1) {
    return [col, 0]
  }

  // If past the last item entirely, insert after it
  if (dragBottom > lastItem.y + lastItem.height) {
    return [col, lastItem.row + 1]
  }

  // Find the furthest card we're 10% into (check from bottom up)
  // That card shifts down, we insert at its row
  for (let i = colItems.length - 1; i >= 0; i--) {
    const item = colItems[i]
    const threshold = item.height * 0.1
    if (dragBottom > item.y + threshold) {
      return [col, item.row]
    }
  }

  // Fallback - insert at top
  return [col, 0]
}

/**
 * Move an item to a new position.
 * Returns new items array with updated positions.
 */
export function moveItem<T extends { id: string; at: [number, number] }>(
  items: T[],
  itemId: string,
  newPosition: [number, number]
): T[] {
  const item = items.find((i) => i.id === itemId)
  if (!item) return items

  const [oldCol, oldRow] = item.at
  const [newCol, newRow] = newPosition

  // If same position, no change
  if (oldCol === newCol && oldRow === newRow) return items

  return items.map((i) => {
    if (i.id === itemId) {
      // Move the dragged item
      return { ...i, at: newPosition as [number, number] }
    }

    const [iCol, iRow] = i.at

    // Items in the OLD column: fill the gap left by the moved item
    if (iCol === oldCol && iRow > oldRow) {
      return { ...i, at: [iCol, iRow - 1] as [number, number] }
    }

    // Items in the NEW column: make room for the moved item
    if (iCol === newCol && iRow >= newRow) {
      // Only shift if not same column, or if moving down in same column
      if (oldCol !== newCol || oldRow < newRow) {
        return { ...i, at: [iCol, iRow + 1] as [number, number] }
      }
    }

    return i
  })
}

/**
 * Normalize rows in each column to be contiguous (0, 1, 2, ...).
 */
export function normalizePositions<T extends { at: [number, number] }>(items: T[]): T[] {
  // Group by column
  const columns: Map<number, T[]> = new Map()
  for (const item of items) {
    const col = item.at[0]
    if (!columns.has(col)) {
      columns.set(col, [])
    }
    columns.get(col)!.push(item)
  }

  // Normalize each column
  const result: T[] = []
  for (const [col, colItems] of columns.entries()) {
    const sorted = [...colItems].sort((a, b) => a.at[1] - b.at[1])
    sorted.forEach((item, index) => {
      result.push({ ...item, at: [col, index] as [number, number] })
    })
  }

  return result
}

/**
 * Find the max column index in use.
 */
export function getMaxColumn(items: Array<{ at: [number, number] }>): number {
  if (items.length === 0) return 0
  return Math.max(...items.map((i) => i.at[0]))
}

/**
 * Add an item at the end of a specific column.
 */
export function addItemToColumn<T extends { at: [number, number] }>(
  items: T[],
  newItem: Omit<T, "at">,
  column: number
): T[] {
  const colItems = items.filter((i) => i.at[0] === column)
  const maxRow = colItems.length > 0 ? Math.max(...colItems.map((i) => i.at[1])) + 1 : 0
  return [...items, { ...newItem, at: [column, maxRow] } as T]
}
