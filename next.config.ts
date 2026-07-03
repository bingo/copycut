import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // worktree 嵌套在主仓库下时避免 workspace root 推断到外层
  turbopack: { root: __dirname },
};

export default nextConfig;
