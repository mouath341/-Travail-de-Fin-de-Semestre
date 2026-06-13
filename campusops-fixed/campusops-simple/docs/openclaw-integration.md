# Rapport d'integration OpenClaw

## Architecture

OpenClaw agit comme orchestrateur externe. Il declenche des appels HTTP vers l'API CampusOps. L'API lit la base de donnees, applique les regles metier et cree des notifications internes. Ces notifications peuvent ensuite etre envoyees vers Telegram, WhatsApp ou email.

## Workflows implementes

### 1. Planning du matin

- Declencheur: cron tous les matins.
- Endpoint: `POST /api/openclaw/morning-schedule`
- Action: recupere le planning du jour, cree des notifications pour enseignants et groupes.

### 2. Absence enregistree

- Declencheur: creation d'une absence via `POST /api/absences`.
- Action: notification automatique vers l'etudiant.
- Extension possible: ajouter parent_contact comme destination WhatsApp.

### 3. Paiement en retard

- Declencheur: cron quotidien.
- Endpoint: `POST /api/openclaw/check-late-payments`
- Action: marque les paiements en retard et cree une notification de relance.

## Securite

En production, OpenClaw doit utiliser un compte technique avec un jeton limite, renouvelable, et les endpoints doivent etre servis en HTTPS.
