import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // TODO: set to false after generating Supabase types with `supabase gen types`
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
}

export default nextConfig
