import { deepmerge as createDeepMerge, Options } from '@fastify/deepmerge'

/**
 * Prunes any keys with undefined values from the given value, recursively.
 */
function pruneUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(pruneUndefined) as unknown as T
  }
  if (typeof value === 'object' && value !== null) {
    const newObj: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      if (val !== undefined) {
        newObj[key] = pruneUndefined(val)
      }
    }
    return newObj as T
  }
  return value
}

export function createDeepMergeById(options: Partial<Options> = {}, byProp?: string) {
  // Merge arrays by matching objects' id, _id, or custom property
  const mergeArrayById = (mergeOpts: Parameters<NonNullable<Options['mergeArray']>>[0]) => {
    const { deepmerge, clone } = mergeOpts

    const getId = (item: any) => {
      if (item && typeof item === 'object') {
        if (byProp) return item[byProp]
        return item.id ?? item._id
      }
      return undefined
    }

    return function mergeArray(target: unknown[], source: unknown[]) {
      if (!Array.isArray(target) || !Array.isArray(source)) {
        return clone(source)
      }

      const hasIds = source.some(getId) || target.some(getId)
      if (!hasIds) {
        return [...target, ...source]
      }

      // Create a Map of source items by ID
      const sourceMap = new Map(
        source
          .map(item => {
            const id = getId(item)
            return id !== undefined ? ([id, item] as const) : null
          })
          .filter((entry): entry is [string | number, unknown] => entry !== null),
      )

      const result: unknown[] = []
      const processedIds = new Set()

      // Process the target array, maintaining its order
      target.forEach(targetItem => {
        const id = getId(targetItem)
        if (id !== undefined && sourceMap.has(id)) {
          const sourceItem = sourceMap.get(id)!
          const mergedItem = deepmerge(targetItem, sourceItem)
          result.push(mergedItem)
          processedIds.add(id)
          sourceMap.delete(id)
        } else {
          result.push(clone(targetItem))
          if (id !== undefined) {
            processedIds.add(id)
          }
        }
      })

      // Add any remaining items from source (new items), maintaining their order
      source.forEach(sourceItem => {
        const id = getId(sourceItem)
        if (id === undefined || !processedIds.has(id)) {
          result.push(clone(sourceItem))
        }
      })

      return result
    }
  }

  // Create base deep merge with custom array handling
  const baseDeepMerge = createDeepMerge({
    mergeArray: mergeArrayById,
    ...options, // Note: there's no mergeObject in @fastify/deepmerge
  })

  /**
   * Wraps merging in a function that prunes undefined values first,
   * so they won't overwrite existing keys in the target.
   */
  return function deepMergeByIdSkippingUndefined<T>(target: T, source: any): T {
    const prunedSource = pruneUndefined(source)
    return baseDeepMerge(target, prunedSource) as T
  }
}

/**
 * Creates a deep merge function configured to:
 *  - Merge arrays with object items by id, _id, or a custom property
 *  - Prune undefined values from the source so they never overwrite the target
 *
 * @param target - The target object to merge into
 * @param source - The source object to merge from
 * @param options - Optional configuration object
 * @param options.byProp - The custom property to merge arrays by, if not id or _id
 * @returns The merged object
 */
export const deepMerge = <T>(target: T, source: any, options?: { byProp?: string }): T => {
  const customDeepMerge = createDeepMergeById({}, options?.byProp)
  return customDeepMerge(target, source)
}
