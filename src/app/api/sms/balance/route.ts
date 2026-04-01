import { NextResponse } from "next/server";
import twilio from "twilio";

export async function GET() {
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
    const balance = await client.api.v2010.accounts(process.env.TWILIO_ACCOUNT_SID!).balance.fetch();
    return NextResponse.json({ balance: parseFloat(balance.balance), currency: balance.currency });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
