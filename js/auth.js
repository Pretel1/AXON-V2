// js/auth.js — AXON-LAB v2.0  (Supabase Auth completo)
import { supabase } from './supabase-config.js';

let currentUser = null;

// ─── Referencia circular segura ──────────────────────────────────────────────
let _setCurrentUserExternal = null;
export function registerSetCurrentUser(fn) { _setCurrentUserExternal = fn; }

function _propagateUser(user) {
    currentUser = user;
    if (_setCurrentUserExternal) _setCurrentUserExternal(user);
    actualizarUIGlobal();
    document.dispatchEvent(new CustomEvent('authChanged', { detail: { user } }));
}

// ─── Escuchar cambios de sesión ───────────────────────────────────────────────
supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('🔄 Auth event:', event);

    if (event === 'PASSWORD_RECOVERY') {
        // El link de reset llegó: redirigir a página de restablecimiento
        window.location.hash = 'restablecer';
        return;
    }

    if (session?.user) {
        await _cargarPerfil(session.user);
    } else {
        _propagateUser(null);
    }
});

// ─── Cargar perfil desde tabla "perfiles" ────────────────────────────────────
async function _cargarPerfil(authUser) {
    const { data: profile } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

    _propagateUser({
        id:             authUser.id,
        nombre:         profile?.nombre  || authUser.email.split('@')[0],
        email:          authUser.email,
        rol:            profile?.rol     || 'estudiante',
        avatar_url:     profile?.avatar_url || null,
        emailVerificado: !!authUser.email_confirmed_at
    });
}

// ─── Inicializar auth (llamar desde app.js) ───────────────────────────────────
export async function initAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await _cargarPerfil(user);
    else _propagateUser(null);
    return currentUser;
}

// ─── Registro ────────────────────────────────────────────────────────────────
export async function registrarUsuario(nombre, email, password) {
    if (!password || password.length < 8)
        return { success: false, message: 'La contraseña debe tener mínimo 8 caracteres.' };

    try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // Crear perfil en tabla "perfiles"
        if (data.user) {
            const { error: perfilError } = await supabase.from('perfiles').insert({
                id:     data.user.id,
                nombre: nombre.trim(),
                email:  email.toLowerCase().trim(),
                rol:    'estudiante'
            });
            if (perfilError) console.warn('Perfil no creado:', perfilError.message);
        }

        return {
            success: true,
            needsVerification: !data.session,   // true si Supabase requiere email-confirm
            message: '✅ Registro exitoso. Revisa tu correo para confirmar tu cuenta.'
        };
    } catch (err) {
        if (err.message?.includes('already registered'))
            return { success: false, message: 'Este correo ya está registrado.' };
        return { success: false, message: err.message };
    }
}

// ─── Login ────────────────────────────────────────────────────────────────────
export async function iniciarSesion(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await _cargarPerfil(data.user);
        return { success: true, message: '¡Bienvenido!' };
    } catch (err) {
        const msg = err.message?.includes('Invalid login')
            ? 'Credenciales incorrectas.'
            : err.message;
        return { success: false, message: msg };
    }
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────
export async function iniciarSesionConGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + window.location.pathname
        }
    });
    if (error) return { success: false, message: error.message };
}

// ─── Logout ───────────────────────────────────────────────────────────────────
export async function cerrarSesion() {
    await supabase.auth.signOut();
    _propagateUser(null);
}

// ─── Solicitar email de recuperación ─────────────────────────────────────────
export async function recuperarPassword(email) {
    const redirectTo = window.location.origin + window.location.pathname + '#restablecer';
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) return { success: false, message: error.message };
    return { success: true, message: '📧 Revisa tu correo. El link caduca en 1 hora.' };
}

// ─── Establecer nueva contraseña (desde el link del email) ───────────────────
export async function restablecerPassword(nuevaPassword) {
    if (!nuevaPassword || nuevaPassword.length < 8)
        return { success: false, message: 'Mínimo 8 caracteres.' };

    const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
    if (error) return { success: false, message: error.message };
    return { success: true, message: '✅ Contraseña actualizada correctamente.' };
}

// ─── Helpers públicos ─────────────────────────────────────────────────────────
export function obtenerUsuarioActual() { return currentUser; }
export function haySesionActiva()       { return !!currentUser; }
export function esAdmin()               { return currentUser?.rol === 'admin'; }

// ─── UI Global ────────────────────────────────────────────────────────────────
export function actualizarUIGlobal() {
    const isAuth = haySesionActiva();
    const user   = currentUser;

    const el = (id) => document.getElementById(id);

    const userName = el('userName');
    if (userName) userName.textContent = user?.nombre || 'Invitado';

    const avatar = el('userAvatar');
    if (avatar) avatar.textContent = isAuth ? '👤' : '👤';

    const show = (id, cond) => { const e = el(id); if (e) e.style.display = cond ? 'flex' : 'none'; };
    show('registroNavLink', !isAuth);
    show('loginNavLink',    !isAuth);
    show('logoutNavLink',   isAuth);
    show('subirNavLink',    isAuth);
}

// Arrancar
initAuth();
console.log('✅ auth.js v2 listo');
