import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "ciseaunoirbarbershop@gmail.com";
const FROM_EMAIL = process.env.FROM_EMAIL || "Ciseau Noir <noreply@ciseunoirbarbershop.com>";

export async function sendBookingConfirmation(booking: {
  client_name: string;
  client_email: string;
  service: string;
  barber: string;
  date: string;
  time: string;
  price: number;
  note?: string;
  booking_id?: string;
}) {
  const dateFormatted = new Date(booking.date + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const rdvUrl = booking.booking_id
    ? `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/booking/rdv/${booking.booking_id}`
    : null;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: booking.client_email,
    subject: `Confirmation — ${booking.service} le ${dateFormatted}`,
    html: `
      <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 48px 32px; max-width: 560px; margin: 0 auto;">
        <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Ciseau Noir</p>
        <h1 style="font-weight: 300; font-size: 28px; letter-spacing: 3px; margin-bottom: 8px; color: #F5F5F5;">Réservation confirmée</h1>
        <div style="width: 40px; height: 2px; background: #C9A84C; margin-bottom: 32px;"></div>

        <p style="color: #999; font-size: 15px; margin-bottom: 32px;">Bonjour ${booking.client_name},<br>Votre rendez-vous a bien été enregistré.</p>

        <div style="background: #111; border: 1px solid #1A1A1A; padding: 24px; margin-bottom: 32px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #1A1A1A;">
              <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 12px 0;">Service</td>
              <td style="color: #F5F5F5; font-size: 14px; padding: 12px 0; text-align: right;">${booking.service}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1A1A1A;">
              <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 12px 0;">Barbier</td>
              <td style="color: #F5F5F5; font-size: 14px; padding: 12px 0; text-align: right;">${booking.barber}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1A1A1A;">
              <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 12px 0;">Date</td>
              <td style="color: #F5F5F5; font-size: 14px; padding: 12px 0; text-align: right;">${dateFormatted}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1A1A1A;">
              <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 12px 0;">Heure</td>
              <td style="color: #F5F5F5; font-size: 14px; padding: 12px 0; text-align: right;">${booking.time}</td>
            </tr>
            <tr>
              <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 12px 0;">Prix</td>
              <td style="color: #C9A84C; font-size: 18px; font-weight: 300; padding: 12px 0; text-align: right;">${booking.price}$</td>
            </tr>
          </table>
          ${booking.note ? `<p style="color: #666; font-size: 13px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #1A1A1A;">Note : ${booking.note}</p>` : ""}
        </div>

        <div style="background: #111; border-left: 2px solid #C9A84C; padding: 16px 20px; margin-bottom: 32px;">
          <p style="color: #888; font-size: 13px; margin: 0; line-height: 1.7;">
            📍 375 Bd des Chutes, Québec, QC G1E 3G1<br>
            📞 (418) 665-5703<br>
            ⚠️ Annulation : minimum 1 heure avant le rendez-vous
          </p>
        </div>

        ${rdvUrl ? `
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${rdvUrl}"
             style="display: inline-block; background: #C9A84C; color: #0A0A0A; padding: 14px 36px; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; text-decoration: none; font-weight: 700; border-radius: 4px;">
            Voir / Modifier mon RDV
          </a>
          <br>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/api/bookings/ical?id=${booking.booking_id}"
             style="display: inline-block; margin-top: 12px; color: #666; font-size: 11px; text-decoration: underline; letter-spacing: 1px;">
            📅 Ajouter au calendrier iPhone
          </a>
        </div>` : ""}

        <p style="color: #444; font-size: 12px; text-align: center;">© 2026 Ciseau Noir Barbershop</p>
      </div>
    `,
  });
}

