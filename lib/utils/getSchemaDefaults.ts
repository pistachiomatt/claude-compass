import { z } from 'zod'

type ZodInferredDefaults = {
  string: string
  number: number
  boolean: boolean
  date: Date
  array: never[]
  object: Record<string, unknown>
}

const inferredDefaults: ZodInferredDefaults = {
  string: '',
  number: 0,
  boolean: false,
  date: new Date(0),
  array: [],
  object: {},
}

export function getSchemaDefaults<T extends z.ZodTypeAny>(schema: T): z.infer<T> {
  // Handle optional fields first
  if (schema instanceof z.ZodOptional) {
    return undefined as z.infer<T>
  }

  // Then check for explicit defaults
  if (schema instanceof z.ZodDefault) {
    return schema._def.defaultValue() as z.infer<T>
  }

  // Handle different types
  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape()
    const defaults: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(shape)) {
      defaults[key] = getSchemaDefaults(value as z.ZodTypeAny)
    }

    return defaults as z.infer<T>
  }

  if (schema instanceof z.ZodArray) {
    return [] as z.infer<T>
  }

  if (schema instanceof z.ZodEnum) {
    return schema._def.values[0] as z.infer<T>
  }

  if (schema instanceof z.ZodString) {
    return inferredDefaults.string as z.infer<T>
  }

  if (schema instanceof z.ZodNumber) {
    return inferredDefaults.number as z.infer<T>
  }

  if (schema instanceof z.ZodBoolean) {
    return inferredDefaults.boolean as z.infer<T>
  }

  if (schema instanceof z.ZodDate) {
    return inferredDefaults.date as z.infer<T>
  }

  if (schema instanceof z.ZodRecord) {
    return {} as z.infer<T>
  }

  if (schema instanceof z.ZodAny || schema instanceof z.ZodUnknown) {
    return undefined as z.infer<T>
  }

  // Fallback for unknown types
  return undefined as z.infer<T>
}

/**
 * Compute the default values for a schema.
 */
export function dflt<T extends z.ZodType<any, any>, D extends Partial<z.infer<T>>>(
  data: D,
  schema: T,
): z.infer<T> & D {
  const defaults = getSchemaDefaults(schema)
  const result = { ...defaults }

  // Only overwrite defaults with defined values from data
  for (const [key, value] of Object.entries(data || {})) {
    if (value !== undefined) {
      result[key] = value
    }
  }

  return result as z.infer<T> & D
}
