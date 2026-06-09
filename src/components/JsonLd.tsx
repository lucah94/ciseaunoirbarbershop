export default function JsonLd() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BarberShop",
    name: "Ciseau Noir Barbershop",
    description:
      "Salon de barbier premium à Beauport, Québec. Coupes homme, rasage à la lame et taille de barbe. Réservez en ligne.",
    url: "https://ciseaunoirbarbershop.com",
    telephone: "+1-418-665-5703",
    address: {
      "@type": "PostalAddress",
      streetAddress: "375 Boul. des Chutes",
      addressLocality: "Beauport",
      addressRegion: "QC",
      postalCode: "G1E 2J1",
      addressCountry: "CA",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 46.8565,
      longitude: -71.1732,
    },
    areaServed: ["Beauport", "Québec", "Ville de Québec"],
    sameAs: ["https://www.facebook.com/profile.php?id=61575695811602"],
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Tuesday", "Wednesday"],
        opens: "08:30",
        closes: "16:30",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Thursday", "Friday"],
        opens: "08:30",
        closes: "20:30",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "09:00",
        closes: "16:30",
      },
    ],
    priceRange: "$$",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5.0",
      reviewCount: "46",
      bestRating: "5",
      worstRating: "1",
    },
    image: "https://ciseaunoirbarbershop.com/images/melynda.jpg",
    employee: [
      {
        "@type": "Person",
        name: "Melynda",
        jobTitle: "Barbière & Co-fondatrice",
      },
      {
        "@type": "Person",
        name: "Stéphanie",
        jobTitle: "Barbière",
      },
    ],
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