export async function sendBookingNotificationAdmin(booking: {
  client_name: string;
  client_phone: string;
  client_email: string;
  service: string;
  barber: string;
  date: string;
  time: string;
  price: number;
  note?: string;
}) {
  const dateFormatted = new Date(booking.date + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `📅 Nouvelle réservation — ${booking.client_name} — ${dateFormatted} à ${booking.time}`,
    html: `
      <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 32px; max-width: 560px; margin: 0 auto;">
        <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 16px;">Nouvelle réservation</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #1A1A1A;">
            <td style="color: #555; font-size: 12px; padding: 10px 0; text-transform: uppercase; letter-spacing: 1px;">Client</td>
            <td style="color: #F5F5F5; font-size: 14px; padding: 10px 0; text-align: right;">${booking.client_name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #1A1A1A;">
            <td style="color: #555; font-size: 12px; padding: 10px 0; text-transform: uppercase; letter-spacing: 1px;">Téléphone</td>
            <td style="color: #F5F5F5; font-size: 14px; padding: 10px 0; text-align: right;">${booking.client_phone}</td>
          </tr>
          <tr style="border-bottom: 1px solid #1A1A1A;">
            <td style="color: #555; font-size: 12px; padding: 10px 0; text-transform: uppercase; letter-spacing: 1px;">Service</td>
            <td style="color: #F5F5F5; font-size: 14px; padding: 10px 0; text-align: right;">${booking.service}</td>
          </tr>
          <tr style="border-bottom: 1px solid #1A1A1A;">
            <td style="color: #555; font-size: 12px; padding: 10px 0; text-transform: uppercase; letter-spacing: 1px;">Barbier</td>
            <td style="color: #F5F5F5; font-size: 14px; padding: 10px 0; text-align: right;">${booking.barber}</td>
          </tr>
          <tr style="border-bottom: 1px solid #1A1A1A;">
            <td style="color: #555; font-size: 12px; padding: 10px 0; text-transform: uppercase; letter-spacing: 1px;">Date</td>
            <td style="color: #C9A84C; font-size: 14px; padding: 10px 0; text-align: right;">${dateFormatted} à ${booking.time}</td>
          </tr>
          <tr>
            <td style="color: #555; font-size: 12px; padding: 10px 0; text-transform: uppercase; letter-spacing: 1px;">Prix</td>
            <td style="color: #C9A84C; font-size: 18px; padding: 10px 0; text-align: right;">${booking.price}$</td>
          </tr>
        </table>
        ${booking.note ? `<p style="color: #666; font-size: 13px; margin-top: 16px; padding: 12px; background: #111; border-left: 2px solid #333;">Note : ${booking.note}</p>` : ""}
      </div>
    `,
  });
}

export async function sendConfirmationReminderEmail(booking: {
  client_name: string;
  client_email: string;
  service: string;
  barber: string;
  date: string;
  time: string;
  price: number;
  booking_id: string;
}) {
  const dateFormatted = new Date(booking.date + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const rdvUrl = `${siteUrl}/booking/rdv/${booking.booking_id}`;
  const cancelUrl = `${siteUrl}/api/bookings/${booking.booking_id}/cancel`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: booking.client_email,
    subject: `Confirmation requise — Votre RDV du ${dateFormatted} à ${booking.time}`,
    html: `
      <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 48px 32px; max-width: 560px; margin: 0 auto;">
        <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Ciseau Noir</p>
        <h1 style="font-weight: 300; font-size: 24px; letter-spacing: 3px; margin-bottom: 8px; color: #F5F5F5;">Confirmez votre rendez-vous</h1>
        <div style="width: 40px; height: 2px; background: #C9A84C; margin-bottom: 32px;"></div>

        <p style="color: #999; font-size: 15px; margin-bottom: 32px;">Bonjour ${booking.client_name},<br>Votre rendez-vous est dans <strong style="color: #C9A84C;">2 jours</strong>. Merci de confirmer votre présence.</p>

        <div style="background: #111; border: 1px solid #1A1A1A; padding: 24px; margin-bottom: 32px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #1A1A1A;">
              <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 10px 0;">Service</td>
              <td style="color: #F5F5F5; font-size: 14px; padding: 10px 0; text-align: right;">${booking.service}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1A1A1A;">
              <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 10px 0;">Barbier</td>
              <td style="color: #F5F5F5; font-size: 14px; padding: 10px 0; text-align: right;">${booking.barber}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1A1A1A;">
              <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 10px 0;">Date</td>
              <td style="color: #C9A84C; font-size: 14px; padding: 10px 0; text-align: right;">${dateFormatted}</td>
            </tr>
            <tr>
              <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 10px 0;">Heure</td>
              <td style="color: #C9A84C; font-size: 18px; font-weight: 300; padding: 10px 0; text-align: right;">${booking.time}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin-bottom: 16px;">
          <a href="${rdvUrl}"
             style="display: inline-block; background: #C9A84C; color: #0A0A0A; padding: 14px 36px; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; text-decoration: none; font-weight: 700; border-radius: 4px;">
            ✅ Confirmer mon RDV
          </a>
        </div>

        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${cancelUrl}"
             style="display: inline-block; background: transparent; color: #666; padding: 10px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; text-decoration: none; border: 1px solid #333; border-radius: 4px;">
            Annuler mon rendez-vous
          </a>
        </div>

        <div style="background: #111; border-left: 2px solid #C9A84C; padding: 16px 20px; margin-bottom: 24px;">
          <p style="color: #888; font-size: 13px; margin: 0; line-height: 1.7;">
            📍 375 Bd des Chutes, Québec, QC G1E 3G1<br>
            📞 (418) 665-5703
          </p>
        </div>

        <p style="color: #444; font-size: 12px; text-align: center;">© 2026 Ciseau Noir Barbershop</p>
      </div>
    `,
  });
}

