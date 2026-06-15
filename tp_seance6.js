const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageBreak
} = require('docx');
const fs = require('fs');

const BLUE  = "1F4E79"; const LBLUE = "D5E8F0"; const GREEN = "E2EFDA";
const RED   = "FCE4D6"; const YEL   = "FFF2CC"; const GRAY  = "F2F2F2";
const ORANGE= "FCE9D5";

const border = { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" };
const borders = { top: border, bottom: border, left: border, right: border };
const cm = { top: 80, bottom: 80, left: 120, right: 120 };

function h1(text) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text, bold: true, color: BLUE, size: 28 })] }); }
function h2(text) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text, bold: true, color: "2E75B6", size: 24 })] }); }
function h3(text) { return new Paragraph({ children: [new TextRun({ text, bold: true, size: 22 })], spacing: { before: 200, after: 100 } }); }
function para(text, opts = {}) { return new Paragraph({ children: [new TextRun({ text, size: 20, ...opts })], spacing: { after: 100 } }); }
function bullet(text) { return new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text, size: 19 })], spacing: { after: 80 } }); }
function space() { return new Paragraph({ children: [new TextRun("")], spacing: { after: 80 } }); }
function cell(text, fill = "FFFFFF", bold = false, w = 2000) {
  return new TableCell({ borders, width: { size: w, type: WidthType.DXA }, shading: { fill, type: ShadingType.CLEAR }, margins: cm, children: [new Paragraph({ children: [new TextRun({ text, size: 17, bold })] })] });
}
function cellW(lines, fill = "FFFFFF", w = 2000) {
  return new TableCell({ borders, width: { size: w, type: WidthType.DXA }, shading: { fill, type: ShadingType.CLEAR }, margins: cm, children: lines.map(l => new Paragraph({ children: [new TextRun({ text: l, size: 17 })], spacing: { after: 50 } })) });
}
function hRow(cols, widths) { return new TableRow({ tableHeader: true, children: cols.map((c, i) => cell(c, LBLUE, true, widths[i])) }); }

