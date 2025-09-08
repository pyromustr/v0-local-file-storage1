/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['node:fs', 'node:path', 'node:child_process']
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'node:fs': 'commonjs node:fs',
        'node:path': 'commonjs node:path',
        'node:child_process': 'commonjs node:child_process',
        'node:os': 'commonjs node:os',
        'node:util': 'commonjs node:util'
      })
    }
    return config
  },
  env: {
    WORKSPACE: process.env.WORKSPACE || './workspace',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info'
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
