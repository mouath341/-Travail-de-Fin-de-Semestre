const state = { token: localStorage.getItem("token"), user: null, view: "dashboard" };
const loginPage = document.querySelector("#loginPage");
const appShell = document.querySelector("#appShell");
const statusEl = document.querySelector("#status");
const content = document.querySelector("#content");
const userName = document.querySelector("#userName");
const userRole = document.querySelector("#userRole");

function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  return fetch(path, { ...options, headers }).then(async (res) => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur API");
    return data;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(text, type = "info") {
  statusEl.className = `status ${type}`;
  statusEl.textContent = text;
}

function showApp() {
  loginPage.classList.add("hidden");
  appShell.classList.remove("hidden");
  userName.textContent = state.user?.name || "Utilisateur";
  userRole.textContent = state.user?.role || "";
}

function showLogin() {
  appShell.classList.add("hidden");
  loginPage.classList.remove("hidden");
}

function table(rows, columns) {
  if (!rows.length) return "<div class='empty-state'>Aucune donnee pour le moment.</div>";
  return `<div class="table-wrap"><table><thead><tr>${columns.map(c => `<th>${c.label}</th>`).join("")}</tr></thead><tbody>${
    rows.map(row => `<tr>${columns.map(c => `<td>${c.render ? c.render(row) : escapeHtml(row[c.key])}</td>`).join("")}</tr>`).join("")
  }</tbody></table></div>`;
}

function badge(value) {
  const clean = escapeHtml(value);
  return `<span class="badge badge-${clean}">${clean}</span>`;
}

async function login(event) {
  event.preventDefault();
  try {
    const email = document.querySelector("#email").value;
    const password = document.querySelector("#password").value;
    const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("token", state.token);
    showApp();
    setStatus(`Connecte: ${data.user.name} (${data.user.role}). Les chiffres affiches respectent les permissions du role.`, "success");
    render("dashboard");
  } catch (error) {
    alert(error.message);
  }
}

async function loadMe() {
  if (!state.token) {
    showLogin();
    return;
  }
  try {
    const data = await api("/api/auth/me");
    state.user = data.user;
    showApp();
    setStatus(`Connecte: ${data.user.name} (${data.user.role}).`, "success");
  } catch {
    localStorage.removeItem("token");
    state.token = null;
    showLogin();
  }
}

async function render(view) {
  if (!state.token) {
    showLogin();
    return;
  }
  state.view = view;
  document.querySelectorAll("[data-view]").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
  const views = { dashboard, planning, absences, payments, progress, notifications, mail };
  try {
    await views[view]();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function dashboard() {
  const [todayData, weekData, absenceData, paymentData, progressData, notifData] = await Promise.all([
    api("/api/schedules?scope=today"),
    api("/api/schedules?scope=week"),
    api("/api/absences"),
    api("/api/payments"),
    api("/api/progress"),
    api("/api/notifications")
  ]);
  const late = paymentData.payments.filter(p => p.status === "late").length;
  content.innerHTML = `
    <section class="page-title">
      <div>
        <p class="eyebrow">Vue generale</p>
        <h2>Ce que ${escapeHtml(state.user.name)} peut voir</h2>
      </div>
      <p>Admin voit tout le campus. Enseignant voit ses cours. Etudiant voit son groupe, ses absences et ses paiements.</p>
    </section>
    <div class="grid">
      ${metricCard("Cours aujourd'hui", todayData.schedules.length, "Nombre de seances prevues aujourd'hui dans ton perimetre.")}
      ${metricCard("Cours cette semaine", weekData.schedules.length, "Total de seances visibles pour la semaine courante.")}
      ${metricCard("Absences/retards", absenceData.absences.length, "Total des enregistrements d'assiduite visibles.")}
      ${metricCard("Paiements en retard", late, "Dossiers qui demandent une relance administrative.")}
      ${metricCard("Avancement moyen", `${avg(progressData.progress.map(p => p.percent))}%`, "Progression moyenne des modules visibles.")}
      ${metricCard("Notifications", notifData.notifications.length, "Messages crees par actions manuelles ou workflows.")}
    </div>
    <section class="split">
      <div>
        <h2>Planning du jour</h2>
        ${table(todayData.schedules, [
          { key: "start_time", label: "Debut" },
          { key: "end_time", label: "Fin" },
          { key: "module_name", label: "Module" },
          { key: "teacher_name", label: "Enseignant" },
          { key: "room_name", label: "Salle" }
        ])}
      </div>
      <div class="panel explain">
        <h3>Comment lire ce tableau</h3>
        <p>Les nombres ne sont pas inventes: ils viennent directement de l'API et de SQLite. Change de role avec un autre compte demo pour montrer la difference de permissions.</p>
        <button onclick="render('payments')" class="warning">Voir paiements</button>
        <button onclick="render('mail')" class="secondary">Tester email</button>
      </div>
    </section>`;
}

function metricCard(title, value, help) {
  return `<div class="card metric-card"><h3>${title}</h3><div class="metric">${value}</div><p>${help}</p></div>`;
}

async function planning() {
  const data = await api("/api/schedules?scope=week");
  content.innerHTML = `
    <section class="page-title">
      <div><p class="eyebrow">Organisation</p><h2>Planning de la semaine</h2></div>
      <p>Admin et secretariat peuvent ajouter des seances. Les autres roles consultent seulement leur planning.</p>
    </section>
    <div class="split">
      <div>${table(data.schedules, [
        { key: "id", label: "ID" },
        { key: "date", label: "Date" },
        { label: "Horaire", render: r => `${escapeHtml(r.start_time)} - ${escapeHtml(r.end_time)}` },
        { key: "module_name", label: "Module" },
        { key: "teacher_name", label: "Enseignant" },
        { key: "room_name", label: "Salle" },
        { key: "group_name", label: "Groupe" }
      ])}</div>
      <form class="panel" id="scheduleForm">
        <h3>Ajouter une seance</h3>
        <p class="form-help">Demo data: module 1-3, teacher 3, room 1-2, groupe GI-1.</p>
        <input name="date" type="date" required>
        <div class="two">
          <input name="start_time" placeholder="09:00" required>
          <input name="end_time" placeholder="11:00" required>
        </div>
        <div class="two">
          <input name="module_id" placeholder="Module ID" required>
          <input name="teacher_id" placeholder="Teacher ID" required>
        </div>
        <div class="two">
          <input name="room_id" placeholder="Room ID" required>
          <input name="group_name" value="GI-1" required>
        </div>
        <button>Creer la seance</button>
      </form>
    </div>`;
  const dateInput = document.querySelector("[name='date']");
  dateInput.valueAsDate = new Date();
  document.querySelector("#scheduleForm").addEventListener("submit", submitForm("/api/schedules", "planning", "Seance ajoutee."));
}

async function absences() {
  const data = await api("/api/absences");
  content.innerHTML = `
    <section class="page-title">
      <div><p class="eyebrow">Assiduite</p><h2>Absences et retards</h2></div>
      <p>Quand une absence est enregistree, CampusOps cree automatiquement une notification pour l'etudiant.</p>
    </section>
    <div class="split">
      <div>${table(data.absences, [
        { key: "student_name", label: "Etudiant" },
        { key: "date", label: "Date" },
        { key: "module_name", label: "Module" },
        { key: "status", label: "Statut", render: r => badge(r.status) },
        { key: "justification", label: "Justification" }
      ])}</div>
      <form class="panel" id="absenceForm">
        <h3>Marquer une presence</h3>
        <p class="form-help">Utilise student ID 4 ou 5 et schedule ID visible dans Planning.</p>
        <input name="student_id" placeholder="ID etudiant" required>
        <input name="schedule_id" placeholder="ID planning" required>
        <select name="status"><option>absent</option><option>late</option><option>present</option></select>
        <input name="justification" placeholder="Justification">
        <button>Enregistrer</button>
      </form>
    </div>`;
  document.querySelector("#absenceForm").addEventListener("submit", submitForm("/api/absences", "absences", "Absence enregistree et notification creee."));
}

async function payments() {
  const data = await api("/api/payments");
  const remaining = data.payments.reduce((sum, p) => sum + Math.max(0, Number(p.amount) - Number(p.paid_amount)), 0);
  content.innerHTML = `
    <section class="page-title">
      <div><p class="eyebrow">Finance</p><h2>Paiements</h2></div>
      <p>Le workflow OpenClaw verifie les impayes, passe les dossiers en retard et cree des taches de relance.</p>
    </section>
    <div class="action-row">
      <div class="panel mini"><strong>Reste a payer visible</strong><span>${remaining.toFixed(2)} MAD</span></div>
      <button class="warning" id="latePayments">Lancer OpenClaw: relances paiement</button>
    </div>
    <div id="paymentResult"></div>
    ${table(data.payments, [
      { key: "student_name", label: "Etudiant" },
      { key: "label", label: "Libelle" },
      { key: "amount", label: "Montant" },
      { key: "paid_amount", label: "Paye" },
      { key: "due_date", label: "Echeance" },
      { key: "status", label: "Etat", render: r => badge(r.status) }
    ])}`;
  document.querySelector("#latePayments").onclick = async () => {
    const result = await api("/api/openclaw/check-late-payments", { method: "POST", body: "{}" });
    setStatus(`OpenClaw a traite ${result.late_count} paiement(s) et cree les notifications/taches de relance.`, "success");
    document.querySelector("#paymentResult").innerHTML = `<div class="workflow-result">Workflow execute: ${result.late_count} dossier(s) a relancer. Va dans Notifications pour voir les taches internes.</div>`;
    setTimeout(() => payments(), 900);
  };
}

async function progress() {
  const data = await api("/api/progress");
  content.innerHTML = `
    <section class="page-title">
      <div><p class="eyebrow">Pedagogie</p><h2>Suivi d'avancement</h2></div>
      <p>Chaque ligne indique le chapitre courant et le pourcentage d'avancement par groupe.</p>
    </section>
    ${table(data.progress, [
      { key: "module_name", label: "Module" },
      { key: "group_name", label: "Groupe" },
      { key: "chapter", label: "Chapitre" },
      { key: "percent", label: "Avancement", render: r => `<div class="progress-bar"><span style="width:${Number(r.percent)}%"></span></div>${Number(r.percent)}%` },
      { key: "updated_by_name", label: "Par" }
    ])}`;
}

async function notifications() {
  const data = await api("/api/notifications");
  content.innerHTML = `
    <section class="page-title">
      <div><p class="eyebrow">Communication</p><h2>Notifications</h2></div>
      <p>Les notifications sont creees par absences, relances paiement, planning du matin et email demo.</p>
    </section>
    <div class="action-row">
      <button id="morning">Lancer OpenClaw: planning du matin</button>
      <button class="secondary" onclick="render('payments')">Tester relance paiement</button>
    </div>
    ${table(data.notifications, [
      { key: "created_at", label: "Date" },
      { key: "channel", label: "Canal", render: r => badge(r.channel) },
      { key: "title", label: "Titre" },
      { key: "message", label: "Message" },
      { key: "status", label: "Statut", render: r => badge(r.status) }
    ])}`;
  document.querySelector("#morning").onclick = async () => {
    const result = await api("/api/openclaw/morning-schedule", { method: "POST", body: "{}" });
    setStatus(`OpenClaw planning du matin: ${result.notifications_created} notification(s) creee(s).`, "success");
    notifications();
  };
}

async function mail() {
  const data = await api("/api/mail/latest");
  content.innerHTML = `
    <section class="page-title">
      <div><p class="eyebrow">Email sans navigateur</p><h2>Boite email (${escapeHtml(data.mode)})</h2></div>
      <p>En mode demo, l'app simule IMAP/SMTP. Avec `.env.example`, elle peut lire IMAP et envoyer SMTP reellement.</p>
    </section>
    <div class="split">
      <div>
        <h2>Derniers emails</h2>
        ${table(data.mails, [
          { key: "from", label: "De" },
          { key: "subject", label: "Sujet" },
          { key: "date", label: "Date" },
          { key: "preview", label: "Apercu" }
        ])}
      </div>
      <form class="panel" id="mailForm">
        <h3>Envoyer un email</h3>
        <p class="form-help">Sans SMTP configure, l'envoi est garde comme notification interne demo.</p>
        <input name="to" type="email" value="student@example.com" required>
        <input name="subject" value="Rappel CampusOps" required>
        <textarea name="body" rows="5">Bonjour, merci de verifier votre situation CampusOps.</textarea>
        <button>Envoyer / simuler</button>
        <div id="mailResult"></div>
      </form>
    </div>`;
  document.querySelector("#mailForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target).entries());
    const result = await api("/api/mail/send", { method: "POST", body: JSON.stringify(values) });
    document.querySelector("#mailResult").innerHTML = `<div class="workflow-result">${result.sent ? "Email envoye par SMTP." : "SMTP non configure: email simule et notification creee."}</div>`;
    setStatus(result.note || "Email traite.", "success");
  });
}

function submitForm(url, view, message) {
  return async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target).entries());
    await api(url, { method: "POST", body: JSON.stringify(values) });
    setStatus(message || "Action terminee.", "success");
    render(view);
  };
}

function avg(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + Number(b), 0) / values.length);
}

function logout() {
  localStorage.removeItem("token");
  state.token = null;
  state.user = null;
  showLogin();
}

document.querySelector("#loginForm").addEventListener("submit", login);
document.querySelector("#logoutBtn").addEventListener("click", logout);
document.querySelectorAll("[data-view]").forEach(btn => btn.addEventListener("click", () => render(btn.dataset.view)));
loadMe().then(() => {
  if (state.token) render("dashboard");
});
