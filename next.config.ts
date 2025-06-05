/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Image optimization configuration
  images: {
    // List of allowed domains for next/image
    domains: [
      'cbu01.alicdn.com',
      'cf.cjdropshipping.com',
      'oss-cf.cjdropshipping.com',
      'placehold.co',
    ],
    // Enable SVG handling
    dangerouslyAllowSVG: true,
    // Disable image optimization in development
    // unoptimized: process.env.NODE_ENV === 'development',
  },
  
  // Webpack configuration
  webpack: (config: any) => {
    // Ensure plugins array exists
    config.plugins = config.plugins || [];
    
    // Ignore 'cloudflare:sockets' to prevent Webpack from trying to bundle it
    config.plugins.push(
      new (require('webpack')).IgnorePlugin({
        resourceRegExp: /^cloudflare:sockets$/,
      })
    );
    
    // Handle pg-native module
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'pg-native': '@connext/pg-native',
      };
    }
    
    // Handle node-fetch and other polyfills if needed
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...config.resolve?.fallback,
        fs: false, // Ignore fs module
        net: false, // Ignore net module
        tls: false, // Ignore tls module
        dns: false, // Ignore dns module
        child_process: false, // Ignore child_process module
      },
    };
    
    return config;
  },
  
  // Transpile required packages
  transpilePackages: [
    'lucide-react',
    '@stripe/react-stripe-js',
    '@stripe/stripe-js',
    'ethers'
  ],
};

module.exports = nextConfig;
