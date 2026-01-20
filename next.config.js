/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  eslint: {
    // Allow production builds to successfully complete even if
    // there are ESLint warnings (not errors)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // WARNING: This allows builds to complete even with TypeScript errors
    // Only use for development - fix errors before production!
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
