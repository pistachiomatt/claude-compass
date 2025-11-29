import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres"
import { env } from "@/lib/env.server"
import chalk from "chalk"
import { formatDbParams } from "./dbHelpers"
import * as schema from "./schema"
import fs from "fs"

// Extract table name from SQL query
function extractTableName(sql: string): string {
  const fromMatch = sql.match(/from\s+"?([^"\s]+)"?/i)
  const intoMatch = sql.match(/into\s+"?([^"\s]+)"?/i)
  const updateMatch = sql.match(/update\s+"?([^"\s]+)"?/i)

  return fromMatch?.[1] || intoMatch?.[1] || updateMatch?.[1] || "unknown"
}

// Clean up SQL by removing quotes around identifiers
function cleanSql(sql: string): string {
  return sql
    .replace(/"([^"]+)"/g, "$1") // Remove quotes around identifiers
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
}

// Custom logger that matches the MongoDB style from db/db.ts
let queryCounter = 0

// Augment the global object to include our db instance
declare global {
  // eslint-disable-next-line no-var
  var db: NodePgDatabase<typeof schema> | undefined
}

const sslOptions = fs.existsSync("/app/rds-ca-bundle.pem")
  ? {
      ca: fs.readFileSync("/app/rds-ca-bundle.pem").toString(),
    }
  : undefined

const createDb = () =>
  drizzle(env.DATABASE_URL, {
    schema,
    // @ts-ignore
    ssl: sslOptions,
    logger: {
      logQuery: (query: string, params: unknown[]) => {
        const queryId = ++queryCounter
        const startTime = Date.now()

        // Store start time for this query
        ;(globalThis as any).__drizzleQueryTimes =
          (globalThis as any).__drizzleQueryTimes || new Map()
        ;(globalThis as any).__drizzleQueryTimes.set(queryId, startTime)

        // Extract operation type and table name from SQL
        const operation = query.trim().split(" ")[0]?.toUpperCase() || "QUERY"
        const tableName = extractTableName(query)

        console.log()
        console.log(`${chalk.cyan(operation)} ${chalk.magenta(tableName)}`)
        console.log(chalk.gray(cleanSql(query)))
        process.env.NODE_ENV !== "production" && console.log(chalk.gray("↓"))
        process.env.NODE_ENV !== "production" &&
          console.log(chalk.gray(formatDbParams(query, params)))

        // Use setTimeout to log completion time in grey
        setTimeout(() => {
          const queryTimes = (globalThis as any).__drizzleQueryTimes
          const queryStartTime = queryTimes?.get(queryId)
          if (queryStartTime) {
            const executionTimeMS = Date.now() - queryStartTime
            console.log(chalk.gray(`(${executionTimeMS.toFixed(1)}ms)`))
            console.log()
            queryTimes.delete(queryId)
          }
        }, 0)
      },
    },
  })

export const db = globalThis.db ?? createDb()

if (process.env.NODE_ENV !== "production") globalThis.db = db
