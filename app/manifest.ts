import type { MetadataRoute } from "next";

// PWA manifest for add-to-home-screen on Emma's iPhone (PRD §8).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Progressive Overload",
    short_name: "Overload",
    description:
      "Progressive-overload strength programming, live logging, and PR tracking.",
    start_url: "/today",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0066cc",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
