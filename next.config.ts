import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com"],
  output: "standalone",
  turbopack: {
    root: appRoot,
  },
};

export default nextConfig;
