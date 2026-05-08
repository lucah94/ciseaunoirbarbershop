# Rapport de corrections de sécurité — Ciseau Noir

**Date** : 2026-04-10
**Projet** : ciseau-noir (Next.js)
**Statut final** : 0 vulnérabilité restante (`npm audit` propre)

---

## Résumé exécutif

Point de départ : **7 vulnérabilités** (1 critical, 2 high, 4 moderate)
Point d'arrivée : **0 vulnérabilité**

Toutes les CVE signalées ont été corrigées via `npm audit fix` et une mise à jour manuelle du SDK Anthropic.

---

## Vulnérabilités corrigées

### 1. CRITICAL — axios : NO_PROXY Hostname Normalization Bypass (SSRF)
- **ID** : GHSA-3p68-rc4w-qgx5
- **Avant** : axios < 1.15.0
- **Après** : mis à jour via `npm audit fix`
- **Impact** : bypass de NO_PROXY pouvant mener à un SSRF. Corrigé.

### 2. HIGH — path-to-regexp : Denial of Service (ReDoS)
- **IDs** : GHSA-j3q9-mxjg-w52f, GHSA-27v5-c462-wpq7
- **Avant** : path-to-regexp 8.0.0 - 8.3.0 (via router/express)
- **Après** : 8.4.2
- **Impact** : ReDoS via groupes optionnels séquentiels et wildcards multiples. Corrigé.

### 3. HIGH — picomatch : Method Injection + ReDoS
- **IDs** : GHSA-3v7f-55p6-f55p, GHSA-c2c7-rcm5-vvqj
- **Avant** : picomatch <= 2.3.1 et 4.0.0 - 4.0.3
- **Après** : 2.3.2 et 4.0.4
- **Impact** : injection de méthode via classes POSIX + ReDoS via extglob. Corrigé.

### 4. MODERATE — @anthropic-ai/sdk : Memory Tool Path Validation Sandbox Escape
- **ID** : GHSA-5474-4w2j-mq4c
- **Avant** : 0.80.0
- **Après** : **0.87.0** (mise à jour manuelle via `npm install @anthropic-ai/sdk@latest`)
- **Note** : mise à jour majeure (breaking change potentiel). Vérifié que tous les fichiers utilisant le SDK compilent sans erreur TypeScript :
  - `src/app/api/figaro/chat/route.ts`
  - `src/app/api/figaro/generate/route.ts`
  - `src/app/api/cron/check-emails/route.ts`
  - `src/app/api/admin/generate-post/route.ts`
  - `src/app/api/cron/auto-post/route.ts`
  - `src/app/api/meta/messenger/route.ts`
  - `src/app/api/contact/route.ts`
  - `src/app/api/expenses/analyze/route.ts`

### 5. MODERATE — hono : multiples CVE (cookie, path traversal, IP matching, etc.)
- **IDs** : GHSA-26pp-8wgv-hjvm, GHSA-r5rp-j6wh-rvv4, GHSA-xpcf-pg52-r92g, GHSA-xf4j-xp2r-rqqx, GHSA-wmmm-f939-6g9c
- **Avant** : hono <= 4.12.11
- **Après** : 4.12.12
- **Impact** : validation cookies, path traversal toSSG, IP matching IPv4-mapped IPv6, bypass middleware. Corrigé.

### 6. MODERATE — @hono/node-server : middleware bypass
- **ID** : GHSA-92pp-h63x-v22m
- **Avant** : < 1.19.13
- **Après** : 1.19.13
- **Impact** : bypass middleware via slashes répétés dans serveStatic. Corrigé.

### 7. MODERATE — brace-expansion : ReDoS / process hang
- **ID** : GHSA-f886-m6hf-6m8v
- **Avant** : < 1.1.13 ou 4.0.0 - 5.0.4
- **Après** : 1.1.13 et 5.0.5
- **Impact** : séquence zero-step provoquant hang process et épuisement mémoire. Corrigé.

---

## Analyse du risque XSS — src/components/JsonLd.tsx

**Conclusion : aucune correction nécessaire.**

Le fichier `src/components/JsonLd.tsx` utilise `dangerouslySetInnerHTML` pour injecter un objet JSON-LD Schema.org dans la page (données structurées SEO BarberShop). L'analyse confirme que ce n'est **pas un risque XSS réel** :

1. L'objet `structuredData` est un **littéral statique** défini dans le composant — aucune donnée utilisateur ou externe n'y est injectée.
2. `JSON.stringify` est appliqué à ce littéral, et JSON.stringify échappe correctement les caractères pour JSON-LD dans une balise `<script type="application/ld+json">`.
3. Le pattern `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}>` est le **pattern officiel recommandé par Next.js et Google** pour injecter du JSON-LD.
4. Documentation Next.js : https://nextjs.org/docs/app/guides/json-ld

**Recommandation défensive (optionnelle, non appliquée)** : si un jour `structuredData` devait contenir des chaînes dérivées de contenu utilisateur (reviews dynamiques par ex.), il faudrait échapper le caractère `<` dans le JSON sérialisé via `JSON.stringify(data).replace(/</g, '\\u003c')` pour empêcher une sortie prématurée du contexte `<script>`. À ce jour ce n'est pas applicable ici.

---

## Vérifications finales

```
npm audit
found 0 vulnerabilities
```

TypeScript : aucune erreur liée à la mise à jour @anthropic-ai/sdk 0.80 → 0.87. Une erreur préexistante et non-liée subsiste dans `src/app/api/cron/reminders/route.ts:182` (try sans catch/finally) — **hors scope** de cette tâche de sécurité, non introduite par ces correctifs.

---

## Commandes exécutées

```bash
npm audit                         # 7 vulnérabilités identifiées
npm audit fix                     # 6 corrigées automatiquement
npm install @anthropic-ai/sdk@latest  # 1 dernière corrigée (0.80.0 → 0.87.0)
npm audit                         # 0 vulnérabilité restante
```

## Fichiers modifiés

- `package.json` — version @anthropic-ai/sdk mise à jour
- `package-lock.json` — toutes les dépendances transitives mises à jour
- **Aucune modification de code source** (aucun fichier `src/` modifié)

## À noter pour la suite

- La mise à jour de `@anthropic-ai/sdk` vers 0.87.0 est un saut mineur-majeur dans le versioning pre-1.0. Tester manuellement les fonctionnalités qui utilisent le SDK (Figaro chat, génération de posts, analyse dépenses, Messenger bot, contact, cron emails) avant déploiement.
- L'erreur TypeScript préexistante dans `src/app/api/cron/reminders/route.ts` devrait être corrigée dans une tâche séparée.
