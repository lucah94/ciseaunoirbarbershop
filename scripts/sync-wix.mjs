#!/usr/bin/env node
// Usage: node scripts/sync-wix.mjs IST.votre-cle-api-wix
// Importe les nouveaux RDV Wix dans Supabase depuis le 24 mars 2026

import { createClient } from "@supabase/supabase-js";

const WIX_API_KEY = process.argv[2];
const WIX_SITE_ID = "a41bed47-dd0d-408b-a496-ff48dda7e0df";
const SUPABASE_URL = "https://kgkkwvchpghjdfajmrnz.supabase.co";
const SUPABASE_KEY = "sb_secret_3gQZcC6egE5Z-4aUdHWa1Q_D55tokdf";

// Import depuis cette date (lendemain du dernier import)
const IMPORT_FROM = "2026-03-24";

if (!WIX_API_KEY) {
  console.error("❌  Clé API manquante. Usage: node scripts/sync-wix.mjs IST.xxxx");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function mapService(service = "") {
  const s = service.toLowerCase();
  if (s.includes("enfant") || s.includes("child") || s.includes("kid")) return "Coupe enfant";
  if ((s.includes("coupe") || s.includes("haircut")) && (s.includes("barbe") || s.includes("beard"))) return "Coupe + Barbe";
  if (s.includes("barbe") || s.includes("beard") || s.includes("shave")) return "Barbe";
  return "Coupe homme";
}

function mapPrice(service = "") {
  const s = service.toLowerCase();
  if (s.includes("enfant") || s.includes("child") || s.includes("kid")) return 25;
  if ((s.includes("coupe") || s.includes("haircut")) && (s.includes("barbe") || s.includes("beard"))) return 50;
  if (s.includes("barbe") || s.includes("beard") || s.includes("shave")) return 20;
  return 35;
}

function mapBarber(staff = "") {
  const s = (staff || "").toLowerCase();
  if (s.includes("diodis") || s.includes("disponible") || s.includes("available") || !s) return "Diodis";
  return "Melynda";
}

function mapStatus(status = "") {
  const s = status.toUpperCase();
  if (s === "CANCELED" || s === "CANCELLED") return "cancelled";
  if (s === "CONFIRMED" || s === "APPROVED") return "confirmed";
  if (s === "PENDING") return "pending";
  return "confirmed";
}

async function fetchWixBookings() {
  console.log("📡 Récupération des RDV Wix depuis", IMPORT_FROM, "...");

  let allBookings = [];
  let cursor = null;

  do {
    const body = {
      query: {
        filter: {
          "startDate": { "$gte": new Date(IMPORT_FROM + "T00:00:00Z").toISOString() }
        },
        sort: [{ fieldName: "startDate", order: "ASC" }],
        paging: { limit: 100, ...(cursor ? { cursor } : {}) }
      }
    };

    const res = await fetch("https://www.wixapis.com/bookings/v2/bookings/query", {
      method: "POST",
      headers: {
        "Authorization": WIX_API_KEY,
        "wix-site-id": WIX_SITE_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Wix API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const bookings = data.bookings || [];
    allBookings = [...allBookings, ...bookings];

    cursor = data.pagingMetadata?.cursors?.next || null;
    console.log(`   → ${bookings.length} RDV récupérés (total: ${allBookings.length})`);

    if (bookings.length < 100) break;
  } while (cursor);

  return allBookings;
}

async function syncToSupabase(wixBookings) {
  console.log(`\n📥 Import de ${wixBookings.length} RDV dans Supabase...`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const wb of wixBookings) {
    try {
      const startDate = new Date(wb.startDate || wb.bookedEntity?.slot?.startDate);
      const date = startDate.toISOString().slice(0, 10);
      const h = startDate.toLocaleString("en-CA", { hour: "2-digit", hour12: false, timeZone: "America/Toronto" }).padStart(2, "0");
      const min = String(startDate.getMinutes()).padStart(2, "0");
      const time = `${h}:${min}`;

      const contactInfo = wb.contactDetails || wb.bookedEntity?.contactDetails || {};
      const clientName = [contactInfo.firstName, contactInfo.lastName].filter(Boolean).join(" ") || "Client Wix";
      const clientPhone = contactInfo.phone || "";
      const clientEmail = contactInfo.email || "";

      const serviceName = wb.bookedEntity?.title || wb.title || "";
      const service = mapService(serviceName);
      const price = mapPrice(serviceName);

      const staffName = wb.bookedEntity?.slot?.resource?.name || wb.staffMember?.name || "";
      const barber = mapBarber(staffName);
      const status = mapStatus(wb.status);

      // Check if already exists (by date + time + client name)
      const { data: existing } = await supabase
        .from("bookings")
        .select("id")
        .eq("date", date)
        .eq("time", time)
        .ilike("client_name", clientName)
        .limit(1);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from("bookings").insert({
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail,
        service,
        barber,
        date,
        time,
        price,
        status,
      });

      if (error) {
        console.error(`   ❌ Erreur ${clientName} ${date} ${time}:`, error.message);
        errors++;
      } else {
        imported++;
        if (imported <= 5) {
          console.log(`   ✓ ${clientName} — ${service} le ${date} à ${time} (${barber})`);
        }
      }
    } catch (e) {
      errors++;
      console.error(`   ❌ Erreur parsing:`, e.message);
    }
  }

  console.log(`\n✅ Import terminé:`);
  console.log(`   • ${imported} nouveaux RDV importés`);
  console.log(`   • ${skipped} RDV déjà présents (ignorés)`);
  if (errors > 0) console.log(`   • ${errors} erreurs`);
}

// Main
try {
  const wixBookings = await fetchWixBookings();
  if (wixBookings.length === 0) {
    console.log("ℹ️  Aucun RDV trouvé depuis le", IMPORT_FROM);
    process.exit(0);
  }
  await syncToSupabase(wixBookings);
} catch (e) {
  console.error("❌ Erreur:", e.message);
  process.exit(1);
}
