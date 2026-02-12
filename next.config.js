/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone output to significantly reduce Docker image size
  // and remove the need for node_modules in the runner stage.
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  devIndicators: false,
};

module.exports = nextConfig;