// ══════════════════════════════════════════════════════════════════════════════
// TP 6.1 — Contrat d'API complet
// ══════════════════════════════════════════════════════════════════════════════
const tp61 = [
  h1("TP 6.1 — Spécification d'API — Contrat Complet"),
  space(),
  para("Contrat d'API complet pour les trois services du Système de Gestion Documentaire Distribué (SGDD). Tous les endpoints incluent leur méthode, payloads, codes d'erreur, idempotence et mesures de sécurité."),
  space(),

  h2("Service Auth — /api/v1/auth"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1600, 700, 1400, 1500, 1400, 800, 1960],
    rows: [
      hRow(["Endpoint","Méthode","Entrée (JSON)","Sortie (JSON)","Codes d'erreur","Idempotent?","Sécurité"], [1600,700,1400,1500,1400,800,1960]),

      new TableRow({ children: [
        cell("/api/v1/auth/login",GRAY,true,1600),
        cell("POST",LBLUE,true,700),
        cellW(['{','  "username": string,','  "password": string','}'],GRAY,1400),
        cellW(['{','  "token": string (JWT),','  "expires_at": string (ISO8601),','  "user_id": string (UUID)','}'],GREEN,1500),
        cellW(["400 — champs manquants","401 — credentials invalides","429 — brute force détecté"],RED,1400),
        cell("❌ Non\n(génère nouveau token)",YEL,false,800),
        cellW(["Rate limiting: 5 req/min/IP","Message d'erreur générique (ne pas distinguer user inconnu / mauvais mdp)","TLS obligatoire","Token JWT signé HS256, durée 1h"],GRAY,1960),
      ]}),

      new TableRow({ children: [
        cell("/api/v1/auth/verify",GRAY,true,1600),
        cell("GET",LBLUE,true,700),
        cellW(["Header uniquement:","Authorization: Bearer <token>"],GRAY,1400),
        cellW(['{','  "valid": boolean,','  "user_id": string,','  "roles": [string]','}'],GREEN,1500),
        cellW(["401 — token manquant","401 — token expiré","401 — signature invalide"],RED,1400),
        cell("✅ Oui\n(lecture seule)",GREEN,false,800),
        cellW(["Utilisé par les services internes (inter-service)","Vérification de signature JWT locale (clé publique)","Ne pas logger le contenu du token"],GRAY,1960),
      ]}),

      new TableRow({ children: [
        cell("/api/v1/auth/logout",GRAY,true,1600),
        cell("POST",LBLUE,true,700),
        cellW(["Header:","Authorization: Bearer <token>","(pas de body requis)"],GRAY,1400),
        cellW(['{','  "message": "Déconnexion réussie"','}'],GREEN,1500),
        cellW(["401 — token invalide ou déjà révoqué"],RED,1400),
        cell("✅ Oui\n(révoquer 2× = même résultat)",GREEN,false,800),
        cellW(["Ajouter le token à une blocklist Redis (TTL = durée restante du token)","Audit log : user_id, timestamp, IP"],GRAY,1960),
      ]}),

      new TableRow({ children: [
        cell("/api/v1/auth/refresh",GRAY,true,1600),
        cell("POST",LBLUE,true,700),
        cellW(['{','  "refresh_token": string','}'],GRAY,1400),
        cellW(['{','  "token": string (nouveau JWT),','  "expires_at": string','}'],GREEN,1500),
        cellW(["400 — refresh_token manquant","401 — refresh_token expiré / invalide","429 — trop de refreshes"],RED,1400),
        cell("❌ Non\n(génère nouveau access token)",YEL,false,800),
        cellW(["Refresh token à usage unique (rotation)","Rate limiting: 10 req/min/user","Refresh token durée 7 jours, stocké côté client uniquement"],GRAY,1960),
      ]}),
    ]
  }),
  space(),

  h2("Service Documents — /api/v1/documents"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1600, 700, 1400, 1500, 1400, 800, 1960],
    rows: [
      hRow(["Endpoint","Méthode","Entrée (JSON)","Sortie (JSON)","Codes d'erreur","Idempotent?","Sécurité"], [1600,700,1400,1500,1400,800,1960]),

      new TableRow({ children: [
        cell("/api/v1/documents",GRAY,true,1600),
        cell("POST",LBLUE,true,700),
        cellW(['{','  "title": string (1-200 car.),','  "content": string (max 50000),','  "tags": [string] (opt., max 10),','  "visibility": "public"|"private"|"team"','}','Header: Idempotency-Key: <uuid>'],GRAY,1400),
        cellW(['{','  "id": string (UUID v4),','  "title": string,','  "visibility": string,','  "created_at": string (ISO8601),','  "author_id": string','}'],GREEN,1500),
        cellW(["400 — validation échouée (champs manquants, format)","401 — non authentifié","403 — rôle insuffisant (rôle éditeur requis)","409 — Idempotency-Key déjà traitée (renvoie doc existant)","413 — contenu trop grand"],RED,1400),
        cell("❌ Non\nMAIS safe si Idempotency-Key fournie",YEL,false,800),
        cellW(["AuthN (JWT) + AuthZ (rôle éditeur)","Validation stricte tous les champs","Idempotency-Key UUID côté client, stocké Redis 24h","Taille max du content vérifiée côté serveur"],GRAY,1960),
      ]}),

      new TableRow({ children: [
        cell("/api/v1/documents",GRAY,true,1600),
        cell("GET",LBLUE,true,700),
        cellW(["Query params:","page=1, per_page=20 (max 100)","sort=created_at, order=desc","tag=string (filtre optionnel)","visibility=public|private"],GRAY,1400),
        cellW(['{','  "data": [{ id, title, created_at }],','  "total": int,','  "page": int,','  "per_page": int,','  "total_pages": int','}'],GREEN,1500),
        cellW(["400 — paramètres invalides (per_page > 100)","401 — non authentifié"],RED,1400),
        cell("✅ Oui",GREEN,false,800),
        cellW(["AuthN requise","Pagination obligatoire (max 100 forcé côté serveur même si client demande plus)","Les documents privés d'autres users sont exclus des résultats"],GRAY,1960),
      ]}),

      new TableRow({ children: [
        cell("/api/v1/documents/{id}",GRAY,true,1600),
        cell("GET",LBLUE,true,700),
        cellW(["Path param: id (UUID v4)","Header: Authorization: Bearer <token>"],GRAY,1400),
        cellW(['{','  "id": string,','  "title": string,','  "content": string,','  "tags": [string],','  "visibility": string,','  "created_at": string,','  "updated_at": string,','  "author_id": string','}'],GREEN,1500),
        cellW(["401 — non authentifié","403 — document privé d'un autre user","404 — document inexistant (réponse identique si doc existe mais non autorisé → anti-enumeration)"],RED,1400),
        cell("✅ Oui",GREEN,false,800),
        cellW(["AuthN + AuthZ (propriétaire ou rôle lecteur)","UUID v4 pour l'ID (non prédictible, anti-enumeration)","Réponse 404 identique si interdit OU inexistant (constant-time response)"],GRAY,1960),
      ]}),

      new TableRow({ children: [
        cell("/api/v1/documents/{id}",GRAY,true,1600),
        cell("PUT",LBLUE,true,700),
        cellW(['{','  "title": string (1-200 car.),','  "content": string (max 50000),','  "tags": [string] (opt.),','  "visibility": "public"|"private"|"team"','}'],GRAY,1400),
        cellW(['{','  "id": string,','  "title": string,','  "updated_at": string,','  "version": int','}'],GREEN,1500),
        cellW(["400 — validation échouée","401 — non authentifié","403 — pas propriétaire ni éditeur","404 — document inexistant","409 — conflit de version (If-Match header)"],RED,1400),
        cell("✅ Oui\n(remplacement complet)",GREEN,false,800),
        cellW(["AuthN + AuthZ (propriétaire ou rôle éditeur)","Header If-Match: <etag> pour détecter les conflits de version concurrente","Audit log à chaque modification"],GRAY,1960),
      ]}),

      new TableRow({ children: [
        cell("/api/v1/documents/{id}",GRAY,true,1600),
        cell("DELETE",LBLUE,true,700),
        cellW(["Path param: id (UUID v4)","(pas de body)"],GRAY,1400),
        cellW(["204 No Content","(pas de body sur succès)"],GREEN,1500),
        cellW(["401 — non authentifié","403 — pas propriétaire ni admin","404 — document inexistant"],RED,1400),
        cell("✅ Oui\n(supprimer déjà supprimé → 404)",GREEN,false,800),
        cellW(["AuthN + AuthZ (propriétaire ou rôle admin uniquement)","Soft delete (archivage) recommandé plutôt que suppression physique","Audit log obligatoire : qui, quand, quel doc"],GRAY,1960),
      ]}),
    ]
  }),
  space(),

  h2("Service Recherche — /api/v1/search"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1800, 700, 1500, 1700, 1400, 800, 1460],
    rows: [
      hRow(["Endpoint","Méthode","Entrée","Sortie (JSON)","Codes d'erreur","Idempotent?","Sécurité"], [1800,700,1500,1700,1400,800,1460]),
      new TableRow({ children: [
        cell("/api/v1/search",GRAY,true,1800),
        cell("GET",LBLUE,true,700),
        cellW(["Query params:","q=string (requis, min 2 car.)","page=1, per_page=20 (max 50)","tag=string (filtre optionnel)","date_from=ISO8601 (optionnel)","date_to=ISO8601 (optionnel)"],GRAY,1500),
        cellW(['{','  "results": [{','    "id": string,','    "title": string,','    "excerpt": string,','    "score": float,','    "created_at": string','  }],','  "total": int,','  "page": int,','  "query_time_ms": int','}'],GREEN,1700),
        cellW(["400 — query vide ou trop courte (< 2 car.)","400 — paramètres invalides","401 — non authentifié","429 — rate limit (requêtes coûteuses)"],RED,1400),
        cell("✅ Oui",GREEN,false,800),
        cellW(["AuthN requise","Rate limiting strict: 20 req/min/user","Résultats filtrés selon AuthZ (user voit seulement ses docs + docs publics)","Max per_page=50 forcé côté serveur","Timeout serveur: 8s"],GRAY,1460),
      ]}),
    ]
  }),
  space(),

  h2("Headers requis sur tous les endpoints protégés"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2500, 3360, 3500],
    rows: [
      hRow(["Header","Valeur / Format","Rôle"], [2500,3360,3500]),
      new TableRow({ children: [cell("Authorization",GRAY,false,2500), cell("Bearer <JWT_token>",GRAY,false,3360), cell("Authentification — présent sur tous les endpoints sauf /health",GRAY,false,3500)] }),
      new TableRow({ children: [cell("Content-Type",GRAY,false,2500), cell("application/json",GRAY,false,3360), cell("Obligatoire sur POST, PUT, PATCH",GRAY,false,3500)] }),
      new TableRow({ children: [cell("X-Request-Id",GRAY,false,2500), cell("<UUID v4> généré côté client",GRAY,false,3360), cell("Corrélation ID — propagé à travers tous les services pour le tracing",GRAY,false,3500)] }),
      new TableRow({ children: [cell("Idempotency-Key",GRAY,false,2500), cell("<UUID v4> généré côté client",GRAY,false,3360), cell("Obligatoire sur POST /documents pour éviter les doublons en cas de retry",GRAY,false,3500)] }),
    ]
  }),
  space(),
];

