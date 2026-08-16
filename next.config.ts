import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Wizard uploads go through Server Actions: images up to 10 MB each and
      // browser-rendered videos up to 50 MB (+ multipart overhead).
      bodySizeLimit: "55mb",
    },
  },
};

export default nextConfig;
