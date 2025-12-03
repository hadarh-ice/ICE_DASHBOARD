/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Disable static optimization for client-only pages
    isrMemoryCacheSize: 0,
  },
};

export default nextConfig;
