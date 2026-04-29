// js/app.js — AXON-LAB v2.0  |  Punto de entrada principal
import { initAuth, cerrarSesion, actualizarUIGlobal, haySesionActiva, registrarUsuario, iniciarSesion, iniciarSesionConGoogle, recuperarPassword, supabase } from './auth.js';
import { initRouter } from './router.js';

// ─── Actualizar UI completa ───────────────────────────────────────────────────
function actualizarUI() {
    actualizarUIGlobal();
}

// ─── Logout ───────────────────────────────────────────────────────────────────
function setupLogout() {
    document.getElementById('logoutNavLink')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await cerrarSesion();
        actualizarUI();
        window.location.hash = 'inicio';
    });
}

// ─── Menú móvil ───────────────────────────────────────────────────────────────
function setupMobileMenu() {
    const toggle  = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!toggle || !sidebar || !overlay) return;

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    });
    overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    });
    // Cerrar sidebar al navegar en móvil
    document.addEventListener('hashchange', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    });
}

// ─── Escuchar eventos de auth ─────────────────────────────────────────────────
function setupAuthListener() {
    document.addEventListener('authChanged', () => {
        actualizarUI();
    });
}

// ─── Dark mode toggle ─────────────────────────────────────────────────────────
function setupDarkMode() {
    const btn = document.getElementById('darkModeToggle');
    if (!btn) return;
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) document.body.classList.add('dark-mode');
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const now = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', now);
        btn.textContent = now ? '☀️' : '🌙';
    });
}

// ─── Exponer globalmente para páginas inline ──────────────────────────────────
window.haySesionActiva      = haySesionActiva;
window.actualizarUIGlobal   = actualizarUIGlobal;
window.registrarUsuario     = registrarUsuario;
window.iniciarSesion        = iniciarSesion;
window.iniciarSesionConGoogle = iniciarSesionConGoogle;
window.recuperarPassword    = recuperarPassword;
window.supabaseClient       = supabase;

// ─── Inicializar ──────────────────────────────────────────────────────────────
async function initApp() {
    console.log('🚀 AXON-LAB iniciando…');

    await initAuth();
    actualizarUI();
    setupLogout();
    setupMobileMenu();
    setupAuthListener();
    setupDarkMode();
    initRouter();

    // Ocultar loader inicial
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) loader.style.opacity = "0";
        document.getElementById("initialLoader")?.classList.add("hidden");;
        setTimeout(() => loader && (loader.style.display = 'none'), 300);
    }, 400);

    console.log('✅ AXON-LAB listo');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
