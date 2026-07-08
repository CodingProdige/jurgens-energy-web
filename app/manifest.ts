import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jurgens Energy",
    short_name: "Jurgens Energy",
    description: "Jurgens Energy online store.",
    start_url: "/",
    display: "standalone",
    background_color: "#FCFCF8",
    theme_color: "#CCA137",
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