export async function sendReminderEmail(booking: {
  client_name: string;
  client_email: string;
  service: string;
  barber: string;
  date: string;
  time: string;
  price: number;
  booking_id: string;
}) {
  const dateFormatted = new Date(booking.date + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const rdvUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/booking/rdv/${booking.booking_id}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: booking.client_email,
    subject: `Rappel — Votre rendez-vous demain à ${booking.time}`,
    html: `
      <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 48px 32px; max-width: 560px; margin: 0 auto;">
        <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Ciseau Noir</p>
        <h1 style="font-weight: 300; font-size: 24px; letter-spacing: 3px; margin-bottom: 8px; color: #F5F5F5;">Rappel de rendez-vous</h1>
        <div style="width: 40px; height: 2px; background: #C9A84C; margin-bottom: 32px;"></div>

        <p style="color: #999; font-size: 15px; margin-bottom: 32px;">Bonjour ${booking.client_name},<br>Votre rendez-vous est <strong style="color: #C9A84C;">demain</strong> !</p>

        <div style="background: #111; border: 1px solid #1A1A1A; padding: 24px; margin-bottom: 32px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #1A1A1A;">
              <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 10px 0;">Service</td>
              <td style="color: #F5F5F5; font-size: 14px; padding: 10px 0; text-align: right;">${booking.service}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1A1A1A;">
              <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 10px 0;">Barbier</td>
              <td style="color: #F5F5F5; font-size: 14px; padding: 10px 0; text-align: right;">${booking.barber}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1A1A1A;">
              <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 10px 0;">Date</td>
              <td style="color: #C9A84C; font-size: 14px; padding: 10px 0; text-align: right;">${dateFormatted}</td>
            </tr>
            <tr>
              <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 10px 0;">Heure</td>
              <td style="color: #C9A84C; font-size: 18px; font-weight: 300; padding: 10px 0; text-align: right;">${booking.time}</td>
            </tr>
          </table>
        </div>

        <div style="background: #111; border-left: 2px solid #C9A84C; padding: 16px 20px; margin-bottom: 24px;">
          <p style="color: #888; font-size: 13px; margin: 0; line-height: 1.7;">
            📍 375 Bd des Chutes, Québec, QC G1E 3G1<br>
            📞 (418) 665-5703<br>
            ⚠️ Annulation : minimum 1 heure avant le rendez-vous
          </p>
        </div>

        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${rdvUrl}"
             style="display: inline-block; background: #C9A84C; color: #0A0A0A; padding: 14px 36px; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; text-decoration: none; font-weight: 700; border-radius: 4px;">
            Voir / Modifier mon RDV
          </a>
        </div>

        <p style="color: #444; font-size: 12px; text-align: center;">© 2026 Ciseau Noir Barbershop</p>
      </div>
    `,
  });
}

