/**
 * ClusterGrid Type Definitions
 *
 * Items have explicit 2D grid positions: at: [column, row]
 * This is NOT masonry - it's explicit grid placement like Trello/Kanban.
 */

// Item in a cluster - has explicit [col, row] position
export interface ClusterGridItem {
  id: string
  heading: string
  body?: string
  at: [number, number] // [column, row] - explicit grid position
}

// A cluster of items
export interface ClusterGridCluster {
  at: [number, number] // Cluster's position in the grid of clusters
  items: ClusterGridItem[]
}

// Sticky question item (HMW or Open Question)
export interface StickyQuestion {
  id: string
  text: string
  type: "hmw" | "open_question"
}

// Full data model
export interface ClusterGridData {
  clusters: Record<string, ClusterGridCluster>
  stickyQuestions?: StickyQuestion[]
}

// Drag state during drag operation
export interface DragState {
  itemId: string
  sourceCluster: string
  sourcePosition: [number, number] // Original [col, row] of dragged item
  currentCluster: string | null // Which cluster pointer is over
  insertPosition: [number, number] // Where item would be inserted [col, row]
  // Pointer tracking
  currentX: number // Current item position (relative to container)
  currentY: number // Current item position (relative to container)
  offsetX: number // Offset from pointer to item top-left
  offsetY: number // Offset from pointer to item top-left
  itemWidth: number
  itemHeight: number
}

// Color palette for clusters
export type ClusterColor = "yellow" | "pink" | "blue" | "green" | "purple" | "orange"

export const CLUSTER_COLOR_VALUES: Record<
  ClusterColor,
  { bg: string; border: string; text: string }
> = {
  yellow: {
    bg: "oklch(0.97 0.04 95)",
    border: "oklch(0.92 0.06 92)",
    text: "oklch(0.35 0.04 85)",
  },
  pink: {
    bg: "oklch(0.96 0.03 10)",
    border: "oklch(0.91 0.05 10)",
    text: "oklch(0.38 0.05 10)",
  },
  blue: {
    bg: "oklch(0.96 0.02 240)",
    border: "oklch(0.91 0.04 240)",
    text: "oklch(0.38 0.04 240)",
  },
  green: {
    bg: "oklch(0.96 0.03 145)",
    border: "oklch(0.91 0.05 145)",
    text: "oklch(0.35 0.05 145)",
  },
  purple: {
    bg: "oklch(0.96 0.03 290)",
    border: "oklch(0.91 0.05 290)",
    text: "oklch(0.38 0.05 290)",
  },
  orange: {
    bg: "oklch(0.96 0.04 55)",
    border: "oklch(0.91 0.06 50)",
    text: "oklch(0.38 0.06 45)",
  },
}

// Map cluster names to colors
export const DEFAULT_CLUSTER_COLORS: Record<string, ClusterColor> = {
  "User Problems": "pink",
  Goals: "green",
  "User Journey": "blue",
  Insights: "purple",
  Ideas: "orange",
  HMW: "yellow",
}
