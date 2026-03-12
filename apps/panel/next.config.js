/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",           value: "DENY" },
          { key: "X-Content-Type-Options",     value: "nosniff" },
          { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",         value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https://cdn.discordapp.com https://avatars.githubusercontent.com",
              "connect-src 'self' " + (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"),
            ].join("; "),
          },
        ],
      },
    ];
  },
  images: {
    domains: ["cdn.discordapp.com", "avatars.githubusercontent.com"],
  },
  compress: true,
  poweredByHeader: false,
};
module.exports = nextConfig;
