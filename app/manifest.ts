import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jurgens Energy",
    short_name: "Jurgens Energy",
    description: "Jurgens Energy online store.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F7F2",
    theme_color: "#FF5A1F",
    icons: [
      {
        src: "/brand/favicon-for-app/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/brand/favicon-for-app/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
