/** @type {import('next').NextConfig} */

const nextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_URL,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  serverRuntimeConfig: {
    port: process.env.PORT || 80,
  },
  webpack(config, options) {
    if (config.name === 'server') {
      const oldEntry = config.entry
      const _config = {
        ...config,
        async entry(...args) {
          const entries = await oldEntry(...args)
          return {
            ...entries,
            'worker': './jobs/worker.ts',
          }
        },
      }
      return _config
    }
    return config
  },
}

export default nextConfig
