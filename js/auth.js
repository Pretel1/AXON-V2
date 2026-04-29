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
let authSubscription = null;
function setupAuthListener() {
    if (authSubscription) return; // Prevenir duplicados
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('🔄 Auth event:', event);
        authSubscription = subscription;

        if (event === 'PASSWORD_RECOVERY') {
            // ✅ NO reload() - solo hash change
            if (window.location.hash !== '#restablecer') {
                window.location.hash = 'restablecer';
            }
            return;
        }

        if (event === 'SIGNED_OUT') {
            _propagateUser(null);
            return;
        }

        if (session?.user) {
            try {
                await _cargarPerfil(session.user);
            } catch (error) {
                console.error('Error cargando perfil:', error);
                _propagateUser(null);
            }
        } else {
            _propagateUser(null);
        }
    });
}

// ─── Cargar perfil desde tabla "perfiles" ────────────────────────────────────
async function _cargarPerfil(authUser) {
    try {
        const { data: profile, error } = await supabase
            .from('perfiles')
            .select('nombre, rol, avatar_url')
            .eq('id', authUser.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.warn('Perfil no encontrado:', error);
        }

        _propagateUser({
            id: authUser.id,
            nombre: profile?.nombre || authUser.email?.split('@')[0] || 'Usuario',
            email: authUser.email,
            rol: profile?.rol || 'estudiante',
            avatar_url: profile?.avatar_url || null,
            emailVerificado: !!authUser.email_confirmed_at
        });
    } catch (error) {
        console.error('_cargarPerfil error:', error);
        throw error;
    }
}

// ─── Inicializar auth (llamar desde app.js) ───────────────────────────────────
export async function initAuth() {
    try {
        setupAuthListener();
        
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
            console.warn('getUser error:', error);
            _propagateUser(null);
            return null;
        }
        
        if (user) {
            await _cargarPerfil(user);
        } else {
            _propagateUser(null);
        }
        return currentUser;
    } catch (error) {
        console.error('initAuth error:', error);
        _propagateUser(null);
        return null;
    }
}

// ─── Registro ────────────────────────────────────────────────────────────────
export async function registrarUsuario(nombre, email, password) {
    if (!password || password.length < 8)
        return { success: false, message: 'La contraseña debe tener mínimo 8 caracteres.' };

    try {
        const { data, error } = await supabase.auth.signUp({ 
            email: email.trim().toLowerCase(), 
            password 
        });
        if (error) throw error;

        // Crear perfil en tabla "perfiles"
        if (data.user) {
            const { error: perfilError } = await supabase.from('perfiles').insert({
                id: data.user.id,
                nombre: nombre?.trim() || 'Usuario',
                email: email.toLowerCase().trim(),
                rol: 'estudiante'
            });
            if (perfilError) console.warn('Perfil no creado:', perfilError.message);
        }

        return {
            success: true,
            needsVerification: !data.session,
            message: '✅ Registro exitoso. Revisa tu correo para confirmar tu cuenta.'
        };
    } catch (err) {
        if (err.message?.includes('already registered'))
            return { success: false, message: 'Este correo ya está registrado.' };
        return { success: false, message: err.message || 'Error en registro' };
    }
}

// ─── Login ────────────────────────────────────────────────────────────────────
export async function iniciarSesion(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ 
            email: email.trim().toLowerCase(), 
            password 
        });
        if (error) throw error;
        if (data.user) await _cargarPerfil(data.user);
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
    return { success: true };
}

// ─── Logout ───────────────────────────────────────────────────────────────────
export async function cerrarSesion() {
    try {
        await supabase.auth.signOut();
        // ✅ NO reload() - solo propagate
        _propagateUser(null);
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, message: error.message };
    }
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

    const show = (id, cond) => { 
        const e = el(id); 
        if (e) e.style.display = cond ? '' : 'none'; 
    };
    show('registroNavLink', !isAuth);
    show('loginNavLink', !isAuth);
    show('logoutNavLink', isAuth);
    show('subirNavLink', isAuth);
}

// ✅ NO auto-init - app.js lo controla
console.log('✅ auth.js v2 listo');