export async function sendReviewRequestEmail(booking: {
  client_name: string;
  client_email: string;
  barber: string;
  service: string;
}) {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: booking.client_email,
    subject: `Merci pour votre visite — Laissez-nous un avis !`,
    html: `
      <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 48px 32px; max-width: 560px; margin: 0 auto;">
        <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Ciseau Noir</p>
        <h1 style="font-weight: 300; font-size: 24px; letter-spacing: 3px; margin-bottom: 8px; color: #F5F5F5;">Merci pour votre visite !</h1>
        <div style="width: 40px; height: 2px; background: #C9A84C; margin-bottom: 32px;"></div>

        <p style="color: #999; font-size: 15px; line-height: 1.8; margin-bottom: 32px;">
          Bonjour ${booking.client_name},<br><br>
          Nous espérons que votre expérience avec <strong style="color: #F5F5F5;">${booking.barber}</strong> vous a plu.<br>
          Si vous avez quelques secondes, un avis Google nous aide énormément à faire connaître le salon.
        </p>

        <div style="text-align: center; margin-bottom: 40px;">
          <p style="color: #C9A84C; font-size: 32px; letter-spacing: 8px; margin-bottom: 8px;">★★★★★</p>
          <a href="https://search.google.com/local/writereview?placeid=ChIJCiseau_Noir_Barbershop_Quebec"
            style="display: inline-block; background: #C9A84C; color: #0A0A0A; padding: 14px 32px; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; text-decoration: none; font-weight: 700;">
            Laisser un avis Google
          </a>
        </div>

        <p style="color: #444; font-size: 13px; text-align: center; margin-bottom: 24px;">
          Vous pouvez aussi nous retrouver sur
          <a href="https://www.facebook.com/profile.php?id=61575695811602" style="color: #C9A84C; text-decoration: none;">Facebook</a>.
        </p>

        <p style="color: #333; font-size: 12px; text-align: center;">© 2026 Ciseau Noir Barbershop — 375 Bd des Chutes, Québec</p>
      </div>
    `,
  });
}

export async function sendRebookingEmail(booking: {
  client_name: string;
  client_email: string;
  barber: string;
}) {
  const barberParam = booking.barber.toLowerCase().includes("melynda") ? "melynda" : "diodis";
  const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/booking?barber=${barberParam}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: booking.client_email,
    subject: `Prêt pour votre prochaine coupe ? ✂️`,
    html: `
      <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 48px 32px; max-width: 560px; margin: 0 auto;">
        <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Ciseau Noir</p>
        <h1 style="font-weight: 300; font-size: 24px; letter-spacing: 3px; margin-bottom: 8px; color: #F5F5F5;">On vous a pas oublié !</h1>
        <div style="width: 40px; height: 2px; background: #C9A84C; margin-bottom: 32px;"></div>

        <p style="color: #999; font-size: 15px; line-height: 1.8; margin-bottom: 32px;">
          Bonjour ${booking.client_name},<br><br>
          Ça fait 3 semaines depuis votre dernière coupe avec <strong style="color: #F5F5F5;">${booking.barber}</strong>.<br>
          Le moment idéal pour un rafraîchissement !
        </p>

        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${bookingUrl}"
             style="display: inline-block; background: #C9A84C; color: #0A0A0A; padding: 16px 40px; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; text-decoration: none; font-weight: 700; border-radius: 4px;">
            Reprendre un RDV avec ${booking.barber}
          </a>
        </div>

        <p style="color: #333; font-size: 12px; text-align: center;">© 2026 Ciseau Noir Barbershop — 375 Bd des Chutes, Québec</p>
      </div>
    `,
  });
}

export async function sendReengagementEmail(params: {
  client_name: string;
  client_email: string;
  barber: string;
  variant: 30 | 60 | 90;
}) {
  const barberParam = params.barber.toLowerCase().includes("melynda") ? "melynda" : "diodis";
  const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/booking?barber=${barberParam}`;

  const variants: Record<30 | 60 | 90, { subject: string; heading: string; body: string; cta: string }> = {
    30: {
      subject: "Ça fait un mois — On vous attend ! ✂️",
      heading: "Ça fait déjà un mois !",
      body: `Bonjour ${params.client_name},<br><br>Un mois s'est écoulé depuis votre dernière visite avec <strong style="color: #F5F5F5;">${params.barber}</strong>.<br>Votre coiffure a sûrement besoin d'un petit rafraîchissement !`,
      cta: "Réserver maintenant",
    },
    60: {
      subject: "On ne vous a pas vu depuis 2 mois ! ✂️",
      heading: "Vous nous manquez !",
      body: `Bonjour ${params.client_name},<br><br>Ça fait 2 mois qu'on ne vous a pas vu chez Ciseau Noir.<br>Votre barbier <strong style="color: #F5F5F5;">${params.barber}</strong> vous attend pour votre prochaine coupe !`,
      cta: "Revenir nous voir",
    },
    90: {
      subject: "3 mois sans vous — Revenez ! ✂️",
      heading: "Ça fait 3 mois !",
      body: `Bonjour ${params.client_name},<br><br>Trois mois déjà depuis votre dernière visite avec <strong style="color: #F5F5F5;">${params.barber}</strong>.<br>Revenez nous voir — on a hâte de vous retrouver !`,
      cta: "Réserver ma place",
    },
  };

  const v = variants[params.variant];

  await resend.emails.send({
    from: FROM_EMAIL,
    to: params.client_email,
    subject: v.subject,
    html: `
      <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 48px 32px; max-width: 560px; margin: 0 auto;">
        <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Ciseau Noir</p>
        <h1 style="font-weight: 300; font-size: 24px; letter-spacing: 3px; margin-bottom: 8px; color: #F5F5F5;">${v.heading}</h1>
        <div style="width: 40px; height: 2px; background: #C9A84C; margin-bottom: 32px;"></div>

        <p style="color: #999; font-size: 15px; line-height: 1.8; margin-bottom: 32px;">
          ${v.body}
        </p>

        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${bookingUrl}"
             style="display: inline-block; background: #C9A84C; color: #0A0A0A; padding: 16px 40px; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; text-decoration: none; font-weight: 700; border-radius: 4px;">
            ${v.cta}
          </a>
        </div>

        <p style="color: #333; font-size: 12px; text-align: center;">© 2026 Ciseau Noir Barbershop — 375 Bd des Chutes, Québec</p>
      </div>
    `,
  });
}

