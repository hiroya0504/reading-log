import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next infers the workspace root from the nearest lockfile and picks the wrong one when
  // unrelated lockfiles exist further up the filesystem. Pinning it keeps the build reproducible
  // regardless of what sits above this repository.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Covers come from the book search. Only Google Books' image hosts, matching what the backend
  // accepts for `coverUrl` (CoverUrls.java): anything else is refused by both.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "books.google.com" },
      { protocol: "https", hostname: "books.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
