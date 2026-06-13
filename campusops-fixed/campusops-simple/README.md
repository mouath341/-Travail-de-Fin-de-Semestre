# CampusOps Simple

CampusOps Simple est un MVP full-stack tres leger pour un projet de fin de semestre: gestion des utilisateurs, planning, absences, avancement pedagogique, paiements, notifications, email IMAP/SMTP et workflows OpenClaw.

## Lancer le projet

```bash
python app.py
```

Puis ouvrir:

```text
http://localhost:8000
```

La base `campusops.db` est creee automatiquement au premier lancement avec des donnees demo.

## Comptes de test

| Role | Email | Mot de passe |
|---|---|---|
| Admin | admin@campusops.local | admin123 |
| Secretariat | secretariat@campusops.local | secret123 |
| Enseignant | teacher@campusops.local | teacher123 |
| Etudiant | student@campusops.local | student123 |

## Fonctionnalites incluses

- Page de connexion separee du dashboard.
- Authentification type JWT signee avec expiration.
- Hash de mots de passe via PBKDF2.
- Roles: admin, secretariat, teacher, student.
- CRUD utilisateurs minimal.
- Planning jour/semaine par groupe ou enseignant.
- Absences et retards avec notification automatique.
- Suivi d'avancement par module et groupe.
- Paiements avec etats: paid, partial, unpaid, late.
- Notifications internes pour Telegram, WhatsApp et email.
- Endpoints email: `GET /api/mail/latest`, `POST /api/mail/send`.
- Workflows OpenClaw simulables par API.
- Bot Telegram minimal dans `telegram_bot.py`.

## Demo conseillee

1. Lancer `python app.py` puis ouvrir `http://localhost:8000`.
2. Se connecter avec `admin@campusops.local / admin123`.
3. Montrer le dashboard: les cartes expliquent les chiffres visibles selon le role.
4. Aller dans Planning et ajouter une seance avec les IDs demo.
5. Aller dans Absences et enregistrer une absence: une notification est creee.
6. Aller dans Paiements et cliquer sur `Lancer OpenClaw: relances paiement`.
7. Aller dans Notifications: les taches de relance paiement apparaissent.
8. Aller dans Email: lire les emails demo et envoyer/simuler un email.

## Comprendre les chiffres du dashboard

Les cartes ne sont pas statiques. Elles appellent l'API:

- `Cours aujourd'hui`: `GET /api/schedules?scope=today`
- `Cours cette semaine`: `GET /api/schedules?scope=week`
- `Absences/retards`: `GET /api/absences`
- `Paiements en retard`: `GET /api/payments`
- `Notifications`: `GET /api/notifications`

Admin voit tout. Enseignant voit ses seances. Etudiant voit son groupe, ses absences et ses paiements.

## API rapide

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@campusops.local\",\"password\":\"admin123\"}"
```

Copier le `token`, puis:

```bash
curl http://localhost:8000/api/schedules?scope=week -H "Authorization: Bearer TOKEN"
```

## Email reel

Copier `.env.example`, configurer les variables IMAP/SMTP dans votre terminal, puis relancer.
Sans configuration, l'application renvoie des emails demo pour permettre la soutenance.

Dans l'interface, la page Email permet aussi d'envoyer un message. Sans SMTP configure, CampusOps simule l'envoi et cree une notification interne. Avec SMTP configure, `POST /api/mail/send` envoie vraiment le mail.

## OpenClaw paiement

Le bouton `Lancer OpenClaw: relances paiement` appelle:

```text
POST /api/openclaw/check-late-payments
```

Le workflow cherche les paiements non payes, les marque en retard, cree une notification Telegram pour l'etudiant et une tache interne pour admin/secretariat.

## Telegram

```bash
set TELEGRAM_BOT_TOKEN=123456:token
python telegram_bot.py
```

Commandes: `/today`, `/week`, `/absence`, `/progress`, `/help`.

Le bot Telegram est une interface chat devant l'API CampusOps. Il lit le planning, les absences et l'avancement avec les memes permissions que le dashboard. Pour une explication complete, voir `docs/telegram-guide.md`.

## Documents fournis

- `docs/cahier-des-charges.md`
- `docs/erd.md`
- `docs/openclaw-integration.md`
- `docs/telegram-guide.md`
- `openapi.yaml`
- `openclaw/workflows.json`
- `seed/demo-data.json`
