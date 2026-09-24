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
      streetAddress: "2275 Avenue Royale",
      addressLocality: "Beauport",
      addressRegion: "QC",
      postalCode: "G1C 1P5",
      addressCountry: "CA",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 46.883758,
      longitude: -71.159241,
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
    // Signaux locaux : Google s'en sert pour le pack local et la fiche.
    hasMap: "https://www.google.com/maps/dir/?api=1&destination=46.883758%2C-71.159241",
    currenciesAccepted: "CAD",
    paymentAccepted: "Comptant, Débit, Crédit",
    publicAccess: true,
    isAccessibleForFree: false,
    slogan: "Barbier de quartier à Beauport — coupe, barbe et rasage à la lame.",
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
            name: "Coupe + Barbe à la lame",
            description: "Forfait coupe de cheveux et taille de barbe",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Enfant (12 ans et moins)",
            description: "Coupe pour enfant de 12 ans et moins",
          },
        },
      ],
    },
  };

  // FAQ structurée — cible les questions réellement tapées dans Google après le
  // déménagement ("nouvelle adresse", "où est rendu Ciseau Noir"). Une FAQPage peut
  // s'afficher en résultat enrichi et occupe plus de place dans la page de résultats.
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Où est situé Ciseau Noir Barbershop à Québec ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Ciseau Noir Barbershop est au 2275 Avenue Royale, dans le secteur Courville à Beauport (ville de Québec), G1C 1P5. Le salon a déménagé en septembre 2026 — il n'est plus au 375 boulevard des Chutes.",
        },
      },
      {
        "@type": "Question",
        name: "Ciseau Noir a-t-il déménagé ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Oui. Depuis septembre 2026, le salon est au 2275 Avenue Royale à Québec, dans des locaux rénovés. L'ancienne adresse était le 375 boulevard des Chutes.",
        },
      },
      {
        "@type": "Question",
        name: "Quelles sont les heures d'ouverture ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Mardi et mercredi de 8 h 30 à 16 h 30, jeudi et vendredi de 8 h 30 à 19 h, samedi de 9 h à 16 h 30. Fermé le dimanche et le lundi.",
        },
      },
      {
        "@type": "Question",
        name: "Faut-il un rendez-vous chez Ciseau Noir ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "La réservation en ligne est recommandée et prend moins d'une minute sur ciseaunoirbarbershop.com/booking. Vous recevez une confirmation par SMS et par courriel, et vous pouvez annuler ou déplacer votre rendez-vous vous-même avec le lien reçu.",
        },
      },
      {
        "@type": "Question",
        name: "Quels services offre le barbershop ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Coupe homme, coupe et barbe à la lame, rasage classique à la serviette chaude, taille de barbe, coupe enfant (12 ans et moins) et coupe au shaver. Les prix sont affichés sur la page Services.",
        },
      },
      {
        "@type": "Question",
        name: "Qui sont les barbières chez Ciseau Noir ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Melynda, barbière et co-fondatrice, et Stéphanie, barbière. Vous choisissez avec qui vous réservez au moment de la prise de rendez-vous.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
      />
    </>
  );
}
