// js/app.js — AXON-LAB v2.0  |  Punto de entrada principal
import { initAuth, cerrarSesion, actualizarUIGlobal, haySesionActiva, registrarUsuario, iniciarSesion, iniciarSesionConGoogle, recuperarPassword } from './auth.js';
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

    const closeMenu = () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    };

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    });
    overlay.addEventListener('click', closeMenu);
    // Cerrar sidebar al navegar (hashchange y botón atrás)
    window.addEventListener('hashchange', closeMenu);
    window.addEventListener('popstate', closeMenu);
}

// ─── Escuchar eventos de auth ─────────────────────────────────────────────────
function setupAuthListener() {
    document.addEventListener('authChanged', () => {
        actualizarUI();
    });
}

// ─── Dark mode toggle con preferencia del sistema ─────────────────────────────
function setupDarkMode() {
    const btn = document.getElementById('darkModeToggle');
    if (!btn) return;
    const saved = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved !== null ? saved === 'true' : prefersDark;
    if (isDark) document.body.classList.add('dark-mode');
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const now = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', now);
        btn.textContent = now ? '☀️' : '🌙';
    });
}

// ─── Ocultar loader correctamente ─────────────────────────────────────────────
function hideLoaders() {
    const loader = document.getElementById('loader');
    const initialLoader = document.getElementById('initialLoader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 300);
    }
    if (initialLoader) {
        initialLoader.classList.add('hidden');
    }
}

// ─── Exponer globalmente SOLO funciones necesarias (sin supabase) ─────────────
window.haySesionActiva      = haySesionActiva;
window.actualizarUIGlobal   = actualizarUIGlobal;
window.registrarUsuario     = registrarUsuario;
window.iniciarSesion        = iniciarSesion;
window.iniciarSesionConGoogle = iniciarSesionConGoogle;
window.recuperarPassword    = recuperarPassword;
// ⚠️ SEGURIDAD: NO exponer el cliente de Supabase (window.supabaseClient)

// ─── Inicializar con manejo de errores ────────────────────────────────────────
async function initApp() {
    console.log('🚀 AXON-LAB iniciando…');

    try {
        await initAuth();
    } catch (error) {
        // El error de lock ocurre cuando dos pestañas compiten por la sesión.
        // No es fatal — continuamos igual.
        console.warn('⚠️ initAuth warning (no fatal):', error.message);
    }

    // Siempre inicializar la UI y el router aunque initAuth falle
    try {
        actualizarUI();
        setupLogout();
        setupMobileMenu();
        setupAuthListener();
        setupDarkMode();
        initRouter();
    } catch (error) {
        console.error('❌ Error en setup:', error);
    }

    hideLoaders();
    console.log('✅ AXON-LAB listo');
}

// ─── Arrancar la app ──────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
