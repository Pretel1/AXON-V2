// js/router.js — AXON-LAB v2.0
import { haySesionActiva } from './auth.js';

const routes = {
    inicio:       'pages/inicio.html',
    laboratorios: 'pages/laboratorios.html',
    categorias:   'pages/categorias.html',
    subir:        'pages/subir.html',
    registro:     'pages/registro.html',
    login:        'pages/login.html',
    verificacion: 'pages/verificacion.html',
    detalle:      'pages/detalle.html',
    restablecer:  'pages/restablecer.html'
};

const protectedPages   = ['subir'];
const publicOnlyPages  = ['login', 'registro'];

// ── Inicializar ───────────────────────────────────────────────────────────────
export function initRouter() {
    window.addEventListener('hashchange', handleRoute);

    // Delegación de clics en nav-links
    document.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-link[data-page]');
        if (!link) return;
        e.preventDefault();
        navigateTo(link.dataset.page);
    });

    handleRoute();
}

// ── Navegar ───────────────────────────────────────────────────────────────────
export function navigateTo(page, params = {}) {
    const qs = Object.keys(params).length
        ? '?' + new URLSearchParams(params).toString()
        : '';
    window.location.hash = page + qs;
}

export function getParams() {
    const qs = window.location.hash.split('?')[1] || '';
    return new URLSearchParams(qs);
}

// ── Manejar ruta ──────────────────────────────────────────────────────────────
async function handleRoute() {
    const full  = window.location.hash.slice(1) || 'inicio';
    const page  = full.split('?')[0];
    const isAuth = haySesionActiva();

    // Guardar parámetros en la query si existen
    const params = getParams();

    // Redirigir si página protegida y sin sesión
    if (protectedPages.includes(page) && !isAuth) {
        window.location.hash = 'login';
        return;
    }
    // Redirigir si ya autenticado intenta ir a login/registro
    if (publicOnlyPages.includes(page) && isAuth) {
        window.location.hash = 'inicio';
        return;
    }

    updateActiveNav(page);

    // Actualizar UI global desde auth.js si está disponible
    if (typeof window.actualizarUIGlobal === 'function') window.actualizarUIGlobal();

    await loadPage(page);
}

// ── Cargar HTML de página ─────────────────────────────────────────────────────
export async function loadPage(page) {
    const content = document.getElementById('page-content');
    if (!content) return;

    const route = routes[page];
    if (!route) {
        content.innerHTML = `
            <div style="text-align:center;padding:4rem;">
                <div style="font-size:3rem;">😕</div>
                <h2>Página no encontrada</h2>
                <button class="btn btn-primary" onclick="location.hash='inicio'">Volver al inicio</button>
            </div>`;
        return;
    }

    content.innerHTML = '<div style="text-align:center;padding:4rem;"><div class="loader-spinner" style="margin:0 auto;"></div></div>';

    try {
        const res  = await fetch(route + '?v=' + Date.now());   // Evitar caché
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        content.innerHTML = html;
        // Re-ejecutar scripts insertados via innerHTML (el navegador no los ejecuta solo)
        for (const oldScript of content.querySelectorAll('script')) {
            const newScript = document.createElement('script');
            if (oldScript.src) {
                newScript.src = oldScript.src;
            } else {
                newScript.textContent = oldScript.textContent;
            }
            oldScript.replaceWith(newScript);
        }
        await runPageScript(page);
    } catch (err) {
        console.error('Router loadPage error:', err);
        content.innerHTML = `
            <div style="text-align:center;padding:4rem;">
                <div style="font-size:3rem;">⚠️</div>
                <h2>Error al cargar</h2>
                <p style="color:#6b7280;">${err.message}</p>
                <button class="btn btn-outline" onclick="location.reload()">Reintentar</button>
            </div>`;
    }
}

// ── Ejecutar lógica JS de cada página ────────────────────────────────────────
async function runPageScript(page) {
    try {
        const labs = await import('./labs.js');
        switch (page) {
            case 'inicio':        return labs.initHomePage?.();
            case 'laboratorios':  return labs.initLabsPage?.();
            case 'categorias':    return labs.initCategoriesPage?.();
            case 'subir':         return labs.initUploadPage?.();
            case 'detalle':       return labs.initDetailPage?.();
        }
    } catch (err) {
        console.error('runPageScript error:', err);
    }
}

// ── Nav activo ────────────────────────────────────────────────────────────────
function updateActiveNav(page) {
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.dataset.page === page);
    });
}

// ── Recargar página actual ────────────────────────────────────────────────────
export function reloadCurrentPage() { handleRoute(); }

// ── Globales ──────────────────────────────────────────────────────────────────
window.navigateTo        = navigateTo;
window.reloadCurrentPage = reloadCurrentPage;

console.log('✅ router.js v2 listo');
