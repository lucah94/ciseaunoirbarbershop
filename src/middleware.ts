import { NextRequest, NextResponse } from "next/server";

// Protège les portails : /admin réservé à l'admin, /barber réservé aux barbiers.
// Sans le bon cookie d'auth → redirigé vers la page de connexion appropriée.
// (Les APIs vérifient le jeton en plus, côté serveur — ceci barre l'accès aux PAGES.)
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!req.cookies.get("admin_auth")) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/barber") && pathname !== "/barber/login") {
    if (!req.cookies.get("barber_auth")) {
      const url = req.nextUrl.clone();
      url.pathname = "/barber/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/barber", "/barber/:path*"],
};
