/** @type {import('next').NextConfig} */
const nextConfig = {
  // Preserving this as it appeared in previous versions
  serverExternalPackages: ['pg', 'pg-format'],
  
  // Image optimization configuration
  images: {
    domains: [
      'oss-cf.cjdropshipping.com',
      'cf.cjdropshipping.com',
      'cbu01.alicdn.com',
      'placehold.co',
      'storage.googleapis.com',
      'firebasestorage.googleapis.com',
      'storage.cloud.google.com',
      'lh3.googleusercontent.com',
      'taic-3c401.firebasestorage.app',
      'taic-3c401.appspot.com',
      'localhost',
      'localhost:9002'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '**.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'taic-3c401.firebasestorage.app',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Add other Next.js configurations here if needed
  // reactStrictMode: true,
};

module.exports = nextConfig;
