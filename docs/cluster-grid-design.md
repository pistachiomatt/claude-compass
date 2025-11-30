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

**TODO:**
- [x] **Clusters should use masonry layout** - Fixed! Each column now stacks independently.
- [x] **Better insert threshold** - Now uses 10% overlap of dragged card's bottom edge, not pointer position.

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

Uses 10% of target card height as threshold:
- When dragged card's bottom is 10% into a target card, that card shifts down
- Checks from bottom-up to find the furthest card we're 10% into
- That card shifts, we insert at its row

```typescript
const threshold = targetCard.height * 0.1
// If dragBottom > cardTop + threshold, that card shifts
```

---

## Lessons Learned

1. **Container width bug**: Initially calculated `containerWidth = items.length * columnWidth` which made every item its own column (horizontal row). Fixed by using explicit column count.

2. **Position model**: Design doc originally said single integer position, but user wanted 2D `[col, row]`. Items have explicit grid positions like Trello/Kanban.

3. **Measurement timing**: Items overlap on load because initial render uses `minItemHeight`. Fixed by hiding items until measured (`isReady` state with opacity transition).

4. **Cluster positioning**: Clusters need to report measured heights back to parent. Can't calculate cluster sizes using `minItemHeight` - must use actual measured bounds.

5. **Ghost height**: Ghost placeholder must match dragged item's height, not `minItemHeight`.

6. **Insert threshold**: Uses dragged card's bottom edge, not pointer. When 10% of the dragged card overlaps with a card below, that card shifts. This feels more natural than midpoint-based thresholds.

7. **Masonry for clusters**: Clusters should stack in columns independently, not align by rows. Same principle as items within clusters.

---

## Next Steps

1. ~~**Fix cluster masonry**: Change `calculateClusterPositions` to stack clusters in each column independently, not by row alignment.~~ ✓ Done

2. **Test edge cases**: Single item clusters, empty clusters, many columns.

3. **Consider animations**: Spring physics for drag release, FLIP for complex reorders.
