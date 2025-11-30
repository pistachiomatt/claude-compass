# Whiteboard Component Design

## Overview

A Figjam-style whiteboard that renders data as draggable sticky notes organized in clusters. Uses **Packery** for bin-packing layout within clusters and **Draggabilly** for drag support.

## Current Location

- `@/components/whiteboard/` - Modular components
- `app/chats/[id]/whiteboard/page.tsx` - Test page with controls

---

## Packery Deep Dive

### Architecture

Packery is built on top of **Outlayer**, which provides:
- Item management (`items` array of Outlayer.Item instances)
- Layout logic (`layout()`, `layoutItems()`)
- Event system (`on()`, `off()`, `once()`, `emitEvent()`)
- Add/remove methods (`appended()`, `prepended()`, `remove()`)

Packery extends Outlayer with:
- Bin-packing algorithm via `Packer` class
- Drag support via `bindDraggabillyEvents()`
- Shift targets for drop positioning

### Key Files in Packery Source

```
packery/
  js/packery.js    - Main class, extends Outlayer
  js/packer.js     - Bin-packing algorithm
  js/rect.js       - Rectangle math utilities
  js/item.js       - Extends Outlayer.Item with placing/drop logic

outlayer/
  outlayer.js      - Base layout class
  item.js          - Base item class
```

### Critical Methods

#### From Outlayer (inherited by Packery)

| Method | Description | When to Use |
|--------|-------------|-------------|
| `layout()` | Re-layout all items | After container resize, width change |
| `appended(elems)` | Add items, layout only new ones, reveal | Adding new items WITHOUT re-init |
| `prepended(elems)` | Add items at start, re-layout all | Adding items to beginning |
| `remove(elems)` | Remove items from collection and DOM | Deleting items |
| `getItemElements()` | Get elements in current order | After drag to get new order |
| `getItem(elem)` | Get Outlayer.Item for element | Need item instance |
| `reloadItems()` | Re-scan container children | AVOID - prefer appended() |
| `destroy()` | Clean up instance | Component unmount |

#### Packery-Specific

| Method | Description | When to Use |
|--------|-------------|-------------|
| `bindDraggabillyEvents(draggie)` | Connect Draggabilly to Packery | After creating Draggabilly instance |
| `unbindDraggabillyEvents(draggie)` | Disconnect Draggabilly | Before destroying Draggabilly |
| `fit(elem, x, y)` | Position item at coords, layout others | Manual positioning |
| `shiftLayout()` | Layout with column/row packing | During drag operations |
| `sortItemsByPosition()` | Sort items by visual position | Called automatically after drag |

### Critical Events

| Event | Payload | When Fired |
|-------|---------|------------|
| `'layoutComplete'` | `(items)` | After any layout finishes |
| `'dragItemPositioned'` | `(event, item)` | After drag ends, item settled |
| `'fitComplete'` | `(item)` | After fit() completes |
| `'remove'` | `(items)` | After items removed |
| `'reveal'` | `(items)` | After items revealed |

### Critical Properties

| Property | Type | Description |
|----------|------|-------------|
| `pckry.items` | Array | Outlayer.Item instances |
| `pckry.maxY` | Number | Content height after layout |
| `pckry.maxX` | Number | Content width (horizontal mode) |
| `pckry.size` | Object | Container dimensions |
| `pckry.packer` | Packer | Bin-packing instance |
| `item.rect` | Rect | Item's position/size rectangle |
| `item.element` | Element | DOM element |

---

## React + Packery Integration

### The Core Problem

React wants to own the DOM. Packery wants to own the DOM. They conflict.

**React's model:**
1. State changes → re-render → new DOM elements
2. Virtual DOM diffing decides what to update

**Packery's model:**
1. Initialize with existing DOM elements
2. Manage positions via transforms
3. `appended()` to add new items

### The Solution: Track Known Items

```typescript
const knownItemIdsRef = useRef<Set<string>>(new Set())

useEffect(() => {
  const currentIds = new Set(items.map(i => i.id))
  const knownIds = knownItemIdsRef.current

  // New items
  const newIds = [...currentIds].filter(id => !knownIds.has(id))

  // Removed items
  const removedIds = [...knownIds].filter(id => !currentIds.has(id))

  // Handle removed
  removedIds.forEach(id => {
    const elem = container.querySelector(`[data-item-id="${id}"]`)
    pckry.remove(elem)
    knownIds.delete(id)
  })

  // Handle new (wait for React to render)
  if (newIds.length > 0) {
    requestAnimationFrame(() => {
      const newElems = newIds.map(id =>
        container.querySelector(`[data-item-id="${id}"]`)
      )
      pckry.appended(newElems)
      newIds.forEach(id => knownIds.add(id))
    })
  }
}, [items])
```

