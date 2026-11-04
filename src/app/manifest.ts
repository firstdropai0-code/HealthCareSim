import type { MetadataRoute } from "next";

/**
 * What makes the site installable: "Install app" in Chrome and Edge, and a proper
 * name and icon when an iPhone adds it to the home screen. Next serves this at
 * /manifest.webmanifest and links it from every page.
 *
 * No service worker, so no offline mode. Every useful screen needs the AI routes
 * and Firestore anyway, and an offline shell would only promise what it can't do.
 *
 * The colours are written out because a manifest can't read CSS variables. They
 * are --color-canvas and --color-surface from globals.css; change them together.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FirstDropAI Healthcare Simulation",
    short_name: "FirstDropAI",
    description:
      "Practise difficult healthcare conversations in an AI roleplay, then get scored, actionable feedback.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#e9efe9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // On a solid background, so a launcher can crop it to a circle without a hole.
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
