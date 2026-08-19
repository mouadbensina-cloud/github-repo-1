import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A lockfile exists in a parent folder too; pin tracing to this project.
  outputFileTracingRoot: import.meta.dirname,
  // Next.js only inlines env vars into client bundles when they're either
  // prefixed NEXT_PUBLIC_ or listed here by name — the map is a client
  // component, so MAPBOX_TOKEN needs this to reach the browser at all.
  env: {
    MAPBOX_TOKEN: process.env.MAPBOX_TOKEN,
  },
};

export default nextConfig;
