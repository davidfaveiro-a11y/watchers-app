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

function openApp(name = "Alex") {
  currentMemberName = name;
  document.querySelector("#login-screen").classList.add("hidden");
  document.querySelector("#app-shell").classList.remove("hidden");
  document.querySelector("#page-title").textContent = `Salut, ${name}`;
  subscribeToUpdates();
}

function closeApp() {
  document.querySelector("#app-shell").classList.add("hidden");
  document.querySelector("#login-screen").classList.remove("hidden");
  document.querySelector("#login-form").reset();
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
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "concerts" }, () => notifyUpdate("Un nouveau concert a été ajouté."))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "rehearsals" }, () => notifyUpdate("Une nouvelle répète a été ajoutée."))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "drive_files" }, () => notifyUpdate("Un nouveau fichier a été déposé."))
    .subscribe();
}

function renderData() {
  document.querySelector("#concert-list").innerHTML = demoData.concerts.map((item) => `
    <article class="event-card">
      <header><div><h3>${item.title}</h3><p>${item.city}</p></div><span class="tag tag-accent">${item.date}</span></header>
      <footer><span>Sonorisation</span><strong>${item.sound}</strong></footer>
    </article>`).join("");

  document.querySelector("#rehearsal-list").innerHTML = demoData.rehearsals.map((item) => `
    <article class="event-card">
      <header><div><h3>${item.title}</h3><p>${item.city}</p></div><span class="tag">${item.date}</span></header>
      <footer><span>À régler par <strong>${item.payer}</strong></span><span class="status ${item.paid ? "paid" : "pending"}">${item.paid ? "Réglé" : "À régler"}</span></footer>
    </article>`).join("");

  document.querySelector("#file-list").innerHTML = demoData.files.map((item) => `
    <article class="file-item">
      <span class="file-type">${item.type}</span>
      <div><strong>${item.name}</strong><small>${item.meta}</small></div>
      <span>›</span>
    </article>`).join("");
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
  openApp(data.user.user_metadata?.first_name || "le groupe");
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
    openApp(data.user.user_metadata?.first_name || "David");
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
document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => document.querySelector("#add-dialog").showModal()));
document.querySelector("#save-item").addEventListener("click", () => showToast("Élément enregistré dans la version démo."));

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
      openApp(data.session.user.user_metadata?.first_name || "le groupe");
    }
  } else if (localStorage.getItem("watchers-session") === "demo") {
    openApp();
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
  }
}

bootstrap();
