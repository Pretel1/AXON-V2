// js/app.js — AXON-LAB v2.0
import { supabase } from './supabase-config.js';
import { initAuth, cerrarSesion, actualizarUIGlobal, haySesionActiva,
         registrarUsuario, iniciarSesion, iniciarSesionConGoogle, recuperarPassword } from './auth.js';
import { initRouter } from './router.js';

function actualizarUI() { actualizarUIGlobal(); }

function setupLogout() {
    document.getElementById('logoutNavLink')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await cerrarSesion();
        actualizarUI();
        window.location.hash = 'inicio';
    });
}

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
    window.addEventListener('hashchange', closeMenu);
    window.addEventListener('popstate', closeMenu);
}

function setupAuthListener() {
    document.addEventListener('authChanged', () => actualizarUI());
}

function setupDarkMode() {
    const btn = document.getElementById('darkModeToggle');
    if (!btn) return;
    const saved       = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark      = saved !== null ? saved === 'true' : prefersDark;
    if (isDark) document.body.classList.add('dark-mode');
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const now = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', now);
        btn.textContent = now ? '☀️' : '🌙';
    });
}

function hideLoaders() {
    const loader = document.getElementById('loader');
    const initialLoader = document.getElementById('initialLoader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; }, 300);
    }
    if (initialLoader) initialLoader.classList.add('hidden');
}

// FIX: exponer _supabase para que restablecer.html (fragmento no-module) lo use
window._supabase              = supabase;
window.haySesionActiva        = haySesionActiva;
window.actualizarUIGlobal     = actualizarUIGlobal;
window.registrarUsuario       = registrarUsuario;
window.iniciarSesion          = iniciarSesion;
window.iniciarSesionConGoogle = iniciarSesionConGoogle;
window.recuperarPassword      = recuperarPassword;

async function initApp() {
    console.log('🚀 AXON-LAB iniciando…');

    try {
        await initAuth();
    } catch (error) {
        console.warn('⚠️ initAuth warning (no fatal):', error.message);
    }

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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