### Why requestAnimationFrame?

React's `useEffect` runs after DOM mutation but before paint. The new elements exist but may not be measurable. `requestAnimationFrame` ensures:
1. React has committed DOM changes
2. Browser has calculated styles
3. Elements are ready for Packery to measure

### Draggabilly Per-Item Tracking

Use a Map to track Draggabilly instances by item ID:

```typescript
const draggiesRef = useRef<Map<string, Draggabilly>>(new Map())

// On add
const draggie = new Draggabilly(elem)
pckry.bindDraggabillyEvents(draggie)
draggiesRef.current.set(itemId, draggie)

// On remove
const draggie = draggiesRef.current.get(itemId)
pckry.unbindDraggabillyEvents(draggie)
draggie.destroy()
draggiesRef.current.delete(itemId)
```

---

## Container Width Calculation

Packery reads `container.offsetWidth` during `layout()`. If width is 0 or too small, items stack vertically.

### Dynamic Width from Data

```typescript
function getClusterWidth(items: Item[]): number {
  if (items.length === 0) {
    return STICKY_WIDTH + GAP  // Minimum 1 column
  }
  const maxCol = Math.max(...items.map(i => i.at[0]))
  const numCols = maxCol + 1
  return numCols * (STICKY_WIDTH + GAP)
}
```

### Why This Works

- Items have `at: [col, row]` positions from data
- We find the rightmost column index
- Width accommodates that many columns
- Packery then bin-packs within that width

---

## Cluster Vertical Stacking

### The Problem

Clusters overlap when using fixed grid positions because Packery content heights vary.

### The Solution: Measure After Layout

```typescript
const [clusterHeights, setClusterHeights] = useState<Record<string, number>>({})

// In Cluster component
pckry.on('layoutComplete', () => {
  const height = pckry.maxY || containerRef.current.offsetHeight
  onHeightChange(height)
})

// In parent
const getClusterY = (clusterName: string, cluster: Cluster) => {
  const clustersAbove = allClusters
    .filter(c => c.at[0] === cluster.at[0] && c.at[1] < cluster.at[1])
    .sort((a, b) => a.at[1] - b.at[1])

  return clustersAbove.reduce((y, [name]) => {
    return y + (clusterHeights[name] || 200) + GAP
  }, 0)
}
```

---

## Mapping `at[]` Positions to Packery Layout

### The Problem

Items have `at: [col, row]` positions in the data, but Packery completely ignores these values. Packery bin-packs items in whatever order its internal `items` array has them.

**What DOESN'T work:**
- Setting CSS left/top on items (Packery overwrites them)
- Using `fit(elem, x, y)` for initial positioning (clobbers bin-packing)
- Hoping DOM order matters (Packery maintains its own order)

### The Solution: Control Packery's Internal Order

1. **Sort items by `at[]` before rendering** (row-major: row first, then column)
2. **Reorder Packery's internal `items` array** to match sorted DOM order
3. **Call `layout()`** to apply the new order

```typescript
// Sort items by at[] position: row-major order (row first, then column)
function sortItemsByPosition(items: WhiteboardItem[]): WhiteboardItem[] {
  return [...items].sort((a, b) => {
    // Sort by row first, then by column
    if (a.at[1] !== b.at[1]) return a.at[1] - b.at[1]
    return a.at[0] - b.at[0]
  })
}

// In Cluster component:
const sortedItems = useMemo(() => sortItemsByPosition(cluster.items), [cluster.items])

// Render in sorted order so DOM order matches desired layout order
{sortedItems.map((item) => (
  <div key={item.id} data-item-id={item.id} className="wb-item">...</div>
))}

// After data changes, reorder Packery's internal items array
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
```

### Why This Works

1. React renders items in sorted order → DOM order matches desired layout
2. We manually reorder `pckry.items` to match DOM order
3. Packery's `layout()` uses its `items` array order for bin-packing
4. Items appear in row-major order based on their `at[]` values

### Critical Insight

**Packery's `items` array is the source of truth for layout order.** It's an array of `Outlayer.Item` instances. When you call `layout()`, Packery iterates through this array and places items one by one using bin-packing. The first item goes top-left, then the next fits in, etc.

By controlling the order of `pckry.items`, you control which items get placed first and thus their visual position.

---

## Common Pitfalls

### 1. Re-initializing Packery on Every Change

**Wrong:**
```typescript
useEffect(() => {
  pckry = new Packery(container, options)
}, [items])  // Re-creates on every change
```