export async function sendNoShowAdminNotification(booking: {
  client_name: string;
  client_phone: string;
  client_email: string;
  service: string;
  barber: string;
  date: string;
  time: string;
}) {
  const dateFormatted = new Date(booking.date + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `No-show — ${booking.client_name} — ${dateFormatted} à ${booking.time}`,
    html: `
      <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 32px; max-width: 560px; margin: 0 auto;">
        <p style="color: #e55; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 16px;">No-Show</p>
        <h1 style="font-weight: 300; font-size: 24px; letter-spacing: 3px; margin-bottom: 8px; color: #F5F5F5;">Client absent</h1>
        <div style="width: 40px; height: 2px; background: #e55; margin-bottom: 32px;"></div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #1A1A1A;">
            <td style="color: #555; font-size: 12px; padding: 10px 0; text-transform: uppercase; letter-spacing: 1px;">Client</td>
            <td style="color: #F5F5F5; font-size: 14px; padding: 10px 0; text-align: right;">${booking.client_name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #1A1A1A;">
            <td style="color: #555; font-size: 12px; padding: 10px 0; text-transform: uppercase; letter-spacing: 1px;">Téléphone</td>
            <td style="color: #F5F5F5; font-size: 14px; padding: 10px 0; text-align: right;">${booking.client_phone}</td>
          </tr>
          <tr style="border-bottom: 1px solid #1A1A1A;">
            <td style="color: #555; font-size: 12px; padding: 10px 0; text-transform: uppercase; letter-spacing: 1px;">Service</td>
            <td style="color: #F5F5F5; font-size: 14px; padding: 10px 0; text-align: right;">${booking.service}</td>
          </tr>
          <tr style="border-bottom: 1px solid #1A1A1A;">
            <td style="color: #555; font-size: 12px; padding: 10px 0; text-transform: uppercase; letter-spacing: 1px;">Barbier</td>
            <td style="color: #F5F5F5; font-size: 14px; padding: 10px 0; text-align: right;">${booking.barber}</td>
          </tr>
          <tr>
            <td style="color: #555; font-size: 12px; padding: 10px 0; text-transform: uppercase; letter-spacing: 1px;">Date</td>
            <td style="color: #e55; font-size: 14px; padding: 10px 0; text-align: right;">${dateFormatted} à ${booking.time}</td>
          </tr>
        </table>
      </div>
    `,
  });
}

