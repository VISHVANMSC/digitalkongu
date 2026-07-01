import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-6a1dfa28-6a24-42ea-8137-bddfd3253133.space-z.ai",
    "127.0.0.1",
    "localhost",
  ],
};

export default nextConfig;
