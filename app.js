const config = window.WATCHERS_CONFIG || {};

const demoData = {
  concerts: [
    { date: "19 JUIN", title: "La Maroquinerie", city: "Paris · 20:30", sound: "Sono sur place" },
    { date: "04 JUIL.", title: "Le Ferrailleur", city: "Nantes · 21:00", sound: "Prévoir backline" },
    { date: "22 AOÛT", title: "Festival Les Nuits", city: "Angers · 19:15", sound: "Fiche technique envoyée" },
  ],
  rehearsals: [
    { date: "10 JUIN", title: "Studio Bleu", city: "Paris · 19:00–22:00", payer: "Thomas", paid: true },
    { date: "17 JUIN", title: "Studio Bleu", city: "Paris · 19:00–22:00", payer: "Julie", paid: false },
    { date: "01 JUIL.", title: "La Caisse Claire", city: "Montreuil · 20:00–23:00", payer: "Alex", paid: false },
  ],
  files: [
    { type: "MP3", name: "Watchers_Demo_V3.mp3", meta: "Julie · il y a 18 min" },
    { type: "PDF", name: "Fiche_technique_2026.pdf", meta: "Thomas · hier" },
    { type: "JPG", name: "Photos_Live_Nantes.zip", meta: "Marie · 2 juin" },
    { type: "DOC", name: "Setlist_ete_2026.docx", meta: "Alex · 30 mai" },
  ],
};

let supabaseClient = null;
let realtimeChannel = null;
let currentMemberName = "Alex";
let currentUser = null;

const bookingStatuses = {
  mail_sent: "Mail envoyé",
  rejected: "Refusé",
  negotiating: "En négociation",
  confirmed: "Validé",
};

const streamPlatforms = {
  spotify: { label: "Spotify", initial: "S" },
  apple_music: { label: "Apple Music", initial: "A" },
  youtube_music: { label: "YouTube Music", initial: "Y" },
  deezer: { label: "Deezer", initial: "D" },
  other: { label: "Autre", initial: "+" },
};

async function initSupabase() {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return;
  try {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
  } catch {
    showToast("Connexion au service indisponible, mode démo activé.");
  }
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

function openApp(name = "Alex", user = null) {
  currentMemberName = name;
  currentUser = user;
  document.querySelector("#login-screen").classList.add("hidden");
  document.querySelector("#app-shell").classList.remove("hidden");
  document.querySelector("#page-title").textContent = `Salut, ${name}`;
  subscribeToUpdates();
  loadConcerts();
  loadRehearsals();
  loadStreamingStats();
}

function closeApp() {
  document.querySelector("#app-shell").classList.add("hidden");
  document.querySelector("#login-screen").classList.remove("hidden");
  document.querySelector("#login-form").reset();
  currentUser = null;
  setView("dashboard");
}

function setAuthMode(mode) {
  const isSignup = mode === "signup";
  document.querySelector("#login-form").classList.toggle("hidden", isSignup);
  document.querySelector("#signup-form").classList.toggle("hidden", !isSignup);
  document.querySelector("#login-tab").classList.toggle("active", !isSignup);
  document.querySelector("#signup-tab").classList.toggle("active", isSignup);
  document.querySelector("#login-tab").setAttribute("aria-selected", String(!isSignup));
  document.querySelector("#signup-tab").setAttribute("aria-selected", String(isSignup));
}

function notifyUpdate(message) {
  showToast(message);
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Watchers", { body: message, icon: "./assets/icon.svg" });
  }
}

