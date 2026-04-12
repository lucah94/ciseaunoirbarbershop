export default function JsonLd() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BarberShop",
    name: "Ciseau Noir Barbershop",
    description:
      "Salon de barbier premium a Quebec. Coupes, rasages et soins professionnels.",
    url: "https://ciseaunoir.ca",
    telephone: "+1-418-665-5703",
    address: {
      "@type": "PostalAddress",
      streetAddress: "375 Boul. des Chutes",
      addressLocality: "Quebec",
      addressRegion: "QC",
      postalCode: "G1E 2J1",
      addressCountry: "CA",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 46.8565,
      longitude: -71.1732,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "18:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "09:00",
        closes: "16:00",
      },
    ],
    priceRange: "$$",
    image: "https://ciseaunoir.ca/favicon.ico",
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Services de barbier",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Coupe homme",
            description: "Coupe de cheveux professionnelle pour hommes",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Rasage classique",
            description: "Rasage a la lame avec serviette chaude",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Taille de barbe",
            description: "Entretien et mise en forme de la barbe",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Coupe + Barbe",
            description: "Forfait coupe de cheveux et taille de barbe",
          },
        },
      ],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