// ══════════════════════════════════════════════════════════════════════════════
// TP 6.2 — Fiabilité côté client
// ══════════════════════════════════════════════════════════════════════════════
const tp62 = [
  new Paragraph({ children: [new PageBreak()] }),
  h1("TP 6.2 — Politiques de Fiabilité Côté Client"),
  space(),

  h2("Politiques de fiabilité par service"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1600, 1100, 1200, 1100, 1100, 1500, 1760],
    rows: [
      hRow(["Service / Opération","Timeout","Max retries","Base delay","Max delay","Codes retryables","Idempotency key?"], [1600,1100,1200,1100,1100,1500,1760]),
      new TableRow({ children: [cell("Auth — login",GRAY,false,1600), cell("5s",GRAY,false,1100), cell("1 (seulement sur 5xx réseau)",YEL,false,1200), cell("1s",GRAY,false,1100), cell("5s",GRAY,false,1100), cell("502, 503, 504",GRAY,false,1500), cell("Non (side effect critique: log attendu même en echec)",GRAY,false,1760)] }),
      new TableRow({ children: [cell("Auth — verify",GRAY,false,1600), cell("3s",GRAY,false,1100), cell("2",GREEN,false,1200), cell("0.5s",GRAY,false,1100), cell("5s",GRAY,false,1100), cell("502, 503, 504",GRAY,false,1500), cell("Non (GET idempotent)",GRAY,false,1760)] }),
      new TableRow({ children: [cell("Auth — logout",GRAY,false,1600), cell("5s",GRAY,false,1100), cell("2",GREEN,false,1200), cell("1s",GRAY,false,1100), cell("10s",GRAY,false,1100), cell("502, 503, 504",GRAY,false,1500), cell("Non (idempotent nativement)",GRAY,false,1760)] }),
      new TableRow({ children: [cell("Documents — GET (liste / par id)",GRAY,false,1600), cell("10s",GRAY,false,1100), cell("2",GREEN,false,1200), cell("1s",GRAY,false,1100), cell("30s",GRAY,false,1100), cell("500, 502, 503, 504",GRAY,false,1500), cell("Non (lecture idempotente)",GRAY,false,1760)] }),
      new TableRow({ children: [cell("Documents — POST (créer)",GRAY,false,1600), cell("15s",GRAY,false,1100), cell("0 (PAS de retry auto)",RED,false,1200), cell("—",GRAY,false,1100), cell("—",GRAY,false,1100), cell("Aucun (côté client)",GRAY,false,1500), cell("✅ OUI — UUID v4 généré avant l'envoi, inclus dans Idempotency-Key header",GREEN,true,1760)] }),
      new TableRow({ children: [cell("Documents — PUT (modifier)",GRAY,false,1600), cell("15s",GRAY,false,1100), cell("1 (seulement si 503)",YEL,false,1200), cell("2s",GRAY,false,1100), cell("10s",GRAY,false,1100), cell("503, 504",GRAY,false,1500), cell("Conditionnel — If-Match header utilisé pour éviter les conflits",YEL,false,1760)] }),
      new TableRow({ children: [cell("Documents — DELETE",GRAY,false,1600), cell("10s",GRAY,false,1100), cell("2",GREEN,false,1200), cell("1s",GRAY,false,1100), cell("15s",GRAY,false,1100), cell("500, 502, 503, 504",GRAY,false,1500), cell("Non (idempotent: supprimer 2× = même résultat)",GRAY,false,1760)] }),
      new TableRow({ children: [cell("Search — GET",GRAY,false,1600), cell("8s",GRAY,false,1100), cell("2",GREEN,false,1200), cell("1s",GRAY,false,1100), cell("20s",GRAY,false,1100), cell("502, 503",GRAY,false,1500), cell("Non (lecture, idempotente)",GRAY,false,1760)] }),
    ]
  }),
  space(),

  h2("Analyse des 3 scénarios de panne"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1600, 2260, 2500, 3000],
    rows: [
      hRow(["Scénario","Risque principal","Politique appliquée","Justification technique"], [1600,2260,2500,3000]),

      new TableRow({ children: [
        cell("S1 — Latence élevée\n(Document Service répond en 8-15s)",ORANGE,true,1600),
        cellW([
          "Blocage de threads / goroutines côté client attendant une réponse qui tarde.",
          "",
          "Resource starvation : si 100 clients attendent chacun 15s, toutes les connexions TCP sont épuisées.",
          "",
          "Effet cascade : d'autres services appelant le Document Service se retrouvent bloqués à leur tour (latence propagée).",
          "",
          "UX dégradée : spinner infini, utilisateur perd confiance."
        ],RED,2260),
        cellW([
          "1. Timeout strict à 10s sur le Document Service (read timeout).",
          "",
          "2. Circuit breaker : après 5 timeouts consécutifs, OUVERT pendant 30s.",
          "",
          "3. Fallback : retourner les métadonnées depuis le cache Redis (TTL 5 min) si disponible.",
          "",
          "4. Si cache vide : réponse dégradée 503 avec message 'Service temporairement lent — réessayez dans 30s'."
        ],YEL,2500),
        cellW([
          "Un timeout strict libère immédiatement le thread client, empêchant le resource starvation.",
          "",
          "Le circuit breaker évite de surcharger un service déjà en difficulté (la DB est surchargée : ne pas y ajouter des requêtes supplémentaires).",
          "",
          "Le fallback sur cache garantit une expérience dégradée mais fonctionnelle pour les données récentes.",
          "",
          "Sans ces mécanismes : un service lent peut immobiliser l'ensemble du système en quelques secondes."
        ],GREEN,3000),
      ]}),

      new TableRow({ children: [
        cell("S2 — Serveur intermittent\n(Search Service retourne 503 une fois sur trois)",ORANGE,true,1600),
        cellW([
          "1 requête sur 3 échoue → expérience utilisateur aléatoire et imprévisible.",
          "",
          "Sans retry : un tiers des recherches échouent définitivement, sans raison valable (erreur transitoire due au rolling update).",
          "",
          "Avec retry naïf (immédiat) : retry storm si tous les clients retentent en même temps dès que le 503 arrive."
        ],RED,2260),
        cellW([
          "1. Retry automatique sur code 503 uniquement (pas sur 400, 401, 404).",
          "",
          "2. Maximum 2 retries (3 tentatives au total).",
          "",
          "3. Backoff exponentiel : délai 1s → 2s (+ jitter ±30%).",
          "",
          "4. Jitter : random.uniform(0.7*delay, 1.3*delay) pour étaler les retries.",
          "",
          "5. Timeout par tentative : 8s."
        ],YEL,2500),
        cellW([
          "Un rolling update génère des erreurs transitoires sur les pods en cours de remplacement : exactement le cas d'usage des retries.",
          "",
          "2 retries suffisent : si le service est en rolling update, la 2e ou 3e tentative atteint un pod sain.",
          "",
          "Le backoff exponentiel évite de re-saturer le service au moment où il essaie de redémarrer.",
          "",
          "Le jitter (±30%) évite le thundering herd : si 500 clients subissent un 503 simultanément, sans jitter ils retentent tous à t=1s exactement."
        ],GREEN,3000),
      ]}),

      new TableRow({ children: [
        cell("S3 — Duplication de requêtes\n(double-clic, 2 POST /documents)",ORANGE,true,1600),
        cellW([
          "Deux documents identiques créés → données corrompues, expérience utilisateur confuse.",
          "",
          "Si le réseau est lent, la 1ère requête peut être en cours de traitement côté serveur au moment où la 2e part : le serveur traite les deux, même si la 1ère a réussi.",
          "",
          "Impact métier : doublons dans les listes, confusion de l'utilisateur, nettoyage manuel coûteux."
        ],RED,2260),
        cellW([
          "1. Génération d'un UUID v4 côté client AVANT d'ouvrir l'interface (au chargement du formulaire).",
          "",
          "2. Envoi de l'UUID dans le header : Idempotency-Key: <uuid>.",
          "",
          "3. Côté serveur : avant tout traitement, vérifier si la clé existe en Redis. Si oui → retourner la réponse précédente (201 + corps du doc déjà créé). Si non → traiter ET stocker la clé Redis (TTL 24h) de façon atomique.",
          "",
          "4. Désactiver le bouton côté UI après le 1er clic (défense en profondeur)."
        ],YEL,2500),
        cellW([
          "L'idempotency key côté serveur est la seule protection fiable : la désactivation côté UI peut être contournée (réseau lent, bug JS, double-tap mobile).",
          "",
          "Le stockage Redis atomique (SET NX — Set if Not eXists) garantit qu'en cas de requêtes concurrentes, une seule est traitée.",
          "",
          "Le TTL de 24h couvre largement les cas de retry tardif sans consommer de stockage indéfiniment.",
          "",
          "Pas de retry automatique côté client sur POST /documents : c'est à l'utilisateur de cliquer à nouveau, mais l'idempotency key garantit qu'un 2e clic ne duplique pas."
        ],GREEN,3000),
      ]}),
    ]
  }),
  space(),
];