function subscribeToUpdates() {
  if (!supabaseClient || realtimeChannel) return;
  realtimeChannel = supabaseClient
    .channel("watchers-updates")
    .on("postgres_changes", { event: "*", schema: "public", table: "concerts" }, () => {
      notifyUpdate("La liste des concerts a été mise à jour.");
      loadConcerts();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "rehearsals" }, () => {
      notifyUpdate("La liste des répètes a été mise à jour.");
      loadRehearsals();
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "drive_files" }, () => notifyUpdate("Un nouveau fichier a été déposé."))
    .subscribe();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatConcertDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { badge: "", detail: "" };
  return {
    badge: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(date).replace(".", "").toUpperCase(),
    detail: new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

function renderConcerts(concerts, isDemo = false) {
  const normalized = isDemo
    ? concerts.map((item, index) => ({
        id: `demo-${index}`,
        title: item.title,
        venue: item.city.split(" · ")[0],
        city: item.city.split(" · ")[0],
        displayDate: item.city,
        dateBadge: item.date,
        sound_system: item.sound !== "Sono sur place",
        sound_notes: item.sound,
        booking_status: index === 0 ? "confirmed" : index === 1 ? "negotiating" : "mail_sent",
      }))
    : concerts.map((item) => {
        const formatted = formatConcertDate(item.starts_at);
        return { ...item, displayDate: formatted.detail, dateBadge: formatted.badge };
      });

  const list = document.querySelector("#concert-list");
  if (!normalized.length) {
    list.innerHTML = '<article class="event-card"><p>Aucun concert pour le moment. Ajoutez la première date.</p></article>';
    return;
  }

  list.innerHTML = normalized.map((item) => `
    <article class="event-card">
      <header>
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.venue)}${item.city && item.city !== item.venue ? ` · ${escapeHtml(item.city)}` : ""}</p>
          <p>${escapeHtml(item.displayDate)}</p>
        </div>
        <span class="tag tag-accent">${escapeHtml(item.dateBadge)}</span>
      </header>
      <div class="event-meta">
        <span class="booking-status ${escapeHtml(item.booking_status)}">${escapeHtml(bookingStatuses[item.booking_status] || "Mail envoyé")}</span>
        <span class="technical-tag">${item.sound_system ? "Technique nécessaire" : "Pas de technique"}</span>
      </div>
      ${item.sound_notes ? `<footer><span>Détails techniques</span><strong>${escapeHtml(item.sound_notes)}</strong></footer>` : ""}
    </article>`).join("");
}

async function loadConcerts() {
  if (!supabaseClient || !currentUser) {
    renderConcerts(demoData.concerts, true);
    return;
  }

  const { data, error } = await supabaseClient
    .from("concerts")
    .select("id,title,venue,city,starts_at,sound_system,sound_notes,booking_status,created_at")
    .order("starts_at", { ascending: true });

  if (error) {
    renderConcerts(demoData.concerts, true);
    showToast(error.message.includes("booking_status") ? "La mise à jour SQL Concerts reste à appliquer." : "Impossible de charger les concerts.");
    return;
  }

  renderConcerts(data);
}

function formatRehearsalDate(startsAt, endsAt) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime())) return { badge: "", detail: "" };
  const date = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "long" }).format(start);
  const startTime = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(start);
  const endTime = Number.isNaN(end.getTime()) ? "" : new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(end);
  return {
    badge: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(start).replace(".", "").toUpperCase(),
    detail: `${date} · ${startTime}${endTime ? `–${endTime}` : ""}`,
  };
}

function renderRehearsals(rehearsals, isDemo = false) {
  const normalized = isDemo
    ? rehearsals.map((item, index) => ({
        id: `demo-${index}`,
        venue: item.title,
        displayDate: item.city,
        dateBadge: item.date,
        payer_name: item.payer,
        amount: 45,
        is_paid: item.paid,
      }))
    : rehearsals.map((item) => {
        const formatted = formatRehearsalDate(item.starts_at, item.ends_at);
        return { ...item, displayDate: formatted.detail, dateBadge: formatted.badge };
      });

  const list = document.querySelector("#rehearsal-list");
  if (!normalized.length) {
    list.innerHTML = '<article class="event-card"><p>Aucune répète pour le moment. Ajoutez la première session.</p></article>';
    return;
  }

  list.innerHTML = normalized.map((item) => `
    <article class="event-card">
      <header>
        <div><h3>${escapeHtml(item.venue)}</h3><p>${escapeHtml(item.displayDate)}</p></div>
        <span class="tag">${escapeHtml(item.dateBadge)}</span>
      </header>
      <div class="rehearsal-details">
        <span>Payeur : ${escapeHtml(item.payer_name || "Non défini")}</span>
        <span>${Number(item.amount || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span>
      </div>
      <footer>
        <span>${item.is_paid ? "Paiement effectué" : "Paiement en attente"}</span>
        ${item.is_paid
          ? '<span class="status paid">Réglé</span>'
          : `<button class="status status-button pending" type="button" data-mark-paid="${escapeHtml(item.id)}">À régler</button>`}
      </footer>
    </article>`).join("");

  list.querySelectorAll("[data-mark-paid]").forEach((button) => {
    button.addEventListener("click", () => markRehearsalPaid(button.dataset.markPaid, button));
  });
}