export async function sendWeeklyReportEmail(report: {
  startDate: string;
  endDate: string;
  totalBookings: number;
  totalRevenue: number;
  cancellations: number;
  noShows: number;
  newWaitlist: number;
  bookingsMelynda: number;
  bookingsDiodis: number;
}) {
  const startFormatted = new Date(report.startDate + "T12:00:00").toLocaleDateString("fr-CA", {
    day: "numeric", month: "long",
  });
  const endFormatted = new Date(report.endDate + "T12:00:00").toLocaleDateString("fr-CA", {
    day: "numeric", month: "long", year: "numeric",
  });

  const statRow = (label: string, value: string, color = "#F5F5F5") => `
    <tr style="border-bottom: 1px solid #1A1A1A;">
      <td style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; padding: 14px 0;">${label}</td>
      <td style="color: ${color}; font-size: 16px; padding: 14px 0; text-align: right; font-weight: 300;">${value}</td>
    </tr>`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `Rapport hebdomadaire — ${startFormatted} au ${endFormatted}`,
    html: `
      <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 48px 32px; max-width: 560px; margin: 0 auto;">
        <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Ciseau Noir</p>
        <h1 style="font-weight: 300; font-size: 24px; letter-spacing: 3px; margin-bottom: 8px; color: #F5F5F5;">Rapport hebdomadaire</h1>
        <div style="width: 40px; height: 2px; background: #C9A84C; margin-bottom: 16px;"></div>
        <p style="color: #666; font-size: 13px; margin-bottom: 32px;">${startFormatted} au ${endFormatted}</p>

        <div style="background: #111; border: 1px solid #1A1A1A; padding: 24px; margin-bottom: 24px;">
          <p style="color: #C9A84C; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 16px;">Statistiques</p>
          <table style="width: 100%; border-collapse: collapse;">
            ${statRow("Réservations", `${report.totalBookings} réservations cette semaine`, "#C9A84C")}
            ${statRow("Revenus", `${report.totalRevenue.toFixed(2)}$`, "#C9A84C")}
            ${statRow("Annulations", String(report.cancellations), report.cancellations > 0 ? "#e55" : "#5a5")}
            ${statRow("No-shows", String(report.noShows), report.noShows > 0 ? "#e55" : "#5a5")}
            ${statRow("Liste d'attente", `${report.newWaitlist} nouvelle${report.newWaitlist > 1 ? "s" : ""} inscription${report.newWaitlist > 1 ? "s" : ""}`)}
          </table>
        </div>

        <div style="background: #111; border: 1px solid #1A1A1A; padding: 24px; margin-bottom: 32px;">
          <p style="color: #C9A84C; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 16px;">Par barbier</p>
          <table style="width: 100%; border-collapse: collapse;">
            ${statRow("Melynda", `${report.bookingsMelynda} réservation${report.bookingsMelynda > 1 ? "s" : ""}`)}
            ${statRow("Diodis", `${report.bookingsDiodis} réservation${report.bookingsDiodis > 1 ? "s" : ""}`)}
          </table>
        </div>

        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://ciseunoirbarbershop.com"}/admin"
             style="display: inline-block; background: #C9A84C; color: #0A0A0A; padding: 14px 36px; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; text-decoration: none; font-weight: 700; border-radius: 4px;">
            Voir le tableau de bord
          </a>
        </div>

        <p style="color: #444; font-size: 12px; text-align: center;">&copy; 2026 Ciseau Noir Barbershop</p>
      </div>
    `,
  });
}

export async function sendReferralEmail(params: {
  referrer_name: string;
  referred_name: string;
  referred_email: string;
  code: string;
}) {
  const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://ciseunoirbarbershop.com"}/booking`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: params.referred_email,
    subject: `${params.referrer_name} vous offre 5$ de rabais chez Ciseau Noir !`,
    html: `
      <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 48px 32px; max-width: 560px; margin: 0 auto;">
        <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Ciseau Noir</p>
        <h1 style="font-weight: 300; font-size: 24px; letter-spacing: 3px; margin-bottom: 8px; color: #F5F5F5;">Vous avez été référé(e) !</h1>
        <div style="width: 40px; height: 2px; background: #C9A84C; margin-bottom: 32px;"></div>

        <p style="color: #999; font-size: 15px; line-height: 1.8; margin-bottom: 32px;">
          Bonjour ${params.referred_name},<br><br>
          Votre ami(e) <strong style="color: #F5F5F5;">${params.referrer_name}</strong> vous offre <strong style="color: #C9A84C;">5$ de rabais</strong> sur votre première visite chez Ciseau Noir !
        </p>

        <div style="background: #111; border: 1px solid #1A1A1A; padding: 24px; margin-bottom: 32px; text-align: center;">
          <p style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;">Votre code de parrainage</p>
          <p style="color: #C9A84C; font-size: 28px; font-weight: 300; letter-spacing: 6px; margin: 0;">${params.code}</p>
        </div>

        <p style="color: #888; font-size: 13px; margin-bottom: 32px; text-align: center;">
          Mentionnez ce code lors de votre réservation pour obtenir votre rabais.<br>
          Votre ami(e) recevra aussi 5$ de rabais sur sa prochaine visite !
        </p>

        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${bookingUrl}"
             style="display: inline-block; background: #C9A84C; color: #0A0A0A; padding: 16px 40px; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; text-decoration: none; font-weight: 700; border-radius: 4px;">
            Réserver maintenant
          </a>
        </div>

        <div style="background: #111; border-left: 2px solid #C9A84C; padding: 16px 20px; margin-bottom: 24px;">
          <p style="color: #888; font-size: 13px; margin: 0; line-height: 1.7;">
            375 Bd des Chutes, Québec, QC G1E 3G1<br>
            (418) 665-5703
          </p>
        </div>

        <p style="color: #333; font-size: 12px; text-align: center;">&copy; 2026 Ciseau Noir Barbershop</p>
      </div>
    `,
  });
}

