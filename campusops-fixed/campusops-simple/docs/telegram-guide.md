# Telegram Bot Guide

## Role in the project

The Telegram bot is a simple chat interface in front of the CampusOps API. It does not replace the dashboard. It lets a student or teacher ask quick questions such as today's schedule, weekly schedule, absences and module progress.

## Files involved

- `telegram_bot.py`: the bot process.
- `app.py`: the API used by the bot.
- `users.telegram_chat_id`: stores the linked Telegram chat id.
- `otp_links`: stores temporary linking codes.

## Commands

| Command | Result |
|---|---|
| `/today` | Shows today's planning for the connected account. |
| `/week` | Shows the weekly planning. |
| `/absence` | Shows recent absences. |
| `/progress` | Shows progress for current modules/groups. |
| `/help` | Shows available commands. |
| `/link CODE` | Links a Telegram chat to a CampusOps account. |

## How to run it

First run the web app:

```bash
python app.py
```

Create a Telegram bot with BotFather, then set the token in the terminal:

```bash
set TELEGRAM_BOT_TOKEN=123456:your-token
set CAMPUSOPS_API=http://localhost:8000
python telegram_bot.py
```

On PowerShell you can also use:

```powershell
$env:TELEGRAM_BOT_TOKEN="123456:your-token"
$env:CAMPUSOPS_API="http://localhost:8000"
python telegram_bot.py
```

## How authentication works

For the simple demo, the bot logs in with one CampusOps account using:

```text
BOT_USER_EMAIL=student@campusops.local
BOT_USER_PASSWORD=student123
```

That is enough for a classroom demo because the API still applies role permissions. For a stronger version, each Telegram user should link their own account.

The intended linking flow is:

1. The user logs into the web dashboard.
2. The dashboard calls `POST /api/auth/otp`.
3. The API creates a short temporary code.
4. The user sends `/link CODE` to the Telegram bot.
5. The bot calls `POST /api/auth/link-telegram`.
6. CampusOps stores the Telegram `chat_id` on that user.

After linking, notifications can be routed to the correct Telegram chat.

## What to explain in the presentation

Say that Telegram is used as a notification and self-service channel. The bot calls the same secured REST API as the web dashboard, so permissions stay centralized. OpenClaw can create notifications in CampusOps, then a sender process can deliver those notifications through Telegram.

## Current simple limitation

This MVP keeps the bot intentionally small. It uses long polling with `getUpdates`, not webhooks. That means it is easy to run locally for a demo. In production, you would use Telegram webhooks, HTTPS, per-user tokens or a stronger account-linking table, and a background worker that sends pending notifications automatically.