async function loadRehearsals() {
  if (!supabaseClient || !currentUser) {
    renderRehearsals(demoData.rehearsals, true);
    return;
  }

  const { data, error } = await supabaseClient
    .from("rehearsals")
    .select("id,venue,starts_at,ends_at,amount,payer_name,is_paid,created_at")
    .order("starts_at", { ascending: true });

  if (error) {
    renderRehearsals(demoData.rehearsals, true);
    showToast(error.message.includes("payer_name") ? "La mise à jour SQL Répètes reste à appliquer." : "Impossible de charger les répètes.");
    return;
  }

  renderRehearsals(data);
}

async function markRehearsalPaid(id, button) {
  if (!supabaseClient || !currentUser || id.startsWith("demo-")) {
    button.textContent = "Réglé";
    button.classList.remove("pending", "status-button");
    button.classList.add("paid");
    button.removeAttribute("data-mark-paid");
    button.disabled = true;
    showToast("Statut modifié dans la version démo.");
    return;
  }

  button.disabled = true;
  button.textContent = "Mise à jour...";
  const { error } = await supabaseClient.from("rehearsals").update({ is_paid: true }).eq("id", id);
  if (error) {
    button.disabled = false;
    button.textContent = "À régler";
    showToast("Le règlement n'a pas pu être mis à jour.");
    return;
  }

  showToast("La répète est maintenant réglée.");
  await loadRehearsals();
}

function renderData() {
  renderConcerts(demoData.concerts, true);
  renderRehearsals(demoData.rehearsals, true);
  renderStreamingStats([
    { id: "demo-spotify", platform: "spotify", period_start: "2026-05-01", period_end: "2026-05-31", streams: 8945 },
    { id: "demo-apple", platform: "apple_music", period_start: "2026-05-01", period_end: "2026-05-31", streams: 2201 },
    { id: "demo-youtube", platform: "youtube_music", period_start: "2026-05-01", period_end: "2026-05-31", streams: 1336 },
  ], true);

  document.querySelector("#file-list").innerHTML = demoData.files.map((item) => `
    <article class="file-item">
      <span class="file-type">${item.type}</span>
      <div><strong>${item.name}</strong><small>${item.meta}</small></div>
      <span>›</span>
    </article>`).join("");
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function renderStreamingStats(rows, isDemo = false) {
  const total = rows.reduce((sum, row) => sum + Number(row.streams || 0), 0);
  const grouped = rows.reduce((result, row) => {
    result[row.platform] = (result[row.platform] || 0) + Number(row.streams || 0);
    return result;
  }, {});

  document.querySelector("#stream-total").textContent = total.toLocaleString("fr-FR");
  document.querySelector("#stream-chart").innerHTML = Object.entries(grouped).map(([platform, streams]) => {
    const height = total ? Math.max(12, Math.round((streams / Math.max(...Object.values(grouped))) * 100)) : 12;
    return `<i class="${escapeHtml(platform)}" style="height:${height}%" title="${escapeHtml(streamPlatforms[platform]?.label || platform)}"></i>`;
  }).join("");

  const platformList = document.querySelector("#platform-list");
  platformList.innerHTML = Object.entries(grouped).sort((a, b) => b[1] - a[1]).map(([platform, streams]) => {
    const info = streamPlatforms[platform] || streamPlatforms.other;
    const percentage = total ? ((streams / total) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "0";
    return `<article>
      <span class="platform ${escapeHtml(platform)}">${escapeHtml(info.initial)}</span>
      <div><strong>${escapeHtml(info.label)}</strong><small>${streams.toLocaleString("fr-FR")} écoutes</small></div>
      <b>${percentage} %</b>
    </article>`;
  }).join("") || '<article><div><strong>Aucune donnée</strong><small>Ajoutez votre premier relevé de streaming.</small></div></article>';

  const history = document.querySelector("#stream-history");
  history.innerHTML = [...rows].sort((a, b) => b.period_end.localeCompare(a.period_end)).map((row) => {
    const info = streamPlatforms[row.platform] || streamPlatforms.other;
    return `<article class="activity-item">
      <span class="platform ${escapeHtml(row.platform)}">${escapeHtml(info.initial)}</span>
      <div>
        <strong>${escapeHtml(info.label)} · ${Number(row.streams).toLocaleString("fr-FR")} écoutes</strong>
        <small>${formatShortDate(row.period_start)} au ${formatShortDate(row.period_end)}</small>
      </div>
      ${isDemo ? "" : `<button class="delete-stream" type="button" data-delete-stream="${escapeHtml(row.id)}">Supprimer</button>`}
    </article>`;
  }).join("") || '<article class="activity-item"><div><strong>Aucun historique</strong></div></article>';

  history.querySelectorAll("[data-delete-stream]").forEach((button) => {
    button.addEventListener("click", () => deleteStreamingStat(button.dataset.deleteStream));
  });
}

async function loadStreamingStats() {
  if (!supabaseClient || !currentUser) return;
  const { data, error } = await supabaseClient
    .from("streaming_stats")
    .select("id,platform,period_start,period_end,streams,imported_at")
    .order("period_end", { ascending: false });
  if (error) {
    showToast("Impossible de charger les données de streaming.");
    return;
  }
  renderStreamingStats(data);
}

async function deleteStreamingStat(id) {
  if (!supabaseClient || !currentUser) return;
  const { error } = await supabaseClient.from("streaming_stats").delete().eq("id", id);
  if (error) {
    showToast("Cette donnée n'a pas pu être supprimée.");
    return;
  }
  showToast("Donnée de streaming supprimée.");
  await loadStreamingStats();
}

function setView(viewName) {
  const target = document.querySelector(`#${viewName}-view`);
  if (!target) return;
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  target.classList.add("active");
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
  const titles = { dashboard: `Salut, ${currentMemberName}`, concerts: "Les dates", rehearsals: "Le planning", drive: "Les fichiers", stats: "Les chiffres", sales: "Les ventes" };
  document.querySelector("#page-title").textContent = titles[viewName] || "Watchers";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  if (!supabaseClient) {
    openApp(form.get("email").split("@")[0]);
    localStorage.setItem("watchers-session", "demo");
    showToast("Mode démo : Supabase reste à configurer.");
    return;
  }
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (error) return showToast("Identifiants incorrects.");
  openApp(data.user.user_metadata?.first_name || "le groupe", data.user);
});

document.querySelector("#signup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) {
    showToast("Configurez d'abord Supabase pour créer le compte.");
    return;
  }

  const form = new FormData(event.currentTarget);
  const { data, error } = await supabaseClient.auth.signUp({
    email: form.get("email"),
    password: form.get("password"),
    options: {
      data: { first_name: form.get("firstName") },
      emailRedirectTo: window.location.href.split("#")[0],
    },
  });

  if (error) {
    showToast(error.message.includes("Database error") ? "Cette adresse n'est pas autorisée." : error.message);
    return;
  }

  if (data.session) {
    openApp(data.user.user_metadata?.first_name || "David", data.user);
    showToast("Compte créé et connecté.");
  } else {
    setAuthMode("login");
    showToast("Compte créé. Confirmez le lien reçu par e-mail.");
  }
});

