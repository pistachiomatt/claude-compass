# ClusterGrid: A React-First Layout Library

## Current Status

**Working:**
- 2D positions `at: [col, row]` for items within clusters
- Items shift to show drop position (ghost placeholder)
- Cross-cluster drag with color change
- Proper insert-at-position on drop
- Items fade in after measurement (no overlap flash)
- Clusters report measured bounds to parent
- Optimistic dropzone positioning
- Masonry layout for clusters (columns stack independently)
- 10% overlap threshold for insert position
- Framer Motion animations (hover tilt, rubber-band drag, scale-in for new cards)

**Completed:**
- [x] Clusters use masonry layout
- [x] Better insert threshold (10% of target card height)
- [x] Graceful animations with Framer Motion

---

## Architecture

### Data Model

```typescript
interface ClusterGridData {
  clusters: {
    [name: string]: {
      at: [number, number]  // Cluster's grid position [col, row]
      items: ClusterItem[]
    }
  }
}

interface ClusterItem {
  id: string
  heading: string
  body?: string
  at: [number, number]  // Item's position within cluster [column, row]
}
```

### Key Files

- `components/cluster-grid/types.ts` - Type definitions
- `components/cluster-grid/layout.ts` - Pure layout calculation functions
- `components/cluster-grid/ClusterGrid.tsx` - Main React component
- `app/chats/[id]/cluster-grid/page.tsx` - Test page

### Layout Algorithm

**Items within clusters:** Column-based stacking. Items in each column stack vertically by row order. When dragging, pass `ghostAt` to show placeholder and shift items.

**Clusters:** Column-based masonry. Each column stacks clusters independently - no row alignment.

```typescript
function calculateClusterPositions(...) {
  // Group clusters by column, sort by row within each column
  // X = sum of widths of columns before this one
  // Y = sum of heights of clusters ABOVE in same column
}
```

### Measurement Flow

1. Cluster renders items with `opacity: 0`
2. Items are measured via ResizeObserver
3. `isReady` becomes true, items fade in
4. Cluster reports bounds via `onBoundsChange` callback
5. Parent uses measured bounds for cluster positioning

### Drag System

1. `onPointerDown` captures item, creates DragState
2. `onPointerMove` (window) updates position, calculates insert position
3. Ghost shown at insert position, items shift via CSS transitions
4. `onPointerUp` commits move via `moveItem()` or cross-cluster transfer
5. Dragged item rendered at root level for proper z-index

### Insert Position Calculation

Uses Packery-style nearest-neighbor algorithm:
1. Build list of valid insert targets (row 0 of each column + after each item)
2. Calculate Euclidean distance from drag position to each target
3. Snap to the nearest target

```typescript
// Build targets: top of columns + after each item
for (const item of colItems) {
  targets.push({ col, row: item.row + 1, x: item.x, y: item.y + item.height })
}
// Find nearest using distance
const distance = Math.sqrt(dx * dx + dy * dy)
```

This is simpler and more intuitive than threshold-based logic.

---

## Lessons Learned

1. **Container width bug**: Initially calculated `containerWidth = items.length * columnWidth` which made every item its own column (horizontal row). Fixed by using explicit column count.

2. **Position model**: Design doc originally said single integer position, but user wanted 2D `[col, row]`. Items have explicit grid positions like Trello/Kanban.

3. **Measurement timing**: Items overlap on load because initial render uses `minItemHeight`. Fixed by hiding items until measured (`isReady` state with opacity transition).

4. **Cluster positioning**: Clusters need to report measured heights back to parent. Can't calculate cluster sizes using `minItemHeight` - must use actual measured bounds.

5. **Ghost height**: Ghost placeholder must match dragged item's height, not `minItemHeight`.

6. **Insert position - use nearest neighbor**: Packery's approach is simpler than threshold logic. Pre-calculate valid drop targets, then snap to the nearest one using Euclidean distance. No complex threshold math needed.

7. **Masonry for clusters**: Clusters should stack in columns independently, not align by rows. Same principle as items within clusters.

8. **Use measured heights during drag**: When calculating insert position during drag, must use actual measured item heights (not `minItemHeight`). Track heights via `onItemHeightsChange` callback from each cluster.

9. **Framer Motion springs**: Use high stiffness (400+) with good damping (35+) for snappy but not bouncy feel. Rubber-band drag uses `useSpring` with the target position updating each frame - the spring naturally lags behind creating the elastic effect.

10. **ResizeObserver per-item registration**: Set up observer once on mount, then register/unregister each item via ref callback. Don't try to observe all refs in an effect - refs aren't populated yet when effect runs.

11. **Content area ref for drag positioning**: When calculating drag position for insert detection, use a ref to the actual content container (where items are positioned), not the outer wrapper. Originally hardcoded a -40px offset for the heading, but this was inaccurate. Packery subtracts `size.paddingLeft/Top` from element position - we achieve the same by measuring relative to the content container directly. The content container is the coordinate space where items have their x/y positions.

12. **Packery's exact algorithm**: For insert position, use Packery's approach exactly:
    - Add targets at y=0 for each column (top of column)
    - For each item: add target at item.y (top) AND item.y + item.height (bottom, NO gap)
    - Deduplicate targets by x,y string key
    - Find nearest target using Euclidean distance from dragged element's top-left position

---

## Next Steps

1. ~~**Fix cluster masonry**: Change `calculateClusterPositions` to stack clusters in each column independently, not by row alignment.~~ ✓ Done

2. **Test edge cases**: Single item clusters, empty clusters, many columns.

3. ~~**Consider animations**: Spring physics for drag release, FLIP for complex reorders.~~ ✓ Done - Using Framer Motion

## Animation System

Uses Framer Motion with gentle, graceful springs:

```typescript
const SPRING_CONFIG = {
  layout: { stiffness: 400, damping: 35 },  // Card reordering
  ghost: { stiffness: 300, damping: 30 },   // Ghost placeholder
  enter: { stiffness: 350, damping: 25 },   // New cards
}
```

**Effects:**
- **Hover**: Subtle 1.5° rotation, elevated shadow
- **Drag**: Rubber-band physics via useSpring, velocity-based rotation (±8°)
- **New cards**: Scale in from 0.8 with AnimatePresence
- **Reorder**: Smooth spring transitions on x/y
- **Ghost**: Fades and scales in/out
