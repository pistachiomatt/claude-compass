import { sql, type SQL } from "drizzle-orm"
import { type AnyColumn } from "drizzle-orm"

/**
 * Helper to add an element to a JSONB array column if it doesn't already exist
 * Uses PostgreSQL's JSONB operators for atomic operations
 */
export function jsonbArrayAdd<T>(column: AnyColumn, element: T): SQL {
  return sql`
    CASE
      WHEN ${column} @> ${JSON.stringify([element])}::jsonb
      THEN ${column}
      ELSE ${column} || ${JSON.stringify([element])}::jsonb
    END
  `
}

/**
 * Helper to remove an element from a JSONB array column
 * Uses PostgreSQL's JSONB array filtering
 */
export function jsonbArrayRemove<T>(column: AnyColumn, element: T): SQL {
  return sql`
    (
      SELECT jsonb_agg(item)
      FROM jsonb_array_elements(${column}) AS item
      WHERE item != ${JSON.stringify(element)}::jsonb
    )
  `
}

/**
 * Helper to append an element to a JSONB array (always adds, even if duplicate)
 */
export function jsonbArrayAppend<T>(column: AnyColumn, element: T): SQL {
  return sql`COALESCE(${column}, '[]'::jsonb) || ${JSON.stringify([element])}::jsonb`
}

/**
 * Helper to append multiple elements to a JSONB array at once
 */
export function jsonbArrayAppendMany<T>(column: AnyColumn, elements: T[]): SQL {
  if (elements.length === 0) {
    return sql`COALESCE(${column}, '[]'::jsonb)`
  }
  return sql`COALESCE(${column}, '[]'::jsonb) || ${JSON.stringify(elements)}::jsonb`
}

/**
 * Helper to prepend an element to a JSONB array
 */
export function jsonbArrayPrepend<T>(column: AnyColumn, element: T): SQL {
  return sql`${JSON.stringify([element])}::jsonb || COALESCE(${column}, '[]'::jsonb)`
}

/**
 * Helper to check if a JSONB array contains an element
 */
export function jsonbArrayContains<T>(column: AnyColumn, element: T): SQL {
  return sql`${column} @> ${JSON.stringify([element])}::jsonb`
}

/**
 * Helper to update or add an element in a JSONB array based on a key match
 * If an element with the matching key exists, it's replaced; otherwise, the new element is appended
 * @param column The JSONB array column
 * @param element The element to update or add
 * @param keyField The field name to match on (e.g., 'reminderId', 'id')
 * @param keyValue The value to match against
 */
export function jsonbArrayUpsert<T extends Record<string, any>>(
  column: AnyColumn,
  element: T,
  keyField: string,
  keyValue: any,
): SQL {
  return sql`
    CASE
      WHEN EXISTS (
        SELECT 1 FROM jsonb_array_elements(${column}) AS item
        WHERE item->>${keyField} = ${keyValue}
      )
      THEN (
        SELECT jsonb_agg(
          CASE
            WHEN item->>${keyField} = ${keyValue}
            THEN ${JSON.stringify(element)}::jsonb
            ELSE item
          END
        )
        FROM jsonb_array_elements(${column}) AS item
      )
      ELSE ${column} || ${JSON.stringify([element])}::jsonb
    END
  `
}

/**
 * Helper to remove elements from a JSONB array based on a key match
 * @param column The JSONB array column
 * @param keyField The field name to match on
 * @param keyValue The value to match against
 */
export function jsonbArrayRemoveByKey(column: AnyColumn, keyField: string, keyValue: any): SQL {
  return sql`
    (
      SELECT jsonb_agg(item)
      FROM jsonb_array_elements(${column}) AS item
      WHERE item->>${keyField} != ${keyValue}
    )
  `
}

/**
 * Helper to merge a partial object into a JSONB object column
 * Uses PostgreSQL's JSONB || operator for atomic merging
 * @param column The JSONB object column
 * @param partialObject The partial object to merge in
 */
