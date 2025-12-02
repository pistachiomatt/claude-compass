import {
  calculateItemLayouts,
  calculateContentBounds,
  calculateClusterPositions,
  calculateInsertPosition,
  moveItem,
  normalizePositions,
  getMaxColumn,
  addItemToColumn,
  DEFAULT_LAYOUT_CONFIG,
} from "@/components/cluster-grid/layout"

const config = DEFAULT_LAYOUT_CONFIG

describe("calculateItemLayouts", () => {
  it("positions items in a single column", () => {
    const items = [
      { id: "a", at: [0, 0] as [number, number], height: 100 },
      { id: "b", at: [0, 1] as [number, number], height: 80 },
    ]

    const layouts = calculateItemLayouts(items, config)

    expect(layouts).toHaveLength(2)

    const layoutA = layouts.find(l => l.id === "a")!
    const layoutB = layouts.find(l => l.id === "b")!

    expect(layoutA.x).toBe(0)
    expect(layoutA.y).toBe(0)
    expect(layoutB.x).toBe(0)
    expect(layoutB.y).toBe(100 + config.itemGap) // stacked below a
  })

  it("positions items across multiple columns", () => {
    const items = [
      { id: "a", at: [0, 0] as [number, number], height: 100 },
      { id: "b", at: [1, 0] as [number, number], height: 100 },
    ]

    const layouts = calculateItemLayouts(items, config)

    const layoutA = layouts.find(l => l.id === "a")!
    const layoutB = layouts.find(l => l.id === "b")!

    expect(layoutA.x).toBe(0)
    expect(layoutB.x).toBe(config.columnWidth + config.itemGap)
  })

  it("excludes item by id", () => {
    const items = [
      { id: "a", at: [0, 0] as [number, number], height: 100 },
      { id: "b", at: [0, 1] as [number, number], height: 100 },
    ]

    const layouts = calculateItemLayouts(items, config, undefined, "a")

    expect(layouts).toHaveLength(1)
    expect(layouts[0].id).toBe("b")
  })

  it("inserts ghost at specified position", () => {
    const items = [
      { id: "a", at: [0, 0] as [number, number], height: 100 },
      { id: "b", at: [0, 1] as [number, number], height: 100 },
    ]

    const layouts = calculateItemLayouts(items, config, [0, 1], undefined, 80)

    const ghost = layouts.find(l => l.id === "__ghost__")
    expect(ghost).toBeDefined()
    expect(ghost!.isGhost).toBe(true)
    expect(ghost!.height).toBe(80)
  })

  it("sorts items by row within column", () => {
    const items = [
      { id: "c", at: [0, 2] as [number, number], height: 50 },
      { id: "a", at: [0, 0] as [number, number], height: 50 },
      { id: "b", at: [0, 1] as [number, number], height: 50 },
    ]

    const layouts = calculateItemLayouts(items, config)

    // Items should be positioned in order by row
    const yPositions = layouts.map(l => ({ id: l.id, y: l.y }))
    yPositions.sort((a, b) => a.y - b.y)

    expect(yPositions[0].id).toBe("a")
    expect(yPositions[1].id).toBe("b")
    expect(yPositions[2].id).toBe("c")
  })
})

describe("calculateContentBounds", () => {
  it("returns zero for empty layouts", () => {
    const bounds = calculateContentBounds([])
    expect(bounds).toEqual({ width: 0, height: 0 })
  })

  it("calculates bounds from layouts", () => {
    const layouts = [
      { id: "a", x: 0, y: 0, width: 180, height: 100, column: 0, row: 0 },
      { id: "b", x: 192, y: 0, width: 180, height: 150, column: 1, row: 0 },
    ]

    const bounds = calculateContentBounds(layouts)

    expect(bounds.width).toBe(192 + 180) // rightmost x + width
    expect(bounds.height).toBe(150) // tallest item
  })
})

describe("calculateClusterPositions", () => {
  it("positions clusters in columns", () => {
    const clusters = {
      A: { at: [0, 0] as [number, number], contentWidth: 200, contentHeight: 300 },
      B: { at: [1, 0] as [number, number], contentWidth: 200, contentHeight: 200 },
    }

    const positions = calculateClusterPositions(clusters, config)

    expect(positions.A.x).toBe(0)
    expect(positions.A.y).toBe(0)
    expect(positions.B.x).toBeGreaterThan(0) // In second column
  })

  it("stacks clusters in same column", () => {
    const clusters = {
      A: { at: [0, 0] as [number, number], contentWidth: 200, contentHeight: 100 },
      B: { at: [0, 1] as [number, number], contentWidth: 200, contentHeight: 100 },
    }

    const positions = calculateClusterPositions(clusters, config)

    expect(positions.A.x).toBe(0)
    expect(positions.B.x).toBe(0) // Same column
    expect(positions.B.y).toBeGreaterThan(positions.A.y) // Below A
  })
})

