// Secret de test global — évite que chaque test d'authentification doive le poser
// lui-même, et surtout évite de dépendre d'un repli codé en dur (l'ancien
// "ciseau-noir-fallback" retiré de src/lib/auth.ts le 25 sept 2026 : c'était une
// faille de sécurité, pas une commodité de test). Un environnement de test SANS
// secret configuré doit se comporter comme la vraie faille aurait dû se comporter :
// authentification refusée — voir tests/auth.test.ts pour ce cas précis.
if (!process.env.ADMIN_PASSWORD) {
  process.env.ADMIN_PASSWORD = "test-only-secret-never-used-in-prod";
}
