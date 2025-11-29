import { customType } from 'drizzle-orm/pg-core'

/**
 * Sanitizes strings to remove invalid Unicode sequences that PostgreSQL JSONB rejects
 */
function sanitizeForPostgresJson(value: unknown): unknown {
  if (typeof value === 'string') {
    // Only remove unpaired surrogates, not valid surrogate pairs
    return value
      // Remove null bytes
      .replace(/\u0000/g, '')
      // Remove unpaired high surrogates (not followed by low surrogate)
      .replace(/[\ud800-\udbff](?![\udc00-\udfff])/g, '')
      // Remove unpaired low surrogates (not preceded by high surrogate)
      .replace(/(?<![\ud800-\udbff])[\udc00-\udfff]/g, '')
  }
  
  if (Array.isArray(value)) {
    return value.map(sanitizeForPostgresJson)
  }
  
  if (value && typeof value === 'object' && value.constructor === Object) {
    const sanitized: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeForPostgresJson(val)
    }
    return sanitized
  }
  
  return value
}

/**
 * Custom JSONB type that automatically sanitizes data to prevent
 * "Unicode low surrogate must follow a high surrogate" errors
 */
export const safeJsonb = <TData = unknown>(name: string) => 
  customType<{ data: TData; driverData: string }>({
    dataType() {
      return 'jsonb'
    },
    toDriver(value: TData): string {
      // Sanitize the entire object/array/value before stringifying
      const sanitized = sanitizeForPostgresJson(value)
      return JSON.stringify(sanitized)
    },
    fromDriver(value: string | unknown): TData {
      // Handle edge cases when reading from DB
      if (!value) return null as TData
      if (typeof value === 'object') return value as TData
      if (typeof value === 'string') {
        try {
          return JSON.parse(value) as TData
        } catch (e) {
          console.error('Failed to parse JSON from DB:', e)
          return null as TData
        }
      }
      return value as TData
    },
  })(name)

/**
 * Custom JSON type with same sanitization
 */
export const safeJson = <TData = unknown>(name: string) => 
  customType<{ data: TData; driverData: string }>({
    dataType() {
      return 'json'
    },
    toDriver(value: TData): string {
      const sanitized = sanitizeForPostgresJson(value)
      return JSON.stringify(sanitized)
    },
    fromDriver(value: string | unknown): TData {
      if (!value) return null as TData
      if (typeof value === 'object') return value as TData
      if (typeof value === 'string') {
        try {
          return JSON.parse(value) as TData
        } catch (e) {
          console.error('Failed to parse JSON from DB:', e)
          return null as TData
        }
      }
      return value as TData
    },
  })(name)