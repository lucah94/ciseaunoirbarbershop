// Durée (en minutes) d'un service à partir de mots-clés dans son nom.
// Source unique de vérité — l'ordre des cas est important (shaver avant barbe, enfant avant coupe).
export function serviceDuration(service: string): number {
  const s = (service || "").toLowerCase();
  if (s.includes("premium") || s.includes("forfait")) return 75;
  if (s.includes("shaver") && s.includes("coupe")) return 45; // Coupe + Barbe Shaver = 45 min
  if ((s.includes("barbe") || s.includes("rasage") || s.includes("lame")) && s.includes("coupe")) return 60;
  if (s.includes("enfant") && !s.includes("coupe")) return 30; // service Enfant seul = 30 min
  if (s.includes("coupe") || s.includes("lavage") || s.includes("étudiant") || s.includes("etudiant") || s.includes("student") || s.includes("enfant")) return 45;
  return 30;
}
