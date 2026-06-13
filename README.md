# Travail de Fin de Semestre — Cloud & Applications Réparties

**Module** : Applications Réparties et Cybersécurité + Cloud Computing  
**Promotion** : Cloud 2026 — ENSA Fès  
**Étudiant** : Boyman

---

## Structure du dépôt

```
.
├── TP1-Docker/         → Séance 1 : Introduction à Docker (TPs 1–13)
├── TP2-Kubernetes/     → Séance 2 : Kubernetes & Kubeflow (TPs 1–10)
├── TP-AR-S5/           → Séance 5 AR : Systèmes Distribués (TPs 5.1–5.3)
├── Projet/             → Projet de fin de semestre (CampusOps)
├── Rapport-final/      → Rapport global PDF
└── README.md           → Ce fichier
```

---

## TP1 — Docker (Séance 1)

**Objectif** : Maîtriser la conteneurisation avec Docker.

### Lancement rapide de l'application fil rouge

```bash
cd TP1-Docker/

# Construire l'image
docker build -t devops-monitor:1.0 .

# Exécuter (message par défaut)
docker run -d --name monitor -p 8080:5000 devops-monitor:1.0

# Exécuter avec variable d'environnement personnalisée
docker run -d --name monitor \
  -p 8080:5000 \
  -e APP_MESSAGE="Bienvenue à l'ENSA Fès" \
  -v monitor-logs:/app/logs \
  devops-monitor:1.0

# Tester
curl http://localhost:8080/
curl http://localhost:8080/health
curl http://localhost:8080/stats

# Nettoyer
docker stop monitor && docker rm monitor
```

---

## TP2 — Kubernetes & Kubeflow (Séance 2)

**Objectif** : Orchestrer des conteneurs sur un cluster K8s et déployer Kubeflow.

**Prérequis** : 3 VMs Ubuntu 22.04 LTS (k8s-master, k8s-worker1, k8s-worker2) avec Kubernetes installé via kubeadm.

```bash
cd TP2-Kubernetes/

# TP3 — Créer un Deployment nginx
kubectl apply -f test-nginx.yaml
kubectl get pods -o wide
curl http://192.168.1.11:30080
kubectl delete -f test-nginx.yaml

# TP5 — Installation Kubeflow
cd ~/manifests
while ! kustomize build example | kubectl apply -f -; do
  echo "Retrying..."; sleep 10
done

# Vérifier l'installation
kubectl get pods -A
kubectl get ns
```

---

## TP-AR-S5 — Systèmes Distribués (Séance 5)

**Objectif** : Concevoir l'architecture d'un Système de Gestion Documentaire Distribué (SGDD).

Voir le dossier `TP-AR-S5/` pour :
- `architecture-sgdd.md` — TP5.1 Schématisation
- `analyse-defis.md` — TP5.2 Analyse des défis
- `matrice-securite.md` — TP5.3 Cartographie sécurité

---

## Rapport final

Voir `Rapport-final/rapport-final.pdf`.

---

## Critères de qualité

- Code source complet et fonctionnel
- README clair avec instructions de lancement
- Image Docker disponible (`devops-monitor:1.0`)
- Rapports détaillés pour chaque module
