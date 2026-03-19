import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  status: "confirmed" | "cancelled" | "completed";
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
