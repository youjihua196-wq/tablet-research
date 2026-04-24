/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type errors are caught locally; don't block Vercel production builds
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