document.querySelector("#login-tab").addEventListener("click", () => setAuthMode("login"));
document.querySelector("#signup-tab").addEventListener("click", () => setAuthMode("signup"));
document.querySelector("#demo-button").addEventListener("click", () => {
  localStorage.setItem("watchers-session", "demo");
  openApp();
});
document.querySelector("#logout-button").addEventListener("click", async () => {
  localStorage.removeItem("watchers-session");
  if (supabaseClient) await supabaseClient.auth.signOut();
  if (realtimeChannel && supabaseClient) await supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = null;
  closeApp();
  showToast("Vous êtes déconnecté.");
});
document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
document.querySelectorAll(".quick-card").forEach((button) => button.addEventListener("click", () => setView(button.dataset.target)));
document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => showToast("Le formulaire des répètes arrive ensuite.")));

const concertDialog = document.querySelector("#concert-dialog");
const concertForm = document.querySelector("#concert-form");
const technicalCheckbox = document.querySelector("#concert-technical");

document.querySelector("#add-concert-button").addEventListener("click", () => concertDialog.showModal());
document.querySelector("#close-concert-dialog").addEventListener("click", () => concertDialog.close());
technicalCheckbox.addEventListener("change", () => {
  document.querySelector("#technical-notes-group").classList.toggle("hidden", !technicalCheckbox.checked);
});

concertForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(concertForm);
  const payload = {
    title: form.get("title").trim(),
    venue: form.get("venue").trim(),
    city: form.get("city").trim(),
    starts_at: new Date(form.get("startsAt")).toISOString(),
    sound_system: form.get("needsTechnical") === "on",
    sound_notes: form.get("technicalNotes").trim() || null,
    booking_status: form.get("status"),
    created_by: currentUser?.id || null,
  };

  if (!supabaseClient || !currentUser) {
    showToast("Connectez-vous avec un vrai compte pour partager ce concert.");
    return;
  }

  const saveButton = document.querySelector("#save-concert");
  saveButton.disabled = true;
  saveButton.textContent = "Enregistrement...";

  const { error } = await supabaseClient.from("concerts").insert(payload);
  saveButton.disabled = false;
  saveButton.textContent = "Enregistrer le concert";

  if (error) {
    showToast(error.message.includes("booking_status") ? "Appliquez d'abord la migration SQL Concerts." : "Le concert n'a pas pu être enregistré.");
    return;
  }

  concertForm.reset();
  document.querySelector("#technical-notes-group").classList.add("hidden");
  concertDialog.close();
  showToast("Concert ajouté pour tout le groupe.");
  await loadConcerts();
});

const rehearsalDialog = document.querySelector("#rehearsal-dialog");
const rehearsalForm = document.querySelector("#rehearsal-form");

document.querySelector("#add-rehearsal-button").addEventListener("click", () => rehearsalDialog.showModal());
document.querySelector("#close-rehearsal-dialog").addEventListener("click", () => rehearsalDialog.close());

rehearsalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(rehearsalForm);
  const startsAt = new Date(form.get("startsAt"));
  const endsAt = new Date(form.get("endsAt"));

  if (endsAt <= startsAt) {
    showToast("L'heure de fin doit être après le début.");
    return;
  }

  if (!supabaseClient || !currentUser) {
    showToast("Connectez-vous avec un vrai compte pour partager cette répète.");
    return;
  }

  const payload = {
    venue: form.get("venue").trim(),
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    amount: Number(form.get("amount")),
    payer_name: form.get("payerName").trim(),
    is_paid: form.get("isPaid") === "on",
    created_by: currentUser.id,
  };

  const saveButton = document.querySelector("#save-rehearsal");
  saveButton.disabled = true;
  saveButton.textContent = "Enregistrement...";
  const { error } = await supabaseClient.from("rehearsals").insert(payload);
  saveButton.disabled = false;
  saveButton.textContent = "Enregistrer la répète";

  if (error) {
    showToast(error.message.includes("payer_name") ? "Appliquez d'abord la migration SQL Répètes." : "La répète n'a pas pu être enregistrée.");
    return;
  }

  rehearsalForm.reset();
  rehearsalDialog.close();
  showToast("Répète ajoutée pour tout le groupe.");
  await loadRehearsals();
});

const streamDialog = document.querySelector("#stream-dialog");
const streamForm = document.querySelector("#stream-form");

document.querySelector("#add-stream-button").addEventListener("click", () => streamDialog.showModal());
document.querySelector("#close-stream-dialog").addEventListener("click", () => streamDialog.close());

streamForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(streamForm);
  if (form.get("periodEnd") < form.get("periodStart")) {
    showToast("La fin de période doit être après le début.");
    return;
  }
  if (!supabaseClient || !currentUser) {
    showToast("Connectez-vous avec un vrai compte pour enregistrer ces données.");
    return;
  }

  const button = document.querySelector("#save-stream");
  button.disabled = true;
  button.textContent = "Enregistrement...";
  const { error } = await supabaseClient.from("streaming_stats").insert({
    platform: form.get("platform"),
    period_start: form.get("periodStart"),
    period_end: form.get("periodEnd"),
    streams: Number(form.get("streams")),
  });
  button.disabled = false;
  button.textContent = "Enregistrer les écoutes";

  if (error) {
    showToast("Les écoutes n'ont pas pu être enregistrées.");
    return;
  }
  streamForm.reset();
  streamDialog.close();
  showToast("Données de streaming ajoutées.");
  await loadStreamingStats();
});

document.querySelector("#notification-button").addEventListener("click", async () => {
  if (!("Notification" in window)) return showToast("Notifications non prises en charge sur cet appareil.");
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    new Notification("Watchers", { body: "Les rappels du groupe sont activés.", icon: "./assets/icon.svg" });
    showToast("Notifications activées.");
  }
});

async function bootstrap() {
  renderData();
  document.querySelector("#drive-link").href = config.googleDriveFolderUrl || "https://drive.google.com";
  await initSupabase();

  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) {
      openApp(data.session.user.user_metadata?.first_name || "le groupe", data.session.user);
    }
  } else if (localStorage.getItem("watchers-session") === "demo") {
    openApp();
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
  }
}

bootstrap();
