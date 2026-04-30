// js/auth.js — AXON-LAB v2.0  (Supabase Auth + Resend via Edge Function)
import { supabase, EMAIL_FUNCTION_URL } from './supabase-config.js';

let currentUser = null;

let _setCurrentUserExternal = null;
export function registerSetCurrentUser(fn) { _setCurrentUserExternal = fn; }

function _propagateUser(user) {
    currentUser = user;
    if (_setCurrentUserExternal) _setCurrentUserExternal(user);
    actualizarUIGlobal();
    document.dispatchEvent(new CustomEvent('authChanged', { detail: { user } }));
}

let authSubscription = null;
function setupAuthListener() {
    if (authSubscription) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('🔄 Auth event:', event);
        authSubscription = subscription;

        if (event === 'PASSWORD_RECOVERY') {
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
            id:              authUser.id,
            nombre:          profile?.nombre || authUser.email?.split('@')[0] || 'Usuario',
            email:           authUser.email,
            rol:             profile?.rol || 'estudiante',
            avatar_url:      profile?.avatar_url || null,
            emailVerificado: !!authUser.email_confirmed_at
        });
    } catch (error) {
        console.error('_cargarPerfil error:', error);
        throw error;
    }
}

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

// ─── Enviar email custom vía Resend (Edge Function) ───────────────────────────
async function _enviarEmailResend({ to, subject, html }) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';

        const res = await fetch(EMAIL_FUNCTION_URL, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ to, subject, html })
        });

        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `HTTP ${res.status}`);
        }
        return { success: true };
    } catch (err) {
        console.error('_enviarEmailResend error:', err);
        return { success: false, error: err.message };
    }
}

export async function registrarUsuario(nombre, email, password) {
    if (!password || password.length < 8)
        return { success: false, message: 'La contraseña debe tener mínimo 8 caracteres.' };

    try {
        const redirectTo = window.location.origin + window.location.pathname + '#inicio';

        const { data, error } = await supabase.auth.signUp({
            email:    email.trim().toLowerCase(),
            password,
            options: {
                data:            { nombre: nombre?.trim() || 'Usuario' },
                emailRedirectTo: redirectTo
            }
        });
        if (error) throw error;

        // Fallback por si el trigger SQL no crea el perfil
        if (data.user && !data.user.email_confirmed_at) {
            const { error: perfilError } = await supabase.from('perfiles').insert({
                id:     data.user.id,
                nombre: nombre?.trim() || 'Usuario',
                email:  email.toLowerCase().trim(),
                rol:    'estudiante'
            }).select().single();

            if (perfilError && perfilError.code !== '23505' && perfilError.code !== 'PGRST116') {
                console.warn('Perfil fallback no creado:', perfilError.message);
            }
        }

        // Email de bienvenida con Resend
        _enviarEmailResend({
            to:      email.trim().toLowerCase(),
            subject: '¡Bienvenido a AXON-LAB! Confirma tu cuenta',
            html:    _htmlBienvenida(nombre?.trim() || 'Usuario')
        });

        return {
            success:           true,
            needsVerification: !data.session,
            message:           '✅ Registro exitoso. Revisa tu correo para confirmar tu cuenta.'
        };
    } catch (err) {
        if (err.message?.includes('already registered') || err.message?.includes('User already registered'))
            return { success: false, message: 'Este correo ya está registrado.' };
        return { success: false, message: err.message || 'Error en registro' };
    }
}

export async function iniciarSesion(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email:    email.trim().toLowerCase(),
            password
        });
        if (error) throw error;
        if (data.user) await _cargarPerfil(data.user);
        return { success: true, message: '¡Bienvenido!' };
    } catch (err) {
        const msg = err.message?.includes('Invalid login')
            ? 'Credenciales incorrectas.'
            : err.message?.includes('Email not confirmed')
            ? 'Debes confirmar tu correo antes de iniciar sesión.'
            : err.message;
        return { success: false, message: msg };
    }
}

export async function iniciarSesionConGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) return { success: false, message: error.message };
    return { success: true };
}

export async function cerrarSesion() {
    try {
        await supabase.auth.signOut();
        _propagateUser(null);
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, message: error.message };
    }
}

export async function recuperarPassword(email) {
    const redirectTo = window.location.origin + '/pages/restablecer.html';

    const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo }
    );
    if (error) return { success: false, message: error.message };

    _enviarEmailResend({
        to:      email.trim().toLowerCase(),
        subject: 'AXON-LAB — Restablece tu contraseña',
        html:    _htmlRecuperacion(email.trim().toLowerCase())
    });

    return { success: true, message: '📧 Revisa tu correo. El link caduca en 1 hora.' };
}

export async function restablecerPassword(nuevaPassword) {
    if (!nuevaPassword || nuevaPassword.length < 8)
        return { success: false, message: 'Mínimo 8 caracteres.' };

    const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
    if (error) return { success: false, message: error.message };
    return { success: true, message: '✅ Contraseña actualizada correctamente.' };
}

export function obtenerUsuarioActual() { return currentUser; }
export function haySesionActiva()       { return !!currentUser; }
export function esAdmin()               { return currentUser?.rol === 'admin'; }

export function actualizarUIGlobal() {
    const isAuth = haySesionActiva();
    const user   = currentUser;
    const el     = (id) => document.getElementById(id);

    const userName = el('userName');
    if (userName) userName.textContent = user?.nombre || 'Invitado';

    const show = (id, cond) => { const e = el(id); if (e) e.style.display = cond ? '' : 'none'; };
    show('registroNavLink', !isAuth);
    show('loginNavLink',    !isAuth);
    show('logoutNavLink',   isAuth);
    show('subirNavLink',    isAuth);
}

function _htmlBienvenida(nombre) {
    return `<!DOCTYPE html><html lang="es"><body style="font-family:sans-serif;background:#f3f4f6;padding:2rem;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:2rem;box-shadow:0 4px 12px rgba(0,0,0,.08);">
        <h1 style="color:#1565c0;margin-top:0;">🧪 ¡Bienvenido a AXON-LAB, ${nombre}!</h1>
        <p>Tu cuenta ha sido creada. Haz clic en el enlace que Supabase te envió para confirmarla.</p>
        <p style="color:#6b7280;font-size:.85rem;">Si no creaste esta cuenta, ignora este mensaje.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;">
        <p style="font-size:.8rem;color:#9ca3af;">AXON-LAB · Plataforma de recursos educativos</p>
    </div></body></html>`;
}

function _htmlRecuperacion(email) {
    return `<!DOCTYPE html><html lang="es"><body style="font-family:sans-serif;background:#f3f4f6;padding:2rem;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:2rem;box-shadow:0 4px 12px rgba(0,0,0,.08);">
        <h1 style="color:#1565c0;margin-top:0;">🔐 Restablecer contraseña</h1>
        <p>Recibimos una solicitud para restablecer la contraseña de <strong>${email}</strong>.</p>
        <p>Supabase te enviará un enlace seguro. Este correo es solo una notificación adicional.</p>
        <p style="color:#6b7280;font-size:.85rem;">El enlace caduca en <strong>1 hora</strong>.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;">
        <p style="font-size:.8rem;color:#9ca3af;">AXON-LAB · Plataforma de recursos educativos</p>
    </div></body></html>`;
}

console.log('✅ auth.js v2 listo');
