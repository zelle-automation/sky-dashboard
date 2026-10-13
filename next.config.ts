import type { NextConfig } from "next";

// The dashboard lives at /admin. All data comes from the Sky Holidays API (a separate Node.js
// process); these rewrites keep the browser on one origin so the sign-in cookie just works.
const API = process.env.API_URL || "http://localhost:4000";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/", destination: "/admin", permanent: false }];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API}/api/:path*` },
      { source: "/uploads/:path*", destination: `${API}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