describe("calculateInsertPosition", () => {
  it("returns [0, 0] for empty layouts", () => {
    const pos = calculateInsertPosition([], 0, 0, config)
    expect(pos).toEqual([0, 0])
  })

  it("finds nearest position", () => {
    const layouts = [
      { id: "a", x: 0, y: 0, width: 180, height: 100, column: 0, row: 0, isGhost: false },
      { id: "b", x: 0, y: 112, width: 180, height: 100, column: 0, row: 1, isGhost: false },
    ]

    // Drag to position near bottom of first item
    const pos = calculateInsertPosition(layouts, 0, 90, config)

    // Should insert at row 1 (after first item)
    expect(pos[0]).toBe(0) // column 0
    expect(pos[1]).toBe(1) // row 1
  })

  it("ignores ghost items in calculations", () => {
    const layouts = [
      { id: "a", x: 0, y: 0, width: 180, height: 100, column: 0, row: 0, isGhost: false },
      { id: "__ghost__", x: 0, y: 112, width: 180, height: 80, column: 0, row: 1, isGhost: true },
    ]

    const pos = calculateInsertPosition(layouts, 0, 0, config)
    // Should calculate based on real items only
    expect(pos).toEqual([0, 0])
  })
})

describe("moveItem", () => {
  it("moves item to new position in same column", () => {
    const items = [
      { id: "a", at: [0, 0] as [number, number] },
      { id: "b", at: [0, 1] as [number, number] },
      { id: "c", at: [0, 2] as [number, number] },
    ]

    // Move 'a' to row 2
    const result = moveItem(items, "a", [0, 2])

    const movedA = result.find(i => i.id === "a")!
    expect(movedA.at).toEqual([0, 2])
  })

  it("returns same array if position unchanged", () => {
    const items = [{ id: "a", at: [0, 0] as [number, number] }]
    const result = moveItem(items, "a", [0, 0])
    expect(result).toBe(items)
  })

  it("returns same array if item not found", () => {
    const items = [{ id: "a", at: [0, 0] as [number, number] }]
    const result = moveItem(items, "nonexistent", [1, 1])
    expect(result).toBe(items)
  })

  it("shifts items in target column", () => {
    const items = [
      { id: "a", at: [0, 0] as [number, number] },
      { id: "b", at: [1, 0] as [number, number] },
      { id: "c", at: [1, 1] as [number, number] },
    ]

    // Move 'a' to column 1, row 0
    const result = moveItem(items, "a", [1, 0])

    const b = result.find(i => i.id === "b")!
    const c = result.find(i => i.id === "c")!

    // b and c should shift down
    expect(b.at[1]).toBe(1)
    expect(c.at[1]).toBe(2)
  })
})

describe("normalizePositions", () => {
  it("makes rows contiguous starting from 0", () => {
    const items = [
      { id: "a", at: [0, 5] as [number, number] },
      { id: "b", at: [0, 10] as [number, number] },
      { id: "c", at: [0, 2] as [number, number] },
    ]

    const result = normalizePositions(items)

    const sorted = [...result].sort((a, b) => a.at[1] - b.at[1])
    expect(sorted[0].at[1]).toBe(0)
    expect(sorted[1].at[1]).toBe(1)
    expect(sorted[2].at[1]).toBe(2)
  })

  it("normalizes each column independently", () => {
    const items = [
      { id: "a", at: [0, 5] as [number, number] },
      { id: "b", at: [1, 10] as [number, number] },
    ]

    const result = normalizePositions(items)

    const a = result.find(i => i.id === "a")!
    const b = result.find(i => i.id === "b")!

    expect(a.at).toEqual([0, 0])
    expect(b.at).toEqual([1, 0])
  })
})

describe("getMaxColumn", () => {
  it("returns 0 for empty array", () => {
    expect(getMaxColumn([])).toBe(0)
  })

  it("returns max column index", () => {
    const items = [
      { at: [0, 0] as [number, number] },
      { at: [2, 0] as [number, number] },
      { at: [1, 0] as [number, number] },
    ]
    expect(getMaxColumn(items)).toBe(2)
  })
})

describe("addItemToColumn", () => {
  it("adds item at end of column", () => {
    const items = [
      { id: "a", at: [0, 0] as [number, number] },
      { id: "b", at: [0, 1] as [number, number] },
    ]

    const result = addItemToColumn(items, { id: "c" }, 0)

    const newItem = result.find(i => i.id === "c")!
    expect(newItem.at).toEqual([0, 2])
  })

  it("adds item at row 0 for empty column", () => {
    const items = [{ id: "a", at: [0, 0] as [number, number] }]

    const result = addItemToColumn(items, { id: "b" }, 1)

    const newItem = result.find(i => i.id === "b")!
    expect(newItem.at).toEqual([1, 0])
  })
})
