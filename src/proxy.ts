import { NextRequest, NextResponse } from "next/server";

const BAD_PATTERNS = [/\.\.\//,/<script/i,/union.*select/i,/\/etc\/passwd/i,/wp-admin/i,/\.php$/i];
const BAD_UAS = [/sqlmap/i,/nikto/i,/nmap/i,/masscan/i];

function getIP(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const ua = req.headers.get("user-agent") || "";

  if (BAD_UAS.some(p => p.test(ua))) return new NextResponse("Forbidden", { status: 403 });
  if (BAD_PATTERNS.some(p => p.test(pathname + search))) return new NextResponse("Bad Request", { status: 400 });

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const auth = req.cookies.get("admin_auth");
    if (!auth || auth.value !== "true") {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  if (pathname.startsWith("/barber") && !pathname.startsWith("/barber/login")) {
    const auth = req.cookies.get("barber_auth");
    if (!auth || auth.value !== "diodis") {
      return NextResponse.redirect(new URL("/barber/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)" ],
};