export function jsonbObjectMerge<T extends Record<string, any>>(
  column: AnyColumn,
  partialObject: Partial<T>,
): SQL {
  return sql`${column} || ${JSON.stringify(partialObject)}::jsonb`
}

/**
 * Format database query parameters for readable logging
 * Attempts to map parameters to their corresponding field names from the SQL query
 */
export function formatDbParams(query: string, params: unknown[]): string {
  if (!params || params.length === 0) {
    return "(no params)"
  }

  const fieldMappings = extractFieldMappings(query)

  return params
    .map((param, index) => {
      const paramIndex = index + 1
      const fieldName = fieldMappings[paramIndex] || `$${paramIndex}`

      const formattedValue =
        typeof param === "string"
          ? param
          : typeof param === "object" && param !== null
            ? JSON.stringify(param)
            : String(param)

      return `${fieldName}: ${formattedValue}`
    })
    .join(", ")
}

/**
 * Extract field mappings from SQL query to map parameter positions to field names
 */
function extractFieldMappings(query: string): Record<number, string> {
  const mappings: Record<number, string> = {}
  const cleanQuery = query.replace(/"/g, "").toLowerCase()

  // Handle INSERT statements: INSERT INTO table (field1, field2) VALUES ($1, $2, default, $3)
  const insertMatch = cleanQuery.match(/insert\s+into\s+\w+\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/)
  if (insertMatch) {
    const fields = insertMatch[1].split(",").map(f => f.trim())
    const values = insertMatch[2].split(",").map(v => v.trim())

    // Map parameters to their corresponding field names, skipping 'default' values
    let paramIndex = 1
    values.forEach((value, index) => {
      if (value.startsWith("$")) {
        const currentParamNum = parseInt(value.substring(1))
        if (currentParamNum === paramIndex && index < fields.length) {
          mappings[paramIndex] = fields[index]
          paramIndex++
        }
      }
    })

    return mappings
  }

  // Handle UPDATE statements: UPDATE table SET field1 = $1, field2 = $2 WHERE field3 = $3
  const updateMatch = cleanQuery.match(/update\s+\w+\s+set\s+(.+?)(?:\s+where\s+(.+))?$/)
  if (updateMatch) {
    let paramIndex = 1

    // Parse SET clause
    const setClause = updateMatch[1]
    const setAssignments = setClause.split(",")

    setAssignments.forEach(assignment => {
      const fieldMatch = assignment.trim().match(/^(\w+)\s*=\s*\$\d+/)
      if (fieldMatch) {
        mappings[paramIndex] = fieldMatch[1]
        paramIndex++
      }
    })

    // Parse WHERE clause if present
    const whereClause = updateMatch[2]
    if (whereClause) {
      const whereConditions = whereClause.split(/\s+and\s+|\s+or\s+/)
      whereConditions.forEach(condition => {
        const fieldMatch = condition.trim().match(/(\w+)\s*[=<>!]+\s*\$\d+/)
        if (fieldMatch) {
          mappings[paramIndex] = fieldMatch[1]
          paramIndex++
        }
      })
    }

    return mappings
  }

  // Handle SELECT/DELETE with WHERE: SELECT * FROM table WHERE field1 = $1 AND field2 = $2
  const whereMatch = cleanQuery.match(/where\s+(.+)$/)
  if (whereMatch) {
    let paramIndex = 1
    const whereClause = whereMatch[1]
    const conditions = whereClause.split(/\s+and\s+|\s+or\s+/)

    conditions.forEach(condition => {
      const fieldMatch = condition.trim().match(/(\w+)\s*[=<>!]+\s*\$\d+/)
      if (fieldMatch) {
        mappings[paramIndex] = fieldMatch[1]
        paramIndex++
      }
    })

    return mappings
  }

  // Fallback: just return parameter numbers
  return mappings
}

// Helper to convert TypeScript enum to pgEnum format
export function enumToPgEnum<T extends Record<string, string>>(
  enumObject: T,
): [T[keyof T], ...T[keyof T][]] {
  const values = Object.values(enumObject) as T[keyof T][]
  return values as [T[keyof T], ...T[keyof T][]]
}