// ══════════════════════════════════════════════════════════════════════════════
// TP 6.3 — Sécurité API
// ══════════════════════════════════════════════════════════════════════════════
const tp63 = [
  new Paragraph({ children: [new PageBreak()] }),
  h1("TP 6.3 — Sécurité API — Modèle Minimal"),
  space(),

  h2("Mécanisme de token JWT — Description complète"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2000, 7360],
    rows: [
      hRow(["Étape","Description"], [2000,7360]),
      new TableRow({ children: [cell("Génération",LBLUE,true,2000), cellW(["Lors du login réussi : JWT signé avec l'algorithme RS256 (clé asymétrique). Payload : { sub: user_id, roles: [...], exp: now+3600, iat: now, jti: uuid_unique }.","Le jti (JWT ID) est unique par token et permet la révocation ciblée."],GRAY,7360)] }),
      new TableRow({ children: [cell("Transmission",LBLUE,true,2000), cellW(["Header HTTP : Authorization: Bearer <JWT_token>. Le token ne doit JAMAIS être transmis dans l'URL (journaux des proxies) ni dans le body. TLS obligatoire sur tous les transports."],GRAY,7360)] }),
      new TableRow({ children: [cell("Vérification",LBLUE,true,2000), cellW(["Chaque service vérifie localement la signature avec la clé publique (pas d'appel au Auth Service à chaque requête → scalabilité). Contrôles : signature valide, exp non dépassé, aud correspond au service cible, iss correspond au Auth Service."],GRAY,7360)] }),
      new TableRow({ children: [cell("Invalidation",LBLUE,true,2000), cellW(["Logout : ajouter le jti à une blocklist Redis (TTL = exp - now). Le service de verify consulte Redis avant de valider. Si le jti est dans la blocklist → 401. En cas de compromission : invalidation par user_id (tous les tokens de cet utilisateur)."],GRAY,7360)] }),
    ]
  }),
  space(),

  h2("Placement des contrôles de sécurité"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2500, 2500, 2000, 2360],
    rows: [
      hRow(["Contrôle","Niveau Gateway","Niveau Service","Justification"], [2500,2500,2000,2360]),
      new TableRow({ children: [cell("Validation d'entrée",GRAY,false,2500), cell("Validation basique (longueur, format, Content-Type)",GRAY,false,2500), cell("✅ Validation complète obligatoire côté service",GREEN,false,2000), cell("Le Gateway peut être bypassé (accès direct réseau interne). Chaque service doit valider ses propres entrées (Zero Trust).",GRAY,false,2360)] }),
      new TableRow({ children: [cell("Rate Limiting",GRAY,false,2500), cell("✅ Rate limiting global par IP / user",GREEN,false,2500), cell("Rate limiting spécifique (ex: search plus strict)",GREEN,false,2000), cell("Les deux niveaux sont complémentaires : le Gateway protège en premier, le service se protège des appels inter-services excessifs.",GRAY,false,2360)] }),
      new TableRow({ children: [cell("Audit Logs",GRAY,false,2500), cell("Logs des requêtes entrantes (IP, endpoint, status, durée)",GRAY,false,2500), cell("✅ Logs métier : login, upload, suppression, accès admin",GREEN,false,2000), cell("Le Gateway loggue le trafic réseau. Chaque service loggue les événements métier avec leur contexte (user_id, ressource).",GRAY,false,2360)] }),
      new TableRow({ children: [cell("Authentification (AuthN)",GRAY,false,2500), cell("✅ Vérification JWT à l'entrée (appel Auth Service)",GREEN,false,2500), cell("Vérification de signature locale (clé publique)",GREEN,false,2000), cell("Double vérification : Gateway bloque les tokens manifestement invalides, chaque service vérifie localement les claims (audience, expiration).",GRAY,false,2360)] }),
    ]
  }),
  space(),

  h2("Rate Limiting — Seuils par endpoint"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2500, 1860, 2000, 3000],
    rows: [
      hRow(["Endpoint","Seuil","Algorithme","Justification"], [2500,1860,2000,3000]),
      new TableRow({ children: [cell("/api/v1/auth/login",GRAY,false,2500), cell("5 req/min/IP",RED,false,1860), cell("Sliding window",GRAY,false,2000), cell("Protection anti-brute force : 5 tentatives par minute par IP, verrouillage progressif",GRAY,false,3000)] }),
      new TableRow({ children: [cell("/api/v1/auth/refresh",GRAY,false,2500), cell("10 req/min/user",YEL,false,1860), cell("Sliding window",GRAY,false,2000), cell("Prévenir l'abus de refresh tokens (renouvellement automatique excessif)",GRAY,false,3000)] }),
      new TableRow({ children: [cell("/api/v1/documents (POST)",GRAY,false,2500), cell("30 req/min/user",YEL,false,1860), cell("Token bucket",GRAY,false,2000), cell("Permet des bursts légitimes (upload batch) mais bloque le spam de création",GRAY,false,3000)] }),
      new TableRow({ children: [cell("/api/v1/documents (GET, liste)",GRAY,false,2500), cell("120 req/min/user",GREEN,false,1860), cell("Token bucket",GRAY,false,2000), cell("Lecture légère, seuil généreux pour les applications légitimes",GRAY,false,3000)] }),
      new TableRow({ children: [cell("/api/v1/search",GRAY,false,2500), cell("20 req/min/user",RED,false,1860), cell("Sliding window",GRAY,false,2000), cell("Requêtes coûteuses (full-text search) — seuil strict pour éviter le DDoS applicatif",GRAY,false,3000)] }),
      new TableRow({ children: [cell("Tous endpoints (global)",GRAY,false,2500), cell("1000 req/min/IP",RED,false,1860), cell("Fixed window",GRAY,false,2000), cell("Limite globale anti-DDoS au niveau Gateway, indépendante de l'endpoint",GRAY,false,3000)] }),
    ]
  }),
  space(),

  h2("Audit Logs — Événements à journaliser"),
  bullet("Login réussi : user_id, timestamp, IP, user-agent"),
  bullet("Échec de login (avec compteur par IP pour détecter le brute force)"),
  bullet("Logout"),
  bullet("Création de document : user_id, doc_id, timestamp"),
  bullet("Modification de document : user_id, doc_id, champs modifiés, timestamp"),
  bullet("Suppression de document : user_id, doc_id, timestamp — OBLIGATOIRE"),
  bullet("Accès à un document : user_id, doc_id, résultat (succès / 403 / 404)"),
  bullet("Toute action d'un rôle admin : user_id, action, ressource cible, timestamp"),
  bullet("Rate limit déclenché : IP, endpoint, timestamp"),
  bullet("Token invalide ou expiré (pattern de tentatives peut indiquer une attaque)"),
  space(),

  h2("Matrice Surface → Menace → Contrôle"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2100, 2060, 3100, 2100],
    rows: [
      hRow(["Surface","Menace principale","Contrôle proposé","Priorité"], [2100,2060,3100,2100]),
      new TableRow({ children: [cell("API publique — /auth/login",GRAY,false,2100), cell("Brute force credentials",GRAY,false,2060), cell("Rate limiting 5 req/min/IP, verrouillage progressif (15min après 10 échecs), CAPTCHA après 3 échecs, logs",GRAY,false,3100), cell("🔴 CRITIQUE",RED,false,2100)] }),
      new TableRow({ children: [cell("API publique — /documents POST",GRAY,false,2100), cell("Injection JSON, upload malveillant, spam de création",GRAY,false,2060), cell("Validation stricte (type, longueur, format, whitelist), taille max 50KB pour le JSON, Content-Type vérifié, Idempotency-Key requis",GRAY,false,3100), cell("🔴 CRITIQUE",RED,false,2100)] }),
      new TableRow({ children: [cell("API publique — /search",GRAY,false,2100), cell("DDoS applicatif (requêtes coûteuses)",GRAY,false,2060), cell("Rate limiting 20 req/min/user, pagination obligatoire max 50 résultats, timeout serveur 8s, circuit breaker",GRAY,false,3100), cell("🟠 ÉLEVÉE",ORANGE,false,2100)] }),
      new TableRow({ children: [cell("API publique — tous endpoints",GRAY,false,2100), cell("MITM, interception de tokens",GRAY,false,2060), cell("TLS 1.3 obligatoire sur tous les endpoints, HSTS header, HTTPS only (redirection 301 si HTTP)",GRAY,false,3100), cell("🔴 CRITIQUE",RED,false,2100)] }),
      new TableRow({ children: [cell("API publique — tous endpoints",GRAY,false,2100), cell("Exposition d'informations internes (stack traces, versions)",GRAY,false,2060), cell("Messages d'erreur génériques en production (jamais de traceback), version des librairies masquée dans les headers",GRAY,false,3100), cell("🟠 ÉLEVÉE",ORANGE,false,2100)] }),
      new TableRow({ children: [cell("Inter-services — auth ↔ documents",GRAY,false,2100), cell("Mouvement latéral, usurpation de service",GRAY,false,2060), cell("mTLS (mutual TLS) ou tokens de service signés (scoped JWT avec audience spécifique), liste blanche des services autorisés à appeler chaque endpoint",GRAY,false,3100), cell("🟠 ÉLEVÉE",ORANGE,false,2100)] }),
      new TableRow({ children: [cell("Inter-services — tous",GRAY,false,2100), cell("Replay de requêtes internes",GRAY,false,2060), cell("Nonces (jti dans JWT), timestamps avec fenêtre de validité ±5 min, vérification côté récepteur",GRAY,false,3100), cell("🟡 MOYENNE",YEL,false,2100)] }),
      new TableRow({ children: [cell("Admin — gestion utilisateurs",GRAY,false,2100), cell("Accès non autorisé, élévation de privilèges",GRAY,false,2060), cell("Rôle admin uniquement (RBAC), MFA obligatoire pour accès admin, accès VPN uniquement, audit log renforcé de chaque action",GRAY,false,3100), cell("🔴 CRITIQUE",RED,false,2100)] }),
      new TableRow({ children: [cell("Admin — endpoints stats / debug",GRAY,false,2100), cell("Fuite d'informations sensibles (configs, secrets, métriques)",GRAY,false,2060), cell("Endpoints /debug et /metrics non exposés en production publique, accessibles uniquement depuis le réseau interne ou via VPN + auth",GRAY,false,3100), cell("🟠 ÉLEVÉE",ORANGE,false,2100)] }),
      new TableRow({ children: [cell("Gestion des secrets",GRAY,false,2100), cell("Secrets en dur dans le code, rotation manquante",GRAY,false,2060), cell("HashiCorp Vault, variables d'environnement injectées à l'exécution, scan CI/CD (truffleHog), rotation automatique 90j, principe du moindre privilège (un secret par service)",GRAY,false,3100), cell("🔴 CRITIQUE",RED,false,2100)] }),
    ]
  }),
  space(),
];

// ── Build Document ──────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•",
        alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
    }]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: "Arial", color: BLUE },
        paragraph: { spacing: { before: 300, after: 200 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE, space: 4 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
    ]
  },
  sections: [{
    properties: { page: { size: { width: 16838, height: 11906 }, margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 300, after: 150 }, children: [new TextRun({ text: "Séance 6 — Communication, APIs & Fiabilité", bold: true, size: 38, color: BLUE })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "Applications Réparties & Cybersécurité", size: 22, color: "555555" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: "Travaux Pratiques — Corrigé Complet", size: 20, italics: true, color: "777777" })] }),
      ...tp61, ...tp62, ...tp63
    ]
  }]
});

Packer.toBuffer(doc).then(b => {
  fs.writeFileSync("/mnt/user-data/outputs/TP_Seance6_Completed.docx", b);
  console.log("✅ TP_Seance6_Completed.docx written");
});
