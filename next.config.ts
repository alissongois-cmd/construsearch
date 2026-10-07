import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The application accepts product images up to 2 MB. The small margin
      // accounts for the remaining multipart form fields.
      bodySizeLimit: "3mb",
    },
  },
};
export default nextConfig;
