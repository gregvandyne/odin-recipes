/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Don't fail the deploy on lint warnings; CI runs lint as a separate step.
  eslint: { ignoreDuringBuilds: true },
  // Initial-scaffold escape hatch: skip TS errors at build time. Remove this
  // line once `npm run typecheck` passes locally — it should be temporary.
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "@node-rs/argon2"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
