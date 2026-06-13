import json
import os
import time
import urllib.parse
import urllib.request

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
API_BASE = os.environ.get("CAMPUSOPS_API", "http://localhost:8000")
BOT_API = f"https://api.telegram.org/bot{BOT_TOKEN}"


def request_json(url, data=None, headers=None):
    body = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=headers or {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read().decode())


def send(chat_id, text):
    payload = urllib.parse.urlencode({"chat_id": chat_id, "text": text}).encode()
    urllib.request.urlopen(f"{BOT_API}/sendMessage", data=payload, timeout=20).read()


def campus(path, token):
    return request_json(f"{API_BASE}{path}", headers={"Authorization": f"Bearer {token}"})


def login_as_bot_user():
    email = os.environ.get("BOT_USER_EMAIL", "student@campusops.local")
    password = os.environ.get("BOT_USER_PASSWORD", "student123")
    return request_json(f"{API_BASE}/api/auth/login", {"email": email, "password": password})["token"]


def format_rows(items, empty="Aucune donnee."):
    if not items:
        return empty
    lines = []
    for item in items:
        lines.append(
            " | ".join(str(v) for v in item.values() if v is not None)[:800]
        )
    return "\n".join(lines[:8])


def handle(text, chat_id, token):
    if text.startswith("/start"):
        send(chat_id, "CampusOps bot pret. Commandes: /today /week /absence /progress /help")
    elif text.startswith("/today"):
        data = campus("/api/schedules?scope=today", token)
        send(chat_id, format_rows(data["schedules"], "Aucun cours aujourd'hui."))
    elif text.startswith("/week"):
        data = campus("/api/schedules?scope=week", token)
        send(chat_id, format_rows(data["schedules"], "Aucun cours cette semaine."))
    elif text.startswith("/absence"):
        data = campus("/api/absences", token)
        send(chat_id, format_rows(data["absences"], "Aucune absence recente."))
    elif text.startswith("/progress"):
        data = campus("/api/progress", token)
        send(chat_id, format_rows(data["progress"], "Aucun avancement."))
    elif text.startswith("/link"):
        code = text.replace("/link", "").strip()
        request_json(f"{API_BASE}/api/auth/link-telegram", {"code": code, "chat_id": str(chat_id)})
        send(chat_id, "Compte lie avec succes.")
    else:
        send(chat_id, "Commandes: /today /week /absence /progress /help")


def main():
    if not BOT_TOKEN:
        raise SystemExit("Set TELEGRAM_BOT_TOKEN first.")
    token = login_as_bot_user()
    offset = 0
    while True:
        updates = request_json(f"{BOT_API}/getUpdates?timeout=25&offset={offset}")
        for update in updates.get("result", []):
            offset = update["update_id"] + 1
            message = update.get("message") or {}
            text = message.get("text", "")
            chat_id = message.get("chat", {}).get("id")
            if text and chat_id:
                handle(text, chat_id, token)
        time.sleep(1)


if __name__ == "__main__":
    main()
