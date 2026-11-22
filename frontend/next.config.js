/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // In production on Render, frontend calls https://borderless-money-api.onrender.com directly
    // via NEXT_PUBLIC_API_BASE_URL, so rewrites are bypassed. For local dev they proxy to 8000.
    const apiBase =
      process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
    // Only use rewrites when API_BASE is local (avoid proxying to itself in prod)
    if (apiBase.includes("onrender.com") || apiBase.includes("https://")) {
      return [];
    }
    return [
      { source: "/api/:path*", destination: `${apiBase}/api/:path*` },
      { source: "/token", destination: `${apiBase}/token` },
    ];
  },
};

module.exports = nextConfig;
