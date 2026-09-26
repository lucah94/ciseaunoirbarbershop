// Étoffe la fiche BarberShop avec de VRAIS avis Google (texte réel, pas de
// paraphrase) — les moteurs IA (GEO) valorisent la spécificité concrète sur les
// formulations vagues. Échoue en silence vers [] si l'API est indisponible :
// le reste du schema (adresse, horaires, FAQ) doit s'afficher même sans ça.
async function getRealReviews(): Promise<{ author: string; rating: number; text: string; date: string }[]> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://ciseaunoirbarbershop.com";
    const res = await fetch(`${base}/api/reviews`, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const data = await res.json();
    const reviews = (data.reviews as { author_name?: string; rating?: number; text?: string; time?: number }[] | undefined) || [];
    return reviews
      .filter((r) => r.text && r.text.trim().length > 0)
      .slice(0, 5)
      .map((r) => ({
        author: r.author_name || "Client Google",
        rating: r.rating || 5,
        text: r.text!.trim(),
        date: r.time ? new Date(r.time * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      }));
  } catch {
    return [];
  }
}

export default async function JsonLd() {
  const realReviews = await getRealReviews();
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
    // Avis individuels avec VRAI texte (via getRealReviews) — les moteurs IA citent
    // des extraits concrets, pas une note globale. [] si l'API échoue → aucun champ
    // "review" invalide n'est publié (mieux vaut l'omettre que publier du faux).
    ...(realReviews.length > 0
      ? {
          review: realReviews.map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.author },
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: "5" },
            reviewBody: r.text,
            datePublished: r.date,
          })),
        }
      : {}),
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
      {
        "@type": "Question",
        name: "Combien coûte une coupe chez Ciseau Noir ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Les prix vont de 25$ à 75$ selon le service : rasage seul à 25$, coupe et lavage à 35$, coupe et barbe au shaver à 45$, coupe et barbe à la lame à 60$, jusqu'au service premium complet (shampoing, coupe, rasage, serviette chaude, exfoliant) à 75$. La liste complète et à jour est sur ciseaunoirbarbershop.com/services.",
        },
      },
      {
        "@type": "Question",
        name: "Y a-t-il un programme de fidélité ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Oui. Après 10 visites, la 10e coupe est gratuite. La progression s'affiche automatiquement après chaque réservation.",
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
