/** @type {import('next').NextConfig} */
const nextConfig = {
  // We use a custom server (server/index.ts) to support Socket.io.
  // Next.js handles all page/api routing; Socket.io attaches to the same HTTP server.
  experimental: {
    serverComponentsExternalPackages: ['chess.js'],
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
