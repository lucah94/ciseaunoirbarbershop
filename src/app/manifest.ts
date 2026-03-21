import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ciseau Noir Barbershop",
    short_name: "Ciseau Noir",
    description:
      "Salon de barbier premium a Quebec. Coupes, rasages et soins professionnels. Reservez en ligne.",
    start_url: "/",
    display: "standalone",
    background_color: "#080808",
    theme_color: "#080808",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
