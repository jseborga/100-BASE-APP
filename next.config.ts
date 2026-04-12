import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  swcMinify: true,
}

export default nextConfig
