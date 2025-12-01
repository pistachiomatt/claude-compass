/**
 * Parse whiteboard.yml content to ClusterGridData
 *
 * The whiteboard.yml schema from the system prompt:
 * - stage: DISCOVER | DEFINE | DEVELOP | DELIVER
 * - clusters: Record<name, { at: [x, y], items: [...] }>
 * - floating: [{ id, content, at }]
 * - connections: [{ from, to }]
 * - hmw: string[]
 * - open_questions: string[]
 */

import yaml from "js-yaml"
import type { ClusterGridData, ClusterGridItem, ClusterGridCluster, StickyQuestion } from "@/components/cluster-grid"

export type WhiteboardStage = "DISCOVER" | "DEFINE" | "DEVELOP" | "DELIVER"

interface WhiteboardYmlItem {
  id: string
  heading: string
  body?: string
  at: [number, number]
}

interface WhiteboardYmlCluster {
  at: [number, number]
  items: WhiteboardYmlItem[]
}

interface WhiteboardYmlFloating {
  id: string
  content: string
  at: [number, number]
}

interface WhiteboardYmlConnection {
  from: string
  to: string
}

export interface WhiteboardYml {
  stage?: WhiteboardStage
  clusters?: Record<string, WhiteboardYmlCluster>
  floating?: WhiteboardYmlFloating[]
  connections?: WhiteboardYmlConnection[]
  hmw?: string[]
  open_questions?: string[]
}

/**
 * Parse whiteboard.yml content string into WhiteboardYml
 */
export function parseWhiteboardYml(content: string): WhiteboardYml | null {
  try {
    const parsed = yaml.load(content) as WhiteboardYml
    return parsed
  } catch (e) {
    console.error("Failed to parse whiteboard.yml:", e)
    return null
  }
}

/**
 * Convert WhiteboardYml to ClusterGridData for rendering
 */
export function whiteboardYmlToClusterGridData(whiteboard: WhiteboardYml): ClusterGridData {
  const clusters: Record<string, ClusterGridCluster> = {}

  if (whiteboard.clusters) {
    for (const [name, cluster] of Object.entries(whiteboard.clusters)) {
      const items: ClusterGridItem[] = (cluster.items || []).map(item => ({
        id: item.id,
        heading: item.heading,
        body: item.body,
        at: item.at,
      }))

      clusters[name] = {
        at: cluster.at,
        items,
      }
    }
  }

  // Build sticky questions from hmw and open_questions (reversed - newest first)
  const stickyQuestions: StickyQuestion[] = []

  // Simple hash for stable IDs
  const hashText = (text: string) => {
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36)
  }

  // Add HMWs (reversed order - newest first)
  if (whiteboard.hmw) {
    const hmws = [...whiteboard.hmw].reverse()
    hmws.forEach((text) => {
      stickyQuestions.push({
        id: `hmw-${hashText(text)}`,
        text,
        type: "hmw",
      })
    })
  }

  // Add open questions (reversed order - newest first)
  if (whiteboard.open_questions) {
    const questions = [...whiteboard.open_questions].reverse()
    questions.forEach((text) => {
      stickyQuestions.push({
        id: `oq-${hashText(text)}`,
        text,
        type: "open_question",
      })
    })
  }

  return { clusters, stickyQuestions }
}

/**
 * Convert ClusterGridData back to WhiteboardYml for serialization
 * Preserves existing stage, floating, connections, hmw, open_questions
 */
export function clusterGridDataToWhiteboardYml(
  data: ClusterGridData,
  existing?: WhiteboardYml,
): WhiteboardYml {
  const result: WhiteboardYml = {
    stage: existing?.stage || "DISCOVER",
    clusters: {},
    floating: existing?.floating || [],
    connections: existing?.connections || [],
    hmw: existing?.hmw || [],
    open_questions: existing?.open_questions || [],
  }

  for (const [name, cluster] of Object.entries(data.clusters)) {
    result.clusters![name] = {
      at: cluster.at,
      items: cluster.items.map(item => ({
        id: item.id,
        heading: item.heading,
        body: item.body,
        at: item.at,
      })),
    }
  }

  return result
}

/**
 * Serialize WhiteboardYml back to YAML string
 */
export function serializeWhiteboardYml(whiteboard: WhiteboardYml): string {
  return yaml.dump(whiteboard, {
    lineWidth: -1, // Don't wrap lines
    quotingType: '"',
    forceQuotes: false,
  })
}

/**
 * Check if whiteboard has any content (clusters with items)
 */
export function hasWhiteboardContent(whiteboard: WhiteboardYml | null): boolean {
  if (!whiteboard?.clusters) return false

  for (const cluster of Object.values(whiteboard.clusters)) {
    if (cluster.items && cluster.items.length > 0) {
      return true
    }
  }

  return false
}
