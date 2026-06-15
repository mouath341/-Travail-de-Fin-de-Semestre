const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageBreak
} = require('docx');
const fs = require('fs');

// ─── Helpers ───────────────────────────────────────────────────────────────
const BLUE  = "1F4E79";
const LBLUE = "D5E8F0";
const GREEN = "E2EFDA";
const RED   = "FCE4D6";
const YEL   = "FFF2CC";
const GRAY  = "F2F2F2";

const border = { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, color: BLUE, size: 28 })]
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, color: "2E75B6", size: 24 })]
  });
}
function h3(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22 })],
    spacing: { before: 200, after: 100 }
  });
}
function para(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, ...opts })],
    spacing: { after: 100 }
  });
}
function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    children: [new TextRun({ text, size: 20 })],
    spacing: { after: 80 }
  });
}
function space() {
  return new Paragraph({ children: [new TextRun("")], spacing: { after: 100 } });
}
function cell(text, fill = "FFFFFF", bold = false, width = 2200) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, size: 18, bold })] })]
  });
}
function cellWrap(lines, fill = "FFFFFF", width = 2200) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: cellMargins,
    children: lines.map(l =>
      new Paragraph({ children: [new TextRun({ text: l, size: 18 })], spacing: { after: 60 } })
    )
  });
}
function headerRow(cols, widths) {
  return new TableRow({
    tableHeader: true,
    children: cols.map((c, i) => cell(c, LBLUE, true, widths[i]))
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// TP5.1 — Architecture SGDD
// ══════════════════════════════════════════════════════════════════════════════
const tp51 = [
  h1("TP 5.1 — Schématisation d'Architecture Distribuée"),
  space(),

  h2("Architecture logique — Composants & Interactions"),
  para("Le Système de Gestion Documentaire Distribué (SGDD) est décomposé en 5 services indépendants communiquant via HTTP/REST et un bus de messages asynchrone."),
  space(),

  // Architecture ASCII
  new Paragraph({
    children: [new TextRun({ text:
`ARCHITECTURE LOGIQUE — SGDD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   [CLIENT WEB / APP MOBILE]
              │ HTTPS
              ▼
   ┌──────────────────────────┐
   │        API GATEWAY       │  Rate limiting · Auth token check
   │  (Nginx / Traefik)       │  Routage · Validation d'entrée
   └────┬─────┬──────┬────────┘
        │     │      │
   HTTP/REST  │   HTTP/REST
        │     │      │
   ┌────▼──┐  │  ┌───▼────────┐    ┌──────────────────┐
   │ AUTH  │  │  │  STOCKAGE  │───►│ RECHERCHE SERVICE │
   │SERVICE│  │  │  SERVICE   │    │  (indexation)     │
   │(JWT)  │  │  │  (CRUD)    │    └──────────────────┘
   └───┬───┘  │  └─────┬──────┘          │ async (file)
       │      │        │ async (file)     │
   ┌───▼───┐  │   ┌────▼──────────────┐  │
   │USERS  │  │   │  NOTIFICATION SVC │◄─┘
   │ DB    │  │   │  (email / push)   │
   │(PG)   │  │   └───────────────────┘
   └───────┘  │        │
              │   ┌────▼───────┐   ┌─────────────┐
              │   │ DOCS DB    │   │ SEARCH INDEX│
              │   │ (MongoDB)  │   │(Elasticsearch│
              └──►│            │   │  / Whoosh)  │
                  └────────────┘   └─────────────┘`, font: "Courier New", size: 16 })]
  }),
  space(),

  h2("Justification des choix architecturaux"),
  para("Le système repose sur une architecture microservices avec les principes suivants :"),
  bullet("API Gateway comme point d'entrée unique : centralise l'authentification, le rate limiting et le routage, sans exposer directement les services internes."),
  bullet("Auth Service indépendant : émet et vérifie les tokens JWT. En cas de mise à jour du mécanisme d'authentification, aucun autre service n'est impacté."),
  bullet("Stockage Service avec MongoDB : la flexibilité des documents JSON est adaptée aux métadonnées variables de fichiers."),
  bullet("Recherche Service découplé : l'indexation est asynchrone via file de messages (Redis/RabbitMQ), évitant de bloquer l'upload en cas de lenteur de l'indexeur."),
  bullet("Notification Service asynchrone : les alertes sont non-critiques ; un découplage par file garantit que l'upload n'est pas ralenti par l'envoi d'emails."),
  bullet("Une base de données par service (Database per Service pattern) : évite le couplage entre services et permet une scalabilité indépendante."),
  space(),

  h2("Architecture physique — Déploiement Docker / Kubernetes"),
  para("En production, chaque service tourne dans un conteneur Docker distinct, orchestré par Kubernetes :"),
  bullet("API Gateway : 2 réplicas (load balancer L7), exposé sur le port 443."),
  bullet("Auth Service : 2 réplicas (haute disponibilité critique), co-localisable avec la Users DB sur le même nœud."),
  bullet("Stockage Service : 1 à 3 réplicas selon la charge, avec accès au stockage objet (MinIO/S3)."),
  bullet("Recherche Service : 1 réplica (scalable horizontalement si nécessaire), avec accès en lecture à l'index Elasticsearch."),
  bullet("Notification Service : 1 réplica, connecté au broker de messages."),
  bullet("Bases de données : nœuds dédiés, sous-réseau privé non accessible depuis l'extérieur."),
  space(),

  h2("Réponses aux questions guidées"),
  h3("Nombre de services & frontières"),
  para("5 services : API Gateway (routage/sécurité), Auth Service (identité/tokens), Stockage Service (CRUD documents), Recherche Service (indexation/requêtes), Notification Service (alertes). Chaque service possède un domaine métier clair et une base de données dédiée."),
  space(),
  h3("Protocoles de communication"),

  new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [3500, 2500, 3000],
    rows: [
      headerRow(["Paire de services","Protocole","Justification"], [3500,2500,3000]),
      new TableRow({ children: [cell("Client → API Gateway",GRAY,false,3500), cell("HTTPS (TLS)",GRAY,false,2500), cell("Chiffrement obligatoire en transit",GRAY,false,3000)] }),
      new TableRow({ children: [cell("API Gateway → Auth",GRAY,false,3500), cell("HTTP/REST interne",GRAY,false,2500), cell("Vérification synchrone du token",GRAY,false,3000)] }),
      new TableRow({ children: [cell("API Gateway → Stockage",GRAY,false,3500), cell("HTTP/REST interne",GRAY,false,2500), cell("Opérations CRUD synchrones",GRAY,false,3000)] }),
      new TableRow({ children: [cell("Stockage → Recherche",GRAY,false,3500), cell("Asynchrone (file Redis)",GRAY,false,2500), cell("Indexation non bloquante",GRAY,false,3000)] }),
      new TableRow({ children: [cell("Stockage → Notification",GRAY,false,3500), cell("Asynchrone (file Redis)",GRAY,false,2500), cell("Alertes non critiques",GRAY,false,3000)] }),
    ]
  }),
  space(),
  h3("Appels parallèles possibles"),
  para("Lors d'un upload de document : la vérification JWT (Auth) est synchrone et doit précéder tout traitement. En revanche, l'indexation (Recherche) et la notification (Notification) peuvent être déclenchées en parallèle de manière asynchrone après confirmation du stockage."),
  space(),
  h3("Chemin critique (latence maximale)"),
  para("Upload : Client → Gateway (TLS + routage ~5ms) → Auth (vérification JWT ~3ms) → Stockage (écriture DB ~50ms) → [async] Recherche + Notification. Temps de réponse perçu par l'utilisateur : ~60ms (hors upload du fichier lui-même)."),
  para("Recherche : Client → Gateway → Auth → Recherche Service (~80-150ms selon complexité de la requête). La recherche est le chemin critique le plus lent."),
  space(),
];

// ══════════════════════════════════════════════════════════════════════════════
// TP5.2 — Analyse des défis distribués
// ══════════════════════════════════════════════════════════════════════════════
const tp52 = [
  new Paragraph({ children: [new PageBreak()] }),
  h1("TP 5.2 — Analyse des Défis Distribués"),
  space(),
  para("Pour chaque service du SGDD, analyse des défis et propositions de solutions architecturales."),
  space(),

  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1700, 1500, 2200, 2000, 1960],
    rows: [
      headerRow(["Composant","Défi","Risque concret","Proposition de solution","Modèle de cohérence"], [1700,1500,2200,2000,1960]),
      new TableRow({ children: [
        cell("Auth Service",LBLUE,true,1700),
        cellWrap(["Disponibilité (SPOF critique)"],YEL,1500),
        cellWrap(["Si Auth tombe, plus personne ne peut se connecter → tout le système bloqué. Les tokens existants restent valides mais aucun nouveau login possible."],RED,2200),
        cellWrap(["2 réplicas Auth en active-active. Cache de validation JWT côté API Gateway (TTL 60s) pour absorber une coupure courte. Health check toutes les 10s."],GREEN,2000),
        cell("Forte (JWT signé, vérification locale)",GRAY,false,1960),
      ]}),
      new TableRow({ children: [
        cell("Stockage Service",LBLUE,true,1700),
        cellWrap(["Cohérence doc → index"],YEL,1500),
        cellWrap(["Un document uploadé mais pas encore indexé est invisible en recherche. Si le Recherche Service est lent, la fenêtre d'incohérence s'allonge."],RED,2200),
        cellWrap(["File de messages persistante (Redis Streams). Le Stockage publie un événement 'document_uploaded' ; le Recherche le consomme en ordre garanti. Cohérence éventuelle acceptable."],GREEN,2000),
        cell("Éventuelle (cohérence entre Stockage et index acceptable à ~1s)",GRAY,false,1960),
      ]}),
      new TableRow({ children: [
        cell("Recherche Service",LBLUE,true,1700),
        cellWrap(["Latence & charge CPU"],YEL,1500),
        cellWrap(["L'indexation de gros documents bloque le thread principal. Une requête full-text sur un index non optimisé peut prendre plusieurs secondes."],RED,2200),
        cellWrap(["Indexation asynchrone via file de messages (pas en synchrone). Cache Redis pour les 100 requêtes les plus fréquentes (TTL 5 min). Timeout serveur à 8s."],GREEN,2000),
        cell("Forte pour la requête (résultat doit être cohérent au moment de la lecture)",GRAY,false,1960),
      ]}),
      new TableRow({ children: [
        cell("API Gateway",LBLUE,true,1700),
        cellWrap(["SPOF & surcharge"],YEL,1500),
        cellWrap(["Si le Gateway tombe, l'intégralité du trafic est coupée. Sous forte charge, il peut devenir le goulot d'étranglement du système."],RED,2200),
        cellWrap(["2 réplicas Gateway derrière un load balancer L4 (Nginx/HAProxy). Auto-scaling horizontal déclenché à 70% CPU. Rate limiting configurable par endpoint."],GREEN,2000),
        cell("Sans état (stateless) → facilement répliqué",GRAY,false,1960),
      ]}),
      new TableRow({ children: [
        cell("Notification Service",LBLUE,true,1700),
        cellWrap(["Livraison garantie"],YEL,1500),
        cellWrap(["Si le service Notification est momentanément indisponible, les alertes d'upload peuvent être perdues. Un utilisateur ne reçoit pas son email de confirmation."],RED,2200),
        cellWrap(["File de messages persistante avec at-least-once delivery. Dead Letter Queue (DLQ) pour les notifications échouées après 3 tentatives. Retry avec backoff."],GREEN,2000),
        cell("Éventuelle (délai d'envoi de quelques secondes acceptable)",GRAY,false,1960),
      ]}),
      new TableRow({ children: [
        cell("Bases de données",LBLUE,true,1700),
        cellWrap(["Tolérance aux pannes"],YEL,1500),
        cellWrap(["Une panne de la DB Docs rend tous les uploads impossibles. Sans réplication, la perte d'un nœud = perte de données et indisponibilité."],RED,2200),
        cellWrap(["Réplication MongoDB (ReplicaSet 3 nœuds, 1 primaire + 2 secondaires). Failover automatique si primaire tombe (<30s). Sauvegardes quotidiennes chiffrées."],GREEN,2000),
        cell("Forte (lectures depuis primaire) ou éventuelle (lectures depuis secondaire, risque de stale data)",GRAY,false,1960),
      ]}),
    ]
  }),
  space(),

  h2("Tableau récapitulatif des patterns appliqués"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2000, 2360, 2500, 2500],
    rows: [
      headerRow(["Pattern","Problème résolu","Service(s) concerné(s)","Trade-off accepté"], [2000,2360,2500,2500]),
      new TableRow({ children: [cell("Cache Redis",GRAY,false,2000), cell("Latence DB, charge CPU",GRAY,false,2360), cell("API Gateway (tokens), Recherche",GRAY,false,2500), cell("Données potentiellement périmées (TTL configuré)",GRAY,false,2500)] }),
      new TableRow({ children: [cell("Réplication",GRAY,false,2000), cell("Disponibilité, tolérance pannes",GRAY,false,2360), cell("Auth, Stockage DB, Gateway",GRAY,false,2500), cell("Complexité de synchronisation, coût infra",GRAY,false,2500)] }),
      new TableRow({ children: [cell("File de messages",GRAY,false,2000), cell("Couplage temporel, pics de charge",GRAY,false,2360), cell("Stockage → Recherche, Notification",GRAY,false,2500), cell("Cohérence éventuelle, message ordering",GRAY,false,2500)] }),
      new TableRow({ children: [cell("Fallback",GRAY,false,2000), cell("Dégradation gracieuse",GRAY,false,2360), cell("Recherche, Notification",GRAY,false,2500), cell("UX dégradée mais service partial disponible",GRAY,false,2500)] }),
      new TableRow({ children: [cell("Circuit Breaker",GRAY,false,2000), cell("Cascade de pannes",GRAY,false,2360), cell("Tous (via Gateway ou client)",GRAY,false,2500), cell("Fail fast côté client, nécessite fallback",GRAY,false,2500)] }),
    ]
  }),
  space(),
];

