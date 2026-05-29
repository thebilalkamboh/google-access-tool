import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {},
  allowedDevOrigins: ['diligence-emperor-pebbly.ngrok-free.dev'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'ngrok-skip-browser-warning', value: '1' }],
      },
    ];
  },
};

export default nextConfig;
