# Cahier des charges - CampusOps

## 1. Contexte

CampusOps est une application web de gestion academique inspiree des plateformes de type Konosys. Elle centralise le planning, les absences, l'avancement pedagogique, les paiements et les notifications.

## 2. Objectifs

- Offrir une interface simple pour l'administration, le secretariat, les enseignants et les etudiants.
- Exposer une API REST securisee.
- Automatiser les notifications via OpenClaw.
- Permettre la consultation par Telegram et, en mode simplifie, WhatsApp.
- Lire et envoyer des emails sans navigateur avec IMAP et SMTP.

## 3. Acteurs

- Admin: gere toute la plateforme.
- Secretariat: gere utilisateurs, planning, absences et paiements.
- Enseignant: consulte son planning, marque les absences, met a jour l'avancement.
- Etudiant: consulte son planning, ses absences, ses paiements et son avancement.

## 4. Perimetre MVP

### Utilisateurs

Authentification, roles, creation, modification et suppression par admin/secretariat.

### Planning

Creation de seances avec module, groupe, enseignant, salle, date et horaire. Consultation jour/semaine.

### Absences

Enregistrement des statuts present, absent ou late. Creation automatique d'une notification.

### Avancement

Suivi par module, groupe, chapitre et pourcentage.

### Paiements

Suivi des mensualites et alertes de retard. Pas de paiement bancaire reel.

### Email

Lecture des 10 derniers emails via IMAP et envoi via SMTP. Un mode demo est disponible sans credentials.

## 5. Securite

- Mots de passe hashes avec PBKDF2.
- Jetons JWT HMAC avec expiration.
- Controle des roles sur les endpoints sensibles.
- SQLite avec requetes parametrees pour limiter l'injection SQL.
- Donnees demo minimales.

## 6. Limites assumees

Ce MVP privilegie la simplicite: pas de framework externe, pas de vraie passerelle de paiement, pas de file d'attente, et WhatsApp est represente comme canal de notification interne ou connectable a un fournisseur.
