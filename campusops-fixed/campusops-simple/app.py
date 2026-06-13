import base64
import datetime as dt
import email
import hashlib
import hmac
import imaplib
import json
import os
import secrets
import smtplib
import sqlite3
from email.message import EmailMessage
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "campusops.db"
SECRET = os.environ.get("CAMPUSOPS_SECRET", "change-me-in-production")
TOKEN_TTL_SECONDS = 60 * 60 * 8

ROLES = {"admin", "secretariat", "teacher", "student"}


def now_utc():
    return dt.datetime.now(dt.timezone.utc)


def today_iso():
    return dt.date.today().isoformat()


def week_bounds():
    today = dt.date.today()
    start = today - dt.timedelta(days=today.weekday())
    end = start + dt.timedelta(days=6)
    return start.isoformat(), end.isoformat()


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def rows(cursor):
    return [dict(row) for row in cursor.fetchall()]


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
    return f"{salt}${base64.urlsafe_b64encode(digest).decode()}"


def check_password(password, stored):
    salt, _ = stored.split("$", 1)
    expected = hash_password(password, salt)
    return hmac.compare_digest(expected, stored)


def b64(data):
    raw = json.dumps(data, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def sign(message):
    return base64.urlsafe_b64encode(
        hmac.new(SECRET.encode(), message.encode(), hashlib.sha256).digest()
    ).decode().rstrip("=")


def make_token(user):
    header = b64({"alg": "HS256", "typ": "JWT"})
    payload = b64(
        {
            "sub": user["id"],
            "role": user["role"],
            "name": user["name"],
            "exp": int((now_utc() + dt.timedelta(seconds=TOKEN_TTL_SECONDS)).timestamp()),
        }
    )
    message = f"{header}.{payload}"
    return f"{message}.{sign(message)}"


def parse_token(token):
    try:
        header, payload, signature = token.split(".")
        message = f"{header}.{payload}"
        if not hmac.compare_digest(signature, sign(message)):
            return None
        padded = payload + "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded.encode()))
        if data["exp"] < int(now_utc().timestamp()):
            return None
        return data
    except Exception:
        return None


def init_db():
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin','secretariat','teacher','student')),
                group_name TEXT,
                parent_contact TEXT,
                telegram_chat_id TEXT,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                capacity INTEGER NOT NULL DEFAULT 30
            );
            CREATE TABLE IF NOT EXISTS modules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT UNIQUE NOT NULL
            );
            CREATE TABLE IF NOT EXISTS schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                module_id INTEGER NOT NULL,
                teacher_id INTEGER NOT NULL,
                room_id INTEGER NOT NULL,
                group_name TEXT NOT NULL,
                FOREIGN KEY(module_id) REFERENCES modules(id),
                FOREIGN KEY(teacher_id) REFERENCES users(id),
                FOREIGN KEY(room_id) REFERENCES rooms(id)
            );
            CREATE TABLE IF NOT EXISTS absences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                schedule_id INTEGER NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('present','absent','late')),
                justification TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(student_id) REFERENCES users(id),
                FOREIGN KEY(schedule_id) REFERENCES schedules(id)
            );
            CREATE TABLE IF NOT EXISTS progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                module_id INTEGER NOT NULL,
                group_name TEXT NOT NULL,
                chapter TEXT NOT NULL,
                percent INTEGER NOT NULL CHECK(percent BETWEEN 0 AND 100),
                updated_by INTEGER NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(module_id) REFERENCES modules(id),
                FOREIGN KEY(updated_by) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                label TEXT NOT NULL,
                amount REAL NOT NULL,
                due_date TEXT NOT NULL,
                paid_amount REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL CHECK(status IN ('paid','partial','unpaid','late')),
                FOREIGN KEY(student_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                channel TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS otp_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                code TEXT UNIQUE NOT NULL,
                expires_at TEXT NOT NULL,
                used_at TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            """
        )
        count = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        if count:
            return

        users = [
            ("Admin CampusOps", "admin@campusops.local", "admin", None, None, "admin123"),
            ("Sara Secretariat", "secretariat@campusops.local", "secretariat", None, None, "secret123"),
            ("Youssef Teacher", "teacher@campusops.local", "teacher", None, None, "teacher123"),
            ("Nadia Student", "student@campusops.local", "student", "GI-1", "+212600000001", "student123"),
            ("Omar Student", "omar@campusops.local", "student", "GI-1", "+212600000002", "student123"),
        ]
        for name, email_addr, role, group_name, parent, password in users:
            conn.execute(
                "INSERT INTO users(name,email,role,group_name,parent_contact,password_hash,created_at) VALUES(?,?,?,?,?,?,?)",
                (name, email_addr, role, group_name, parent, hash_password(password), now_utc().isoformat()),
            )
        for name, cap in [("A101", 32), ("Lab 2", 20)]:
            conn.execute("INSERT INTO rooms(name,capacity) VALUES(?,?)", (name, cap))
        for name, code in [("Architecture Web", "WEB301"), ("Base de donnees", "DB201"), ("Automatisation", "AUTO401")]:
            conn.execute("INSERT INTO modules(name,code) VALUES(?,?)", (name, code))

        monday = dt.date.today() - dt.timedelta(days=dt.date.today().weekday())
        schedule_seed = [
            (monday, "09:00", "11:00", 1, 3, 1, "GI-1"),
            (monday + dt.timedelta(days=1), "11:00", "13:00", 2, 3, 2, "GI-1"),
            (dt.date.today(), "14:00", "16:00", 3, 3, 1, "GI-1"),
        ]
        for item in schedule_seed:
            conn.execute(
                "INSERT INTO schedules(date,start_time,end_time,module_id,teacher_id,room_id,group_name) VALUES(?,?,?,?,?,?,?)",
                (item[0].isoformat(), *item[1:]),
            )
        conn.execute(
            "INSERT INTO absences(student_id,schedule_id,status,justification,created_at) VALUES(?,?,?,?,?)",
            (4, 1, "late", "Transport", now_utc().isoformat()),
        )
        conn.execute(
            "INSERT INTO progress(module_id,group_name,chapter,percent,updated_by,updated_at) VALUES(?,?,?,?,?,?)",
            (1, "GI-1", "APIs REST et JWT", 65, 3, now_utc().isoformat()),
        )
        for student_id in [4, 5]:
            conn.execute(
                "INSERT INTO payments(student_id,label,amount,due_date,paid_amount,status) VALUES(?,?,?,?,?,?)",
                (student_id, "Mensualite Juin", 1200, today_iso(), 0 if student_id == 4 else 1200, "late" if student_id == 4 else "paid"),
            )


def schedule_query(where="", params=()):
    sql = f"""
        SELECT s.*, m.name AS module_name, m.code AS module_code,
               u.name AS teacher_name, r.name AS room_name
        FROM schedules s
        JOIN modules m ON m.id = s.module_id
        JOIN users u ON u.id = s.teacher_id
        JOIN rooms r ON r.id = s.room_id
        {where}
        ORDER BY s.date, s.start_time
    """
    with db() as conn:
        return rows(conn.execute(sql, params))


def add_notification(user_id, channel, title, message):
    with db() as conn:
        conn.execute(
            "INSERT INTO notifications(user_id,channel,title,message,created_at) VALUES(?,?,?,?,?)",
            (user_id, channel, title, message, now_utc().isoformat()),
        )


class App(BaseHTTPRequestHandler):
    server_version = "CampusOps/1.0"

    def do_GET(self):
        self.route()

    def do_POST(self):
        self.route()

    def do_PUT(self):
        self.route()

    def do_DELETE(self):
        self.route()

    def route(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/":
            return self.static_file("index.html")
        if path.startswith("/static/"):
            return self.static_file(path.replace("/static/", "", 1))
        if path.startswith("/api/"):
            return self.api(path, parse_qs(parsed.query))
        self.reply({"error": "Not found"}, HTTPStatus.NOT_FOUND)

    def static_file(self, name):
        target = (ROOT / "static" / name).resolve()
        static_root = (ROOT / "static").resolve()
        if static_root not in target.parents and target != static_root:
            return self.reply({"error": "Invalid path"}, HTTPStatus.BAD_REQUEST)
        if not target.exists():
            return self.reply({"error": "Not found"}, HTTPStatus.NOT_FOUND)
        content_type = "text/html"
        if target.suffix == ".css":
            content_type = "text/css"
        if target.suffix == ".js":
            content_type = "application/javascript"
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if not length:
            return {}
        return json.loads(self.rfile.read(length).decode() or "{}")

    def current_user(self):
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return None
        token = parse_token(auth.replace("Bearer ", "", 1))
        if not token:
            return None
        with db() as conn:
            row = conn.execute("SELECT * FROM users WHERE id=?", (token["sub"],)).fetchone()
            return dict(row) if row else None

    def require_user(self):
        user = self.current_user()
        if not user:
            self.reply({"error": "Authentication required"}, HTTPStatus.UNAUTHORIZED)
            return None
        return user

    def require_roles(self, *roles_allowed):
        user = self.require_user()
        if not user:
            return None
        if user["role"] not in roles_allowed:
            self.reply({"error": "Forbidden"}, HTTPStatus.FORBIDDEN)
            return None
        return user

    def api(self, path, query):
        try:
            if path == "/api/health":
                return self.reply({"ok": True, "date": today_iso()})
            if path == "/api/auth/login" and self.command == "POST":
                data = self.body()
                with db() as conn:
                    user = conn.execute("SELECT * FROM users WHERE email=?", (data.get("email"),)).fetchone()
                if not user or not check_password(data.get("password", ""), user["password_hash"]):
                    return self.reply({"error": "Invalid credentials"}, HTTPStatus.UNAUTHORIZED)
                user = dict(user)
                return self.reply({"token": make_token(user), "user": safe_user(user)})
            if path == "/api/auth/me":
                user = self.require_user()
                return user and self.reply({"user": safe_user(user)})
            if path == "/api/auth/otp" and self.command == "POST":
                return self.create_otp()
            if path == "/api/auth/link-telegram" and self.command == "POST":
                return self.link_telegram()

            user = self.require_user()
            if not user:
                return

            if path == "/api/users":
                return self.users(user)
            if path.startswith("/api/users/"):
                return self.user_item(user, int(path.rsplit("/", 1)[1]))
            if path == "/api/schedules":
                return self.schedules(user, query)
            if path == "/api/absences":
                return self.absences(user)
            if path == "/api/progress":
                return self.progress(user)
            if path == "/api/payments":
                return self.payments(user)
            if path == "/api/notifications":
                return self.notifications(user)
            if path == "/api/openclaw/morning-schedule" and self.command == "POST":
                return self.openclaw_morning()
            if path == "/api/openclaw/check-late-payments" and self.command == "POST":
                return self.openclaw_late_payments()
            if path == "/api/mail/latest":
                return self.mail_latest()
            if path == "/api/mail/send" and self.command == "POST":
                return self.mail_send()
            return self.reply({"error": "Not found"}, HTTPStatus.NOT_FOUND)
        except Exception as exc:
            return self.reply({"error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def users(self, current):
        if current["role"] not in {"admin", "secretariat"}:
            return self.reply({"error": "Forbidden"}, HTTPStatus.FORBIDDEN)
        if self.command == "GET":
            with db() as conn:
                data = rows(conn.execute("SELECT * FROM users ORDER BY role,name"))
            return self.reply({"users": [safe_user(u) for u in data]})
        if self.command == "POST":
            data = self.body()
            if data.get("role") not in ROLES:
                return self.reply({"error": "Invalid role"}, HTTPStatus.BAD_REQUEST)
            with db() as conn:
                cur = conn.execute(
                    "INSERT INTO users(name,email,role,group_name,parent_contact,password_hash,created_at) VALUES(?,?,?,?,?,?,?)",
                    (
                        data["name"],
                        data["email"],
                        data["role"],
                        data.get("group_name"),
                        data.get("parent_contact"),
                        hash_password(data.get("password", "campus123")),
                        now_utc().isoformat(),
                    ),
                )
            return self.reply({"id": cur.lastrowid}, HTTPStatus.CREATED)
        return self.reply({"error": "Method not allowed"}, HTTPStatus.METHOD_NOT_ALLOWED)

    def user_item(self, current, user_id):
        if current["role"] not in {"admin", "secretariat"}:
            return self.reply({"error": "Forbidden"}, HTTPStatus.FORBIDDEN)
        if self.command == "DELETE":
            with db() as conn:
                conn.execute("DELETE FROM users WHERE id=?", (user_id,))
            return self.reply({"deleted": True})
        if self.command == "PUT":
            data = self.body()
            with db() as conn:
                conn.execute(
                    "UPDATE users SET name=?, role=?, group_name=?, parent_contact=? WHERE id=?",
                    (data["name"], data["role"], data.get("group_name"), data.get("parent_contact"), user_id),
                )
            return self.reply({"updated": True})
        return self.reply({"error": "Method not allowed"}, HTTPStatus.METHOD_NOT_ALLOWED)

    def schedules(self, user, query):
        if self.command == "GET":
            scope = query.get("scope", ["week"])[0]
            if scope == "today":
                data = schedule_query("WHERE s.date=?", (today_iso(),))
            else:
                start, end = week_bounds()
                data = schedule_query("WHERE s.date BETWEEN ? AND ?", (start, end))
            return self.reply({"schedules": filter_for_user(data, user)})
        if self.command == "POST":
            if user["role"] not in {"admin", "secretariat"}:
                return self.reply({"error": "Forbidden"}, HTTPStatus.FORBIDDEN)
            data = self.body()
            with db() as conn:
                cur = conn.execute(
                    "INSERT INTO schedules(date,start_time,end_time,module_id,teacher_id,room_id,group_name) VALUES(?,?,?,?,?,?,?)",
                    (data["date"], data["start_time"], data["end_time"], data["module_id"], data["teacher_id"], data["room_id"], data["group_name"]),
                )
            return self.reply({"id": cur.lastrowid}, HTTPStatus.CREATED)
        return self.reply({"error": "Method not allowed"}, HTTPStatus.METHOD_NOT_ALLOWED)

    def absences(self, user):
        if self.command == "GET":
            sql = """
                SELECT a.*, u.name AS student_name, s.date, s.start_time, m.name AS module_name
                FROM absences a
                JOIN users u ON u.id = a.student_id
                JOIN schedules s ON s.id = a.schedule_id
                JOIN modules m ON m.id = s.module_id
            """
            params = ()
            if user["role"] == "student":
                sql += " WHERE a.student_id=?"
                params = (user["id"],)
            sql += " ORDER BY a.created_at DESC"
            with db() as conn:
                return self.reply({"absences": rows(conn.execute(sql, params))})
        if self.command == "POST":
            if user["role"] not in {"admin", "secretariat", "teacher"}:
                return self.reply({"error": "Forbidden"}, HTTPStatus.FORBIDDEN)
            data = self.body()
            with db() as conn:
                cur = conn.execute(
                    "INSERT INTO absences(student_id,schedule_id,status,justification,created_at) VALUES(?,?,?,?,?)",
                    (data["student_id"], data["schedule_id"], data["status"], data.get("justification"), now_utc().isoformat()),
                )
            add_notification(data["student_id"], "telegram", "Absence", f"Statut enregistre: {data['status']}")
            return self.reply({"id": cur.lastrowid, "notification": "created"}, HTTPStatus.CREATED)
        return self.reply({"error": "Method not allowed"}, HTTPStatus.METHOD_NOT_ALLOWED)

    def progress(self, user):
        if self.command == "GET":
            sql = """
                SELECT p.*, m.name AS module_name, u.name AS updated_by_name
                FROM progress p
                JOIN modules m ON m.id = p.module_id
                JOIN users u ON u.id = p.updated_by
                ORDER BY p.updated_at DESC
            """
            with db() as conn:
                data = rows(conn.execute(sql))
            if user["role"] == "student":
                data = [p for p in data if p["group_name"] == user["group_name"]]
            return self.reply({"progress": data})
        if self.command == "POST":
            if user["role"] not in {"admin", "teacher"}:
                return self.reply({"error": "Forbidden"}, HTTPStatus.FORBIDDEN)
            data = self.body()
            with db() as conn:
                cur = conn.execute(
                    "INSERT INTO progress(module_id,group_name,chapter,percent,updated_by,updated_at) VALUES(?,?,?,?,?,?)",
                    (data["module_id"], data["group_name"], data["chapter"], int(data["percent"]), user["id"], now_utc().isoformat()),
                )
            return self.reply({"id": cur.lastrowid}, HTTPStatus.CREATED)
        return self.reply({"error": "Method not allowed"}, HTTPStatus.METHOD_NOT_ALLOWED)

    def payments(self, user):
        if self.command == "GET":
            sql = """
                SELECT p.*, u.name AS student_name
                FROM payments p JOIN users u ON u.id = p.student_id
            """
            params = ()
            if user["role"] == "student":
                sql += " WHERE p.student_id=?"
                params = (user["id"],)
            sql += " ORDER BY p.due_date"
            with db() as conn:
                return self.reply({"payments": rows(conn.execute(sql, params))})
        if self.command == "POST":
            if user["role"] not in {"admin", "secretariat"}:
                return self.reply({"error": "Forbidden"}, HTTPStatus.FORBIDDEN)
            data = self.body()
            status = payment_status(float(data["amount"]), float(data.get("paid_amount", 0)), data["due_date"])
            with db() as conn:
                cur = conn.execute(
                    "INSERT INTO payments(student_id,label,amount,due_date,paid_amount,status) VALUES(?,?,?,?,?,?)",
                    (data["student_id"], data["label"], data["amount"], data["due_date"], data.get("paid_amount", 0), status),
                )
            return self.reply({"id": cur.lastrowid, "status": status}, HTTPStatus.CREATED)
        return self.reply({"error": "Method not allowed"}, HTTPStatus.METHOD_NOT_ALLOWED)

    def notifications(self, user):
        sql = "SELECT * FROM notifications"
        params = ()
        if user["role"] == "student":
            sql += " WHERE user_id=?"
            params = (user["id"],)
        sql += " ORDER BY created_at DESC LIMIT 50"
        with db() as conn:
            return self.reply({"notifications": rows(conn.execute(sql, params))})

    def create_otp(self):
        user = self.require_user()
        if not user:
            return
        code = secrets.token_hex(3).upper()
        expires = (now_utc() + dt.timedelta(minutes=10)).isoformat()
        with db() as conn:
            conn.execute("INSERT INTO otp_links(user_id,code,expires_at) VALUES(?,?,?)", (user["id"], code, expires))
        return self.reply({"code": code, "expires_at": expires})

    def link_telegram(self):
        data = self.body()
        with db() as conn:
            link = conn.execute(
                "SELECT * FROM otp_links WHERE code=? AND used_at IS NULL",
                (data.get("code"),),
            ).fetchone()
            if not link or link["expires_at"] < now_utc().isoformat():
                return self.reply({"error": "Invalid or expired code"}, HTTPStatus.BAD_REQUEST)
            conn.execute("UPDATE users SET telegram_chat_id=? WHERE id=?", (data["chat_id"], link["user_id"]))
            conn.execute("UPDATE otp_links SET used_at=? WHERE id=?", (now_utc().isoformat(), link["id"]))
        return self.reply({"linked": True})

    def openclaw_morning(self):
        sent = 0
        schedules = schedule_query("WHERE s.date=?", (today_iso(),))
        with db() as conn:
            teachers = rows(conn.execute("SELECT id,name FROM users WHERE role='teacher'"))
            groups = rows(conn.execute("SELECT DISTINCT group_name FROM users WHERE role='student' AND group_name IS NOT NULL"))
        for teacher in teachers:
            lines = [s for s in schedules if s["teacher_name"] == teacher["name"]]
            if lines:
                add_notification(teacher["id"], "telegram", "Planning du jour", format_schedule(lines))
                sent += 1
        for group in groups:
            lines = [s for s in schedules if s["group_name"] == group["group_name"]]
            if lines:
                add_notification(None, "whatsapp", f"Planning {group['group_name']}", format_schedule(lines))
                sent += 1
        return self.reply({"workflow": "morning_schedule", "notifications_created": sent})

    def openclaw_late_payments(self):
        with db() as conn:
            payments = rows(
                conn.execute(
                    """
                    SELECT p.*, u.name AS student_name
                    FROM payments p
                    JOIN users u ON u.id=p.student_id
                    WHERE p.status != 'paid' AND (p.status IN ('unpaid','partial','late') OR p.due_date <= ?)
                    """,
                    (today_iso(),),
                )
            )
            for payment in payments:
                conn.execute("UPDATE payments SET status='late' WHERE id=?", (payment["id"],))
                conn.execute(
                    "INSERT INTO notifications(user_id,channel,title,message,created_at) VALUES(?,?,?,?,?)",
                    (
                        payment["student_id"],
                        "telegram",
                        "Paiement en retard",
                        f"{payment['label']} est en retard. Montant restant: {payment['amount'] - payment['paid_amount']:.2f}",
                        now_utc().isoformat(),
                    ),
                )
                staff = rows(conn.execute("SELECT id FROM users WHERE role IN ('admin','secretariat')"))
                for member in staff:
                    conn.execute(
                        "INSERT INTO notifications(user_id,channel,title,message,created_at) VALUES(?,?,?,?,?)",
                        (
                            member["id"],
                            "internal",
                            "Tache de relance paiement",
                            f"Relancer {payment['student_name']} pour {payment['label']}.",
                            now_utc().isoformat(),
                        ),
                    )
        return self.reply({"workflow": "late_payments", "late_count": len(payments)})

    def mail_latest(self):
        host = os.environ.get("IMAP_HOST")
        user = os.environ.get("IMAP_USER")
        password = os.environ.get("IMAP_PASSWORD")
        if not all([host, user, password]):
            return self.reply({"mails": demo_mails(), "mode": "demo", "note": "Set IMAP_HOST, IMAP_USER and IMAP_PASSWORD for a real inbox."})
        with imaplib.IMAP4_SSL(host) as mailbox:
            mailbox.login(user, password)
            mailbox.select("INBOX")
            _, data = mailbox.search(None, "ALL")
            ids = data[0].split()[-10:]
            messages = []
            for mail_id in reversed(ids):
                _, fetched = mailbox.fetch(mail_id, "(RFC822)")
                msg = email.message_from_bytes(fetched[0][1])
                preview = ""
                if msg.is_multipart():
                    for part in msg.walk():
                        if part.get_content_type() == "text/plain":
                            preview = part.get_payload(decode=True).decode(errors="ignore")[:180]
                            break
                else:
                    payload = msg.get_payload(decode=True) or b""
                    preview = payload.decode(errors="ignore")[:180]
                messages.append({"from": msg.get("From"), "subject": msg.get("Subject"), "date": msg.get("Date"), "preview": preview})
        return self.reply({"mails": messages, "mode": "imap"})

    def mail_send(self):
        data = self.body()
        host = os.environ.get("SMTP_HOST")
        user = os.environ.get("SMTP_USER")
        password = os.environ.get("SMTP_PASSWORD")
        port = int(os.environ.get("SMTP_PORT", "587"))
        if not all([host, user, password]):
            add_notification(None, "email", data.get("subject", "Email demo"), data.get("body", ""))
            return self.reply({"sent": False, "mode": "demo", "note": "SMTP not configured; saved as internal notification."})
        msg = EmailMessage()
        msg["From"] = user
        msg["To"] = data["to"]
        msg["Subject"] = data["subject"]
        msg.set_content(data.get("body", ""))
        with smtplib.SMTP(host, port) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(msg)
        return self.reply({"sent": True, "mode": "smtp"})

    def reply(self, data, status=HTTPStatus.OK):
        raw = json.dumps(data, ensure_ascii=False, indent=2).encode()
        self.send_response(int(status))
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


def safe_user(user):
    return {k: user[k] for k in user.keys() if k != "password_hash"}


def filter_for_user(data, user):
    if user["role"] == "student":
        return [s for s in data if s["group_name"] == user["group_name"]]
    if user["role"] == "teacher":
        return [s for s in data if s["teacher_id"] == user["id"]]
    return data


def payment_status(amount, paid, due_date):
    if paid >= amount:
        return "paid"
    if due_date < today_iso():
        return "late"
    if paid > 0:
        return "partial"
    return "unpaid"


def format_schedule(items):
    return "\n".join(
        f"{item['start_time']}-{item['end_time']} {item['module_name']} {item['room_name']} ({item['group_name']})"
        for item in items
    )


def demo_mails():
    return [
        {
            "from": "parent@example.com",
            "subject": "Absence justifiee Nadia",
            "date": now_utc().isoformat(),
            "preview": "Bonjour, voici le justificatif pour le retard de Nadia.",
        },
        {
            "from": "bank@example.com",
            "subject": "Paiement recu Omar",
            "date": now_utc().isoformat(),
            "preview": "Confirmation de paiement pour la mensualite de juin.",
        },
    ]


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", "8000"))
    print(f"CampusOps running on http://localhost:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), App).serve_forever()
