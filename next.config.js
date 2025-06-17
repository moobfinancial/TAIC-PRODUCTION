/** @type {import('next').NextConfig} */
const nextConfig = {
  // Preserving this as it appeared in previous versions
  serverExternalPackages: ['pg', 'pg-format'],
  
  // Image optimization configuration
  images: {
    // Migrated from deprecated domains to remotePatterns
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'oss-cf.cjdropshipping.com',
      },
      {
        protocol: 'https',
        hostname: 'cf.cjdropshipping.com',
      },
      {
        protocol: 'https',
        hostname: 'cbu01.alicdn.com',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.cloud.google.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'taic-3c401.firebasestorage.app',
      },
      {
        protocol: 'https',
        hostname: 'taic-3c401.appspot.com',
      },
      {
        protocol: 'https',
        hostname: 'api.resort-accessories.shop',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9002',
      },
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
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
      {
        protocol: 'https',
        hostname: 'img.kwcdn.com',
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
