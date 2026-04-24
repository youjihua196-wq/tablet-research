/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Lint errors won't fail production builds (run lint separately)
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
