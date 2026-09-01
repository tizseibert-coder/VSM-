import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
};

// Bindet src/i18n/request.ts (Standardpfad) in den Next.js-Build ein, damit
// jede Server Component ueber next-intl an die passenden Texte kommt.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
