import type { NextConfig } from "next";

/*
 * The headers a browser needs to be told, sent on every response.
 *
 * Deliberately not a Content-Security-Policy. The app loads Firebase, Google
 * Fonts' stylesheet at build time, an inline pre-paint script, and (with camera
 * coaching on) a WebAssembly runtime and model from two CDNs; a policy written
 * without exercising every one of those in a browser would break something
 * quietly. These four cannot.
 */
const securityHeaders = [
  // Nothing embeds this app, and a framed sign-in page is how clickjacking works.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Run ids are in URLs; another site has no need to learn them from a link.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The microphone and camera are used by this app's own pages and nothing else.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
