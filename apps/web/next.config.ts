import type { NextConfig } from "next";
const config: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          (process.env.API_ORIGIN ?? "http://127.0.0.1:4100") + "/api/:path*",
      },
    ];
  },
  webpack(configuration, { dev }) {
    if (dev)
      configuration.watchOptions = {
        ...configuration.watchOptions,
        poll: 1500,
        aggregateTimeout: 300,
        ignored: [
          "**/node_modules/**",
          "**/.runtime/**",
          "**/.data/**",
          "**/.pnpm-store/**",
        ],
      };
    return configuration;
  },
};
export default config;