export async function sendFirstVisitPromoEmail(params: {
  client_name: string;
  client_email: string;
  barber: string;
  promo_code: string;
}) {
  const barberParam = params.barber.toLowerCase().includes("melynda") ? "melynda" : "diodis";
  const bookingUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://ciseunoirbarbershop.com"}/booking?barber=${barberParam}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: params.client_email,
    subject: `Merci pour votre première visite — 10% de rabais pour vous !`,
    html: `
      <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 48px 32px; max-width: 560px; margin: 0 auto;">
        <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">Ciseau Noir</p>
        <h1 style="font-weight: 300; font-size: 24px; letter-spacing: 3px; margin-bottom: 8px; color: #F5F5F5;">Merci pour votre première visite !</h1>
        <div style="width: 40px; height: 2px; background: #C9A84C; margin-bottom: 32px;"></div>

        <p style="color: #999; font-size: 15px; line-height: 1.8; margin-bottom: 32px;">
          Bonjour ${params.client_name},<br><br>
          Nous sommes ravis de vous avoir accueilli(e) chez Ciseau Noir avec <strong style="color: #F5F5F5;">${params.barber}</strong>.<br><br>
          Pour vous remercier, voici un code de <strong style="color: #C9A84C;">10% de rabais</strong> sur votre prochaine visite :
        </p>

        <div style="background: #111; border: 1px solid #1A1A1A; padding: 24px; margin-bottom: 32px; text-align: center;">
          <p style="color: #555; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;">Votre code promo</p>
          <p style="color: #C9A84C; font-size: 28px; font-weight: 300; letter-spacing: 6px; margin: 0;">${params.promo_code}</p>
          <p style="color: #666; font-size: 12px; margin-top: 12px;">10% de rabais sur votre prochaine visite</p>
        </div>

        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${bookingUrl}"
             style="display: inline-block; background: #C9A84C; color: #0A0A0A; padding: 16px 40px; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; text-decoration: none; font-weight: 700; border-radius: 4px;">
            Réserver ma prochaine visite
          </a>
        </div>

        <p style="color: #888; font-size: 13px; margin-bottom: 32px; text-align: center;">
          Mentionnez ce code lors de votre prochaine réservation.<br>
          Valide pour une utilisation unique.
        </p>

        <p style="color: #333; font-size: 12px; text-align: center;">&copy; 2026 Ciseau Noir Barbershop — 375 Bd des Chutes, Québec</p>
      </div>
    `,
  });
}

export async function sendContactNotification(contact: {
  name: string;
  email: string;
  message: string;
}) {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    replyTo: contact.email,
    subject: `Message de ${contact.name} — Ciseau Noir`,
    html: `
      <div style="font-family: Georgia, serif; background: #0A0A0A; color: #F5F5F5; padding: 32px; max-width: 560px; margin: 0 auto;">
        <p style="color: #C9A84C; letter-spacing: 4px; font-size: 11px; text-transform: uppercase; margin-bottom: 16px;">Nouveau message — Ciseau Noir</p>
        <p style="color: #999; margin-bottom: 8px;"><strong style="color: #F5F5F5;">Nom :</strong> ${contact.name}</p>
        <p style="color: #999; margin-bottom: 16px;"><strong style="color: #F5F5F5;">Courriel :</strong> ${contact.email}</p>
        <div style="background: #111; border: 1px solid #1A1A1A; padding: 20px; margin-top: 16px;">
          <p style="color: #F5F5F5; font-size: 14px; line-height: 1.7; margin: 0;">${contact.message.replace(/\n/g, "<br>")}</p>
        </div>
        <p style="color: #444; font-size: 12px; margin-top: 24px;">Répondre directement à cet email pour contacter ${contact.name}.</p>
      </div>
    `,
  });
}