**Right:**
```typescript
useEffect(() => {
  pckry = new Packery(container, options)
}, [])  // Only on mount

useEffect(() => {
  // Sync items via appended/remove
}, [items])
```

### 2. Not Waiting for React Render

**Wrong:**
```typescript
// New items in state
setItems([...items, newItem])
// Immediately try to use Packery
pckry.appended(elem)  // Element doesn't exist yet!
```

**Right:**
```typescript
setItems([...items, newItem])
// In useEffect after items change:
requestAnimationFrame(() => {
  pckry.appended(elem)
})
```

### 3. Forgetting Draggabilly Cleanup

**Wrong:**
```typescript
pckry.remove(elem)
// Forgot to destroy Draggabilly - memory leak!
```

**Right:**
```typescript
const draggie = draggiesRef.current.get(itemId)
pckry.unbindDraggabillyEvents(draggie)
draggie.destroy()
draggiesRef.current.delete(itemId)
pckry.remove(elem)
```

### 4. Not Setting Container Width

**Wrong:**
```typescript
<div ref={containerRef}>  {/* No width = 0 or auto */}
```

**Right:**
```typescript
<div ref={containerRef} style={{ width: calculatedWidth }}>
```

### 5. Using reloadItems() Instead of appended()

`reloadItems()` re-scans all children. This:
- Loses existing Draggabilly bindings
- Resets all positions
- Is slow for large lists

Use `appended()` for new items instead.

### 6. Expecting `at[]` Positions to Automatically Control Layout

**Wrong:**
```typescript
// Hoping Packery will respect item positions
{items.map((item) => (
  <div style={{ gridColumn: item.at[0], gridRow: item.at[1] }}>
```

**Right:**
```typescript
// Sort items by at[], reorder pckry.items, then layout()
const sortedItems = useMemo(() => sortItemsByPosition(items), [items])
{sortedItems.map((item) => ...)}

// After render, reorder Packery's internal array to match
packeryRef.current.items = domElements.map(el => pckry.getItem(el)).filter(Boolean)
packeryRef.current.layout()
```

Packery doesn't read `at[]` or any data attributes. It packs items in the order of its internal `items` array. You must control that array.

---

## Edge Cases

### Empty Cluster

- Width should be at least 1 column
- `Math.max(...[].map(...))` returns `-Infinity`
- Handle: `items.length === 0` check

### Rapid Adds

- Multiple items added before `requestAnimationFrame` fires
- Handle: Batch new item IDs, process all in one frame

### Item with Long Content

- Sticky note grows in height
- Packery measures actual size during layout
- Clusters below may need to reposition
- Handle: Re-layout on content change

### Drag During Add

- User drags while new item is being added
- Packery handles this via `dragItemCount` tracking
- Uses `shiftLayout()` during drag operations

---

## Data Model

```typescript
interface WhiteboardData {
  stage: "DISCOVER" | "DEFINE" | "DEVELOP" | "DELIVER"
  clusters: Record<string, {
    at: [number, number]  // Cluster position (column, row)
    items: {
      id: string
      heading: string
      body?: string
      at: [number, number]  // Position within cluster grid
    }[]
  }>
  floating?: { id: string; content: string; at: [number, number] }[]
  connections?: { from: string; to: string }[]
  hmw?: string[]
  open_questions?: string[]
}
```

**Data is source of truth.** The `onDataChange` callback is called when:
- User drags items to reorder
- External state changes trigger sync

---

## Files

| File | Purpose |
|------|---------|
| `Whiteboard.tsx` | Main component with pan/zoom, Cluster sub-component |
| `PeekingDrawer.tsx` | Bottom drawer for HMW/questions |
| `types.ts` | TypeScript interfaces, colors, grid config |
| `sampleData.ts` | Test data |
| `StickyNote.tsx` | Unused (inline in Cluster) |

---

## Test Page Features

- **Cluster selector** - Choose which cluster to add to
- **Add sticky** - Add basic sticky to selected cluster
- **Add large text** - Add sticky with long content
- **Shuffle all** - Randomize order in all clusters
- **View data** - Dialog showing current JSON state

---

## Future Improvements

1. **Inline editing** - Click to edit sticky heading/body
2. **Cross-cluster drag** - Drag items between clusters
3. **Connection lines** - SVG lines between connected items
4. **Undo/redo** - Track changes for undo support
5. **Real-time sync** - WebSocket updates for collaboration
6. **Floating items draggable** - Add Draggabilly to floating notes
7. **Delete items** - Remove stickies with confirmation
8. **Keyboard navigation** - Arrow keys to move between stickies
