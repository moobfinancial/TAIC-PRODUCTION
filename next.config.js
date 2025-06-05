/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { webpack }) => {
    // Ignore 'cloudflare:sockets' to prevent Webpack from trying to bundle it.
    // This is necessary because 'pg' includes 'pg-cloudflare' which uses Cloudflare-specific imports.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^cloudflare:sockets$/,
      })
    );


    // Force 'pg' to resolve to its CommonJS version to avoid ESM/Web Crypto issues in middleware
    config.resolve.alias = {
      ...config.resolve.alias,
      // The '$' ensures we only alias the exact 'pg' import, not 'pg-pool', etc.
      'pg$': 'pg/lib/index.js',
      'pg-cloudflare$': false, // Prevent pg-cloudflare from being resolved
    };

    // Important: return the modified config
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cf.cjdropshipping.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    // Add any other Next.js experimental options here if needed
  },
  // Add any other Next.js config options here
};

module.exports = nextConfig;
