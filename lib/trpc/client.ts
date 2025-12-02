import {
  unstable_httpBatchStreamLink,
  loggerLink,
  splitLink,
  unstable_httpSubscriptionLink,
} from "@trpc/client"
import { createTRPCNext } from "@trpc/next"

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server"
import type { NextPageContext } from "next"
import { transformer } from "@/lib/trpc/transformer"
import type { AppRouter } from "@/app/api/trpc/[trpc]/routers"
import SuperJSON from "superjson"

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }

  // assume localhost
  return `http://localhost:${process.env.PORT ?? 3000}`
}

/**
 * Extend `NextPageContext` with meta data that can be picked up by `responseMeta()` when server-side rendering
 */
export interface SSRContext extends NextPageContext {
  /**
   * Set HTTP Status code
   * @example
   * const utils = trpc.useUtils();
   * if (utils.ssrContext) {
   *   utils.ssrContext.status = 404;
   * }
   */
  status?: number
}

/**
 * A set of strongly-typed React hooks from your `AppRouter` type signature with `createReactQueryHooks`.
 * @see https://trpc.io/docs/v11/react#3-create-trpc-hooks
 */
export const trpc = createTRPCNext<AppRouter, SSRContext>({
  config({ ctx }) {
    return {
      /**
       * @see https://trpc.io/docs/v11/client/links
       */
      links: [
        // adds pretty logs to your console in development and logs errors in production
        loggerLink({
          enabled: opts => true,
          // process.env.NODE_ENV === 'development' ||
          // (opts.direction === 'down' && opts.result instanceof Error),
        }),
        splitLink({
          condition: op => op.type === "subscription",
          true: unstable_httpSubscriptionLink({
            url: `${getBaseUrl()}/api/trpc`,
            transformer: SuperJSON,
          }),
          false: unstable_httpBatchStreamLink({
            url: `${getBaseUrl()}/api/trpc`,
            /**
             * Set custom request headers on every request from tRPC
             * @see https://trpc.io/docs/v11/ssr
             */
            headers() {
              if (!ctx?.req?.headers) {
                return {}
              }
              // To use SSR properly, you need to forward the client's headers to the server
              // This is so you can pass through things like cookies when we're server-side rendering

              const { connection: _connection, ...headers } = ctx.req.headers
              return headers
            },
            /**
             * @see https://trpc.io/docs/v11/data-transformers
             */
            transformer,
          }),
        }),
      ],
      /**
       * @see https://tanstack.com/query/v5/docs/reference/QueryClient
       */
      queryClientConfig: {
        defaultOptions: {
          queries: {
            // Do not auto-refetch queries until after 5 seconds
            staleTime: 5_000,
          },
        },
      },
    }
  },
  /**
   * @see https://trpc.io/docs/v11/ssr
   */
  ssr: false,
  /**
   * @see https://trpc.io/docs/v11/data-transformers
   */
  transformer,
})

export type RouterInput = inferRouterInputs<AppRouter>
export type RouterOutput = inferRouterOutputs<AppRouter>
