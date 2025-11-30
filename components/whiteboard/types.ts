export interface WhiteboardItem {
  id: string
  heading: string
  body?: string
  at: [number, number] // [x, y] grid position
}

export interface WhiteboardCluster {
  at: [number, number] // [x, y] global grid position
  items: WhiteboardItem[]
}

export interface FloatingItem {
  id: string
  content: string
  at: [number, number]
}

export interface Connection {
  from: string
  to: string
}

export type DesignStage = "DISCOVER" | "DEFINE" | "DEVELOP" | "DELIVER"

export interface WhiteboardData {
  stage: DesignStage
  clusters: Record<string, WhiteboardCluster>
  floating?: FloatingItem[]
  connections?: Connection[]
  hmw?: string[] // "How Might We" questions
  open_questions?: string[]
}

// Sticky note color palette - soft Figjam-inspired pastels
export const STICKY_COLORS = {
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
} as const

export type StickyColor = keyof typeof STICKY_COLORS

// Map cluster names to colors
export const CLUSTER_COLORS: Record<string, StickyColor> = {
  "User Problems": "pink",
  Goals: "green",
  "User Journey": "blue",
  Insights: "purple",
  Ideas: "orange",
  HMW: "yellow",
}

// Grid configuration
export const GRID_CONFIG = {
  cellSize: 200, // pixels per grid unit
  stickyMinWidth: 180,
  stickyMaxWidth: 280,
  stickyMinHeight: 100,
  clusterGap: 60, // gap between clusters
  itemGap: 16, // gap between items within cluster
  dotSize: 1,
  dotGap: 24,
}
