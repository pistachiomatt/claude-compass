"use client"

import { useState, useEffect } from "react"
import { Whiteboard } from "@/components/whiteboard/Whiteboard"
import { SAMPLE_WHITEBOARD } from "@/components/whiteboard/sampleData"
import type { WhiteboardData } from "@/components/whiteboard/types"
import { Plus, Shuffle, Type, Code } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"

export default function WhiteboardPage() {
  const [data, setData] = useState<WhiteboardData>(SAMPLE_WHITEBOARD)
  const [selectedCluster, setSelectedCluster] = useState<string>("User Problems")

  // For the editable dialog
  const [editableJson, setEditableJson] = useState("")
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const clusterNames = Object.keys(data.clusters)

  // Sync editableJson when dialog opens or data changes externally
  useEffect(() => {
    if (isDialogOpen) {
      setEditableJson(JSON.stringify(data, null, 2))
      setJsonError(null)
    }
  }, [isDialogOpen, data])

  // Validate JSON as user types
  const handleJsonChange = (value: string) => {
    setEditableJson(value)
    try {
      JSON.parse(value)
      setJsonError(null)
    } catch (e) {
      setJsonError((e as Error).message)
    }
  }

  // Save the edited JSON
  const handleSave = () => {
    try {
      const parsed = JSON.parse(editableJson) as WhiteboardData
      // Basic validation
      if (!parsed.stage || !parsed.clusters) {
        setJsonError("Invalid structure: missing 'stage' or 'clusters'")
        return
      }
      setData(parsed)
      setIsDialogOpen(false)
    } catch (e) {
      setJsonError((e as Error).message)
    }
  }

  // Add a new sticky to selected cluster
  const handleAddSticky = () => {
    setData((prev) => {
      const cluster = prev.clusters[selectedCluster]
      if (!cluster) return prev

      // Find the next available column position
      const maxCol = cluster.items.length > 0
        ? Math.max(...cluster.items.map(i => i.at[0]))
        : -1

      const newItem = {
        id: `sticky-${Date.now()}`,
        heading: "New insight just discovered",
        body: "This was added to test entrance animations",
        at: [maxCol + 1, 0] as [number, number],
      }
      return {
        ...prev,
        clusters: {
          ...prev.clusters,
          [selectedCluster]: {
            ...cluster,
            items: [...cluster.items, newItem],
          },
        },
      }
    })
  }

  // Shuffle stickies within each cluster
  const handleShuffle = () => {
    setData((prev) => {
      const shuffled = { ...prev.clusters }
      Object.keys(shuffled).forEach((key) => {
        const items = [...shuffled[key].items]
        // Fisher-Yates shuffle
        for (let i = items.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[items[i], items[j]] = [items[j], items[i]]
        }
        // Reassign positions in a row
        items.forEach((item, idx) => {
          item.at = [idx, 0]
        })
        shuffled[key] = { ...shuffled[key], items }
      })
      return { ...prev, clusters: shuffled }
    })
  }

  // Add sticky with large text blob to selected cluster
  const handleAddLargeText = () => {
    const largeText = `This is a comprehensive user research finding that spans multiple paragraphs and tests the auto-sizing behavior of sticky notes.

Key observations:
• Users frequently abandon checkout when shipping costs are revealed late
• Mobile users struggle with small touch targets on product pages
• The search function returns too many irrelevant results

We need to address these issues in the next sprint. The PM has prioritized the checkout flow improvements as P0.`

    setData((prev) => {
      const cluster = prev.clusters[selectedCluster]
      if (!cluster) return prev

      const maxCol = cluster.items.length > 0
        ? Math.max(...cluster.items.map(i => i.at[0]))
        : -1

      const newItem = {
        id: `large-${Date.now()}`,
        heading: "Comprehensive research findings",
        body: largeText,
        at: [maxCol + 1, 0] as [number, number],
      }
      return {
        ...prev,
        clusters: {
          ...prev.clusters,
          [selectedCluster]: {
            ...cluster,
            items: [...cluster.items, newItem],
          },
        },
      }
    })
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Test controls */}
      <div className="border-b px-4 py-2 flex gap-2 items-center bg-background">
        <span className="text-sm text-muted-foreground mr-2">Test:</span>

        {/* Cluster selector */}
        <select
          value={selectedCluster}
          onChange={(e) => setSelectedCluster(e.target.value)}
          className="px-2 py-1.5 text-sm rounded-md border bg-background"
        >
          {clusterNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <button
          onClick={handleAddSticky}
          className="px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add sticky
        </button>
        <button
          onClick={handleAddLargeText}
          className="px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1.5"
        >
          <Type className="w-3.5 h-3.5" />
          Add large text
        </button>
        <button
          onClick={handleShuffle}
          className="px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1.5"
        >
          <Shuffle className="w-3.5 h-3.5" />
          Shuffle all
        </button>

        <div className="flex-1" />

        {/* Editable JSON Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <button className="px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5" />
              Edit data
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Edit whiteboard data</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <textarea
                value={editableJson}
                onChange={(e) => handleJsonChange(e.target.value)}
                className="flex-1 min-h-[400px] text-xs font-mono bg-muted p-4 rounded-md border resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                spellCheck={false}
              />
              {jsonError && (
                <p className="text-xs text-destructive mt-2 font-mono">
                  Error: {jsonError}
                </p>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <DialogClose asChild>
                <button className="px-4 py-2 text-sm rounded-md border hover:bg-accent">
                  Cancel
                </button>
              </DialogClose>
              <button
                onClick={handleSave}
                disabled={!!jsonError}
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save changes
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Whiteboard */}
      <div className="flex-1 min-h-0">
        <Whiteboard data={data} onDataChange={setData} />
      </div>
    </div>
  )
}
