"use client";

// Contrat de location de chaise — version imprimable, réutilisable pour TOUS les barbiers.
// Melynda ouvre /admin/contrat, clique « Imprimer », et écrit le nom + les dates à la main.

export default function ContratLocationPage() {
  return (
    <div style={{ background: "#f3f3f3", minHeight: "100vh", padding: "24px 0" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .contrat-page { box-shadow: none !important; margin: 0 !important; padding: 12mm 14mm !important; }
        }
        .blank { display: inline-block; border-bottom: 1px solid #000; min-width: 220px; }
        .blank-sm { display: inline-block; border-bottom: 1px solid #000; min-width: 120px; }
        .contrat-page h1 { font-size: 22px; margin: 0 0 4px; }
        .contrat-page h2 { font-size: 15px; margin: 18px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
        .contrat-page p, .contrat-page li { font-size: 13.5px; line-height: 1.55; }
      `}</style>

      <div className="no-print" style={{ maxWidth: "800px", margin: "0 auto 16px", display: "flex", gap: "12px", alignItems: "center" }}>
        <button
          onClick={() => window.print()}
          style={{ background: "#111", color: "#D4AF37", border: "1px solid #D4AF37", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "14px" }}
        >
          🖨️ Imprimer le contrat
        </button>
        <span style={{ fontSize: "13px", color: "#555" }}>
          Imprime un exemplaire par barbier — tu écris le nom et les dates à la main.
        </span>
      </div>

      <div
        className="contrat-page"
        style={{ maxWidth: "800px", margin: "0 auto", background: "#fff", color: "#111", padding: "32px 40px", borderRadius: "6px", boxShadow: "0 2px 16px rgba(0,0,0,0.12)", fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <h1>CONTRAT DE LOCATION DE CHAISE</h1>
          <p style={{ margin: 0, fontStyle: "italic", color: "#444" }}>Ciseau Noir Barbershop — 375, boul. des Chutes, Beauport, ville de Québec (QC) G1E 2J1</p>
        </div>

        <h2>Entre les parties</h2>
        <p><b>Le Locateur :</b> Ciseau Noir Barbershop, représenté par ses propriétaires <b>Luca Hayes</b> et <b>Melynda Hayes</b> (ci-après « le Salon »).</p>
        <p><b>La Locataire :</b> <span className="blank">&nbsp;</span>, barbière/coiffeuse exerçant à titre de <b>travailleuse autonome indépendante</b> (ci-après « la Locataire »).</p>

        <h2>1. Objet</h2>
        <p>Le Salon loue à la Locataire <b>une (1) chaise / poste de travail</b> et l'accès aux installations communes, pour qu'elle y exerce son métier <b>à son propre compte</b>. Le présent contrat <b>ne crée aucun lien d'emploi</b> : la Locataire n'est ni employée, ni associée du Salon.</p>

        <h2>2. Durée et résiliation</h2>
        <p>Début : le <span className="blank-sm">&nbsp;</span>. Durée indéterminée (mois à mois). Chaque partie peut mettre fin au contrat avec un <b>préavis écrit de 30 jours</b>. Un retard de paiement de plus de <b>7 jours</b> peut entraîner la résiliation immédiate.</p>

        <h2>3. Loyer</h2>
        <p><b>400 $ par semaine</b>, payable chaque <span className="blank-sm">&nbsp;</span> par virement Interac (ou autre mode convenu). Le loyer est dû en entier chaque semaine, travaillée ou non, sauf entente écrite (ex. vacances convenues d'avance). <i>Taxes (TPS/TVQ) en sus si applicable — à confirmer avec le comptable.</i></p>

        <h2>4. Ce qui est inclus</h2>
        <p>Chaise et poste de travail · accès lavabo, salle d'attente, eau, électricité, Wi-Fi · ménage des aires communes · système de réservation en ligne du Salon · <b>les produits du Salon, fournis pour son usage</b>.</p>

        <h2>5. À la charge de la Locataire</h2>
        <p>Ses propres <b>outils de coupe</b> (tondeuses, ciseaux) · ses <b>impôts</b>, <b>TPS/TVQ</b> et inscriptions fiscales · sa <b>propre assurance responsabilité professionnelle</b> · ses permis et le respect des normes d'hygiène et de santé.</p>

        <h2>6. Produits</h2>
        <p>Le Salon fournit les produits nécessaires au travail de la Locataire. La Locataire <b>peut également utiliser ses propres produits</b> si elle le préfère, à ses frais.</p>

        <h2>7. Clientèle</h2>
        <p>Les clients <b>amenés par le Salon</b> (publicité payée par le Salon, réservations en ligne du Salon, clients sans rendez-vous accueillis par le Salon) <b>demeurent la clientèle du Salon</b>. Les clients que la Locataire amène elle-même sont sa clientèle. <b>Non-sollicitation :</b> pendant le contrat et durant <b>6 mois</b> après sa fin, la Locataire ne sollicite pas la clientèle du Salon ni les coordonnées du système de réservation.</p>

        <h2>8. Données et image de marque</h2>
        <p>Les données clients et le système de réservation appartiennent au Salon et sont confidentiels. La Locataire respecte l'image, la propreté et les valeurs du Salon.</p>

        <h2>9. Statut de travailleuse autonome</h2>
        <p>La Locataire fixe son propre horaire, gère sa clientèle et ses revenus, et assume seule ses obligations fiscales et légales. Aucun avantage social, vacances payées ou retenue à la source n'est fourni par le Salon. Le présent contrat est régi par les lois du <b>Québec</b>.</p>

        <div style={{ marginTop: "28px" }}>
          <p>Signé à <span className="blank-sm">&nbsp;</span>, le <span className="blank-sm">&nbsp;</span>.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "38px", marginTop: "44px" }}>
            <div style={{ borderTop: "1px solid #000", paddingTop: "4px", fontSize: "12px", maxWidth: "340px" }}>Luca Hayes — propriétaire (Salon)</div>
            <div style={{ borderTop: "1px solid #000", paddingTop: "4px", fontSize: "12px", maxWidth: "340px" }}>Melynda Hayes — propriétaire (Salon)</div>
            <div style={{ borderTop: "1px solid #000", paddingTop: "4px", fontSize: "12px", maxWidth: "340px" }}>La Locataire (barbier) : <span className="blank-sm">&nbsp;</span></div>
          </div>
        </div>

        <p style={{ marginTop: "24px", fontSize: "11px", color: "#888", fontStyle: "italic" }}>
          Modèle fourni à titre informatif. Faire valider par un comptable ou notaire avant signature (volet taxes et statut).
        </p>
      </div>
    </div>
  );
}
