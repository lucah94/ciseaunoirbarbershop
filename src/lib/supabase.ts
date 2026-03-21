import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Public client — used client-side and for reads that respect RLS anon policies
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client — uses service role key, bypasses RLS for server-side API routes
// NEVER import this in client components — only use in route handlers (server-side)
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnonKey
);

export type Booking = {
  id: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  barber: string;
  service: string;
  price: number;
  date: string;
  time: string;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  note: string;
  created_at: string;
};

export type Cut = {
  id: string;
  barber: string;
  service_name: string;
  price: number;
  tip: number;
  discount_percent: number;
  date: string;
  booking_id?: string;
  created_at: string;
};

export type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  created_at: string;
};
