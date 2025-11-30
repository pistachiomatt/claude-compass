"use client"

import { useState } from "react"
import { ClusterGrid, type ClusterGridData, addItemToColumn, getMaxColumn } from "@/components/cluster-grid"
import { Plus, Shuffle, Code } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"

// Sample data with 2D positions: at: [column, row]
const SAMPLE_DATA: ClusterGridData = {
  clusters: {
    "User Problems": {
      at: [0, 0],
      items: [
        {
          id: "prob-1",
          heading: "Anxiety about once-a-year trip",
          body: "Users feel pressure because they only take one big vacation per year.",
          at: [0, 0],
        },
        {
          id: "prob-2",
          heading: "Not sure how to assess quality",
          at: [0, 1],
        },
        {
          id: "prob-3",
          heading: "Unclear who is hosting",
          body: "Trust comes from reviews and social proof, but reviews can feel fake.",
          at: [1, 0],
        },
        {
          id: "prob-4",
          heading: "Fear of hidden fees",
          body: "Cleaning fees and service charges erode trust.",
          at: [1, 1],
        },
        {
          id: "prob-5",
          heading: "Photos don't match reality",
          at: [2, 0],
        },
      ],
    },
    Goals: {
      at: [0, 1],
      items: [
        {
          id: "goal-1",
          heading: "Give user tools to feel confident",
          body: "Transparent pricing, verified photos, clear host communication.",
          at: [0, 0],
        },
        {
          id: "goal-2",
          heading: "Reassure not a one-way door",
          body: "Make cancellation policies crystal clear.",
          at: [0, 1],
        },
        {
          id: "goal-3",
          heading: "Surface social proof effectively",
          at: [1, 0],
        },
      ],
    },
    "User Journey": {
      at: [1, 0],
      items: [
        {
          id: "journey-1",
          heading: "Discovery → Search → Browse → Compare → Decide → Book → Travel",
          body: "Each step has unique anxieties. Anxiety peaks at Book stage.",
          at: [0, 0],
        },
      ],
    },
    Insights: {
      at: [1, 1],
      items: [
        {
          id: "insight-1",
          heading: "Price anchoring matters",
          body: "Users compare to hotel prices. If Airbnb feels more expensive, trust drops.",
          at: [0, 0],
        },
        {
          id: "insight-2",
          heading: "Group bookings are complex",
          body: "Decision-maker carries extra pressure and needs more validation.",
          at: [0, 1],
        },
      ],
    },
  },
}

export default function ClusterGridPage() {
  const [data, setData] = useState<ClusterGridData>(SAMPLE_DATA)
  const [selectedCluster, setSelectedCluster] = useState("User Problems")
  const [editableJson, setEditableJson] = useState("")
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const clusterNames = Object.keys(data.clusters)

  // Sync JSON when dialog opens
  const handleDialogOpen = (open: boolean) => {
    if (open) {
      setEditableJson(JSON.stringify(data, null, 2))
      setJsonError(null)
    }
    setIsDialogOpen(open)
  }

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

  // Save edited JSON
  const handleSave = () => {
    try {
      const parsed = JSON.parse(editableJson) as ClusterGridData
      if (!parsed.clusters) {
        setJsonError("Invalid structure: missing 'clusters'")
        return
      }
      setData(parsed)
      setIsDialogOpen(false)
    } catch (e) {
      setJsonError((e as Error).message)
    }
  }

  // Add a new sticky to the selected cluster
  const handleAddSticky = () => {
    setData((prev) => {
      const cluster = prev.clusters[selectedCluster]
      if (!cluster) return prev

      // Find the rightmost column and add to it, or start a new column
      const maxCol = getMaxColumn(cluster.items)
      const itemsInMaxCol = cluster.items.filter((i) => i.at[0] === maxCol)

      // If the last column has 3+ items, start a new column
      const targetCol = itemsInMaxCol.length >= 3 ? maxCol + 1 : maxCol

      const newItem = {
        id: `sticky-${Date.now()}`,
        heading: "New insight just discovered",
        body: "This was added to test the ClusterGrid",
      }

      return {
        ...prev,
        clusters: {
          ...prev.clusters,
          [selectedCluster]: {
            ...cluster,
            items: addItemToColumn(cluster.items, newItem, targetCol),
          },
        },
      }
    })
  }

  // Shuffle all items randomly within each cluster
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
        // Reassign positions in a grid pattern (3 columns)
        items.forEach((item, idx) => {
          const col = idx % 3
          const row = Math.floor(idx / 3)
          item.at = [col, row]
        })
        shuffled[key] = { ...shuffled[key], items }
      })
      return { ...prev, clusters: shuffled }
    })
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Test controls */}
      <div className="border-b px-4 py-2 flex gap-2 items-center bg-background">
        <span className="text-sm text-muted-foreground mr-2">ClusterGrid Test:</span>

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
          onClick={handleShuffle}
          className="px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1.5"
        >
          <Shuffle className="w-3.5 h-3.5" />
          Shuffle all
        </button>

        <div className="flex-1" />

        {/* JSON Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpen}>
          <DialogTrigger asChild>
            <button className="px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5" />
              Edit data
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Edit ClusterGrid data</DialogTitle>
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
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Save changes
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Feature status */}
      <div className="border-b px-4 py-2 text-xs text-muted-foreground flex gap-4">
        <span>Features:</span>
        <span className="text-green-600">✓ 2D grid layout [col, row]</span>
        <span className="text-green-600">✓ Items shift to show drop position</span>
        <span className="text-green-600">✓ Cross-cluster drag with color change</span>
        <span className="text-green-600">✓ Insert at position on drop</span>
      </div>

      {/* ClusterGrid */}
      <div className="flex-1 min-h-0 p-8 overflow-auto">
        <ClusterGrid data={data} onDataChange={setData} />
      </div>
    </div>
  )
}
