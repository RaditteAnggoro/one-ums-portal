const config = {
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
