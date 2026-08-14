const scriptSrc = `script-src 'self' 'unsafe-inline'${
  process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
}`;
const apiBaseUrl = (process.env.API_BASE_URL ?? "https://nyumba-pap-bew3p.deployments.nisoko.co.ke").replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["100.83.243.1", "gem-404.tailf274b8.ts.net"],
  experimental: { useTypeScriptCli: false },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
    formats: ["image/avif", "image/webp"]
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiBaseUrl}/api/:path*` }];
  },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "X-Frame-Options", value: "DENY" },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Cross-Origin-Opener-Policy", value: "same-origin" }] : []),
      { key: "Content-Security-Policy", value: `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: https://images.unsplash.com https://*.tile.openstreetmap.org; ${scriptSrc}; style-src 'self' 'unsafe-inline'; connect-src 'self'` }
    ] }];
  }
};
export default nextConfig;