// ══════════════════════════════════════════════════════════════════════════════
// TP5.3 — Surfaces d'attaque
// ══════════════════════════════════════════════════════════════════════════════
const tp53 = [
  new Paragraph({ children: [new PageBreak()] }),
  h1("TP 5.3 — Cartographie des Surfaces d'Attaque"),
  space(),
  para("Matrice complète des menaces sur l'architecture SGDD, avec contrôles et priorités."),
  space(),

  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2100, 2060, 3100, 2100],
    rows: [
      headerRow(["Surface d'attaque","Menace principale","Contrôle proposé","Priorité"], [2100,2060,3100,2100]),
      new TableRow({ children: [cell("API externe — Gateway",GRAY,false,2100), cell("DDoS, injection, brute force auth",GRAY,false,2060), cell("Rate limiting (100 req/min/IP), WAF, validation stricte des entrées, lockout après 5 échecs",GRAY,false,3100), cell("🔴 CRITIQUE",RED,false,2100)] }),
      new TableRow({ children: [cell("API publique — /auth/login",GRAY,false,2100), cell("Brute force credentials, enumération users",GRAY,false,2060), cell("Rate limiting strict (5 tentatives/min/IP), délai progressif, message d'erreur générique (ne pas distinguer user inconnu vs mauvais mdp)",GRAY,false,3100), cell("🔴 CRITIQUE",RED,false,2100)] }),
      new TableRow({ children: [cell("Inter-services Auth↔Stockage",GRAY,false,2100), cell("MITM, usurpation d'identité de service",GRAY,false,2060), cell("mTLS (mutual TLS) entre tous les services, vérification d'audience dans les JWT de service",GRAY,false,3100), cell("🔴 CRITIQUE",RED,false,2100)] }),
      new TableRow({ children: [cell("Base de données (MongoDB, PostgreSQL)",GRAY,false,2100), cell("Injection NoSQL/SQL, accès non autorisé",GRAY,false,2060), cell("Requêtes paramétrées, credentials dans vault HashiCorp, réseau privé isolé, pas de port exposé publiquement",GRAY,false,3100), cell("🔴 CRITIQUE",RED,false,2100)] }),
      new TableRow({ children: [cell("Stockage objet (S3/MinIO)",GRAY,false,2100), cell("Accès non autorisé à des fichiers d'autres utilisateurs, path traversal",GRAY,false,2060), cell("Bucket policies strictes, pre-signed URLs à durée limitée (15 min), validation du chemin avant accès, pas d'IDs séquentiels",GRAY,false,3100), cell("🔴 CRITIQUE",RED,false,2100)] }),
      new TableRow({ children: [cell("Recherche Service",GRAY,false,2100), cell("DDoS applicatif (requêtes coûteuses), injection dans la query de recherche",GRAY,false,2060), cell("Rate limiting (20 req/min/user), timeout serveur 8s, échappement des caractères spéciaux, pagination obligatoire (max 50 résultats)",GRAY,false,3100), cell("🟠 ÉLEVÉE",YEL,false,2100)] }),
      new TableRow({ children: [cell("Interface d'administration",GRAY,false,2100), cell("Accès non autorisé au monitoring, élévation de privilèges",GRAY,false,2060), cell("VPN obligatoire, MFA (TOTP), RBAC rôle admin, audit log renforcé de chaque action admin",GRAY,false,3100), cell("🟠 ÉLEVÉE",YEL,false,2100)] }),
      new TableRow({ children: [cell("Logs & traces",GRAY,false,2100), cell("Fuite de données sensibles (tokens, mots de passe, données PII)",GRAY,false,2060), cell("Masquage automatique des tokens JWT et mots de passe dans les logs, accès restreint aux logs (RBAC), chiffrement des fichiers de logs au repos",GRAY,false,3100), cell("🟠 ÉLEVÉE",YEL,false,2100)] }),
      new TableRow({ children: [cell("Secrets & configuration",GRAY,false,2100), cell("Fuite de clés API, credentials dans le code source ou variables d'env en clair",GRAY,false,2060), cell("HashiCorp Vault pour les secrets, injection à l'exécution, scan de secrets dans la CI (git-secrets, truffleHog), rotation automatique tous les 90 jours",GRAY,false,3100), cell("🔴 CRITIQUE",RED,false,2100)] }),
      new TableRow({ children: [cell("Dépendances Python (pip)",GRAY,false,2100), cell("Supply chain attack via paquet malveillant ou compromis",GRAY,false,2060), cell("pip-audit dans la CI/CD, requirements.txt avec versions fixées (lock), SBOM généré à chaque build, mise à jour hebdomadaire contrôlée",GRAY,false,3100), cell("🟡 MOYENNE",GREEN,false,2100)] }),
      new TableRow({ children: [cell("File de messages (Redis)",GRAY,false,2100), cell("Injection de messages malformés, accès non authentifié au broker",GRAY,false,2060), cell("Authentification Redis (password + ACL), validation du schéma des messages avant traitement, chiffrement TLS sur la connexion Redis",GRAY,false,3100), cell("🟠 ÉLEVÉE",YEL,false,2100)] }),
      new TableRow({ children: [cell("Upload de fichiers",GRAY,false,2100), cell("Upload de malwares, fichiers trop volumineux (DoS), path traversal",GRAY,false,2060), cell("Taille maximale 50 MB (configurée côté serveur), validation du Content-Type, scan antivirus asynchrone (ClamAV), stockage hors du répertoire web, nom de fichier sanitizé",GRAY,false,3100), cell("🔴 CRITIQUE",RED,false,2100)] }),
    ]
  }),
  space(),

  h2("Analyse STRIDE appliquée au SGDD"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1800, 2000, 2760, 2800],
    rows: [
      headerRow(["Catégorie STRIDE","Menace","Scénario sur le SGDD","Contre-mesure"], [1800,2000,2760,2800]),
      new TableRow({ children: [cell("S — Spoofing",RED,true,1800), cell("Usurpation d'identité",GRAY,false,2000), cell("Voler un JWT valide (depuis un log ou réseau non chiffré) pour accéder aux documents d'un autre utilisateur",GRAY,false,2760), cell("TLS obligatoire, JWT à durée courte (1h), refresh tokens, logs ne contenant jamais de tokens",GRAY,false,2800)] }),
      new TableRow({ children: [cell("T — Tampering",RED,true,1800), cell("Falsification de données",GRAY,false,2000), cell("Modifier le contenu d'un document en transit entre Stockage et Recherche si la communication inter-services n'est pas chiffrée",GRAY,false,2760), cell("mTLS entre tous les services, intégrité des messages vérifiée (signature ou hash)",GRAY,false,2800)] }),
      new TableRow({ children: [cell("R — Repudiation",YEL,true,1800), cell("Déni d'action",GRAY,false,2000), cell("Un utilisateur supprime un document confidentiel et nie l'avoir fait (absence d'audit log)",GRAY,false,2760), cell("Audit log immuable (append-only) de chaque opération sensible : qui, quoi, quand, depuis quelle IP",GRAY,false,2800)] }),
      new TableRow({ children: [cell("I — Information Disclosure",YEL,true,1800), cell("Divulgation d'infos",GRAY,false,2000), cell("Stack trace Python complète retournée au client en cas d'erreur 500 (révèle chemins, structure interne, version des libs)",GRAY,false,2760), cell("Messages d'erreur génériques en production, traces loggées en interne uniquement, jamais exposées",GRAY,false,2800)] }),
      new TableRow({ children: [cell("D — Denial of Service",RED,true,1800), cell("Déni de service",GRAY,false,2000), cell("Envoi de milliers de requêtes POST /documents ou requêtes de recherche complexes pour saturer les services",GRAY,false,2760), cell("Rate limiting, pagination forcée, timeout côté serveur, circuit breaker, auto-scaling",GRAY,false,2800)] }),
      new TableRow({ children: [cell("E — Elevation of Privilege",RED,true,1800), cell("Élévation de privilèges",GRAY,false,2000), cell("Modifier le payload JWT pour changer son rôle de 'reader' à 'admin' (si signature non vérifiée par chaque service)",GRAY,false,2760), cell("Chaque service vérifie la signature JWT avec la clé publique. Jamais de confiance implicite sur le contenu non vérifié",GRAY,false,2800)] }),
    ]
  }),
  space(),
];

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENT
// ══════════════════════════════════════════════════════════════════════════════
const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
    }]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "1F4E79" },
        paragraph: { spacing: { before: 300, after: 200 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "1F4E79", space: 4 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: { size: { width: 11906, height: 16838 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } }
    },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 200 }, children: [new TextRun({ text: "Séance 5 — Systèmes Distribués", bold: true, size: 40, color: BLUE })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "Applications Réparties & Cybersécurité", size: 24, color: "555555" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: "Travaux Pratiques — Corrigé Complet", size: 22, italics: true, color: "777777" })] }),
      ...tp51, ...tp52, ...tp53
    ]
  }]
});

Packer.toBuffer(doc).then(b => {
  fs.writeFileSync("/mnt/user-data/outputs/TP_Seance5_Completed.docx", b);
  console.log("✅ TP_Seance5_Completed.docx written");
});
