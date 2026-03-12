/** @type {import('next').NextConfig} */
const nextConfig = {
  // Headers de segurança em todas as respostas
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Next.js precisa
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

  // Imagens externas permitidas
  images: {
    domains: ["cdn.discordapp.com", "avatars.githubusercontent.com"],
  },

  // Compressão
  compress: true,

  // Remover X-Powered-By
  poweredByHeader: false,
};

module.exports = nextConfig;
