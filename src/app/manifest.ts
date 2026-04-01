import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ciseau Noir Barbershop",
    short_name: "Ciseau Noir",
    description:
      "Salon de barbier premium a Quebec. Coupes, rasages et soins professionnels. Reservez en ligne.",
    start_url: "/admin/agenda",
    display: "standalone",
    background_color: "#080808",
    theme_color: "#080808",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
