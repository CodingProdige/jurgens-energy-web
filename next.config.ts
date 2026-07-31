import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com"],
  images: {
    qualities: [75, 90],
  },
  output: "standalone",
  poweredByHeader: false,
  turbopack: {
    root: appRoot,
  },
};

export default nextConfig;
