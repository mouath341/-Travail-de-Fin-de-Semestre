"""
DevOps Monitor — Application fil rouge
Module Cloud & Infrastructure — Séance 1 Docker
ENSA Fès — Promo Cloud 2026
"""

from flask import Flask, jsonify
import os
import socket
import datetime
import threading

app = Flask(__name__)
lock = threading.Lock()

# Configuration via variable d'environnement (12-Factor App)
MESSAGE = os.environ.get("APP_MESSAGE", "Bonjour depuis DevOps Monitor !")
LOG_DIR = "/app/logs"
LOG_FILE = os.path.join(LOG_DIR, "visits.log")

visits = 0
os.makedirs(LOG_DIR, exist_ok=True)


def record_visit(path):
    """Enregistre une visite dans le compteur et le fichier de log."""
    global visits
    with lock:
        visits += 1
        with open(LOG_FILE, "a") as f:
            f.write(f"{datetime.datetime.utcnow().isoformat()} {path}\n")


@app.route("/")
def home():
    """Page d'accueil — affiche le message personnalisé et le compteur de visites."""
    record_visit("/")
    return f"""
    <html><body style='font-family:sans-serif;padding:40px;background:#f4f4f4'>
    <h1 style='color:#2c3e50'>{MESSAGE}</h1>
    <p>Conteneur : <b>{socket.gethostname()}</b></p>
    <p>Visites : <b>{visits}</b></p>
    <p>Heure UTC : <b>{datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}</b></p>
    <hr>
    <p>
      <a href='/health' style='margin-right:20px'>/health</a>
      <a href='/stats'>/stats</a>
    </p>
    </body></html>
    """


@app.route("/health")
def health():
    """Health check endpoint — utilisé par Kubernetes pour liveness/readiness probes."""
    return jsonify({
        "status": "ok",
        "hostname": socket.gethostname(),
        "utc": datetime.datetime.utcnow().isoformat() + "Z"
    })


@app.route("/stats")
def stats():
    """Expose les métriques de l'application."""
    log_lines = 0
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE) as f:
            log_lines = sum(1 for _ in f)
    return jsonify({
        "visits": visits,
        "log_lines": log_lines,
        "hostname": socket.gethostname()
    })


if __name__ == "__main__":
    # host="0.0.0.0" obligatoire pour être accessible depuis l'extérieur du conteneur
    app.run(host="0.0.0.0", port=5000, debug=False)
