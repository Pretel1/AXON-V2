// js/auth.js — AXON-LAB v2.0  (Supabase Auth completo)
import { supabase } from './supabase-config.js';

let currentUser = null;
let _setCurrentUserExternal = null;

// ─── Referencia circular segura ──────────────────────────────────────────────
export function registerSetCurrentUser(fn) { 
    _setCurrentUserExternal = fn; 
}

function _propagateUser(user) {
    currentUser = user;
    if (_setCurrentUserExternal) {
        try {
            _setCurrentUserExternal(user);
        } catch (e) {
            console.warn('Error en callback setCurrentUser:', e);
        }
    }
    actualizarUIGlobal();
    document.dispatchEvent(new CustomEvent('authChanged', { detail: { user } }));
}

// ─── Escuchar cambios de sesión ───────────────────────────────────────────────
let authListener = null;
function setupAuthListener() {
    if (authListener) return; // Evitar duplicados
    
    authListener = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('🔄 Auth event:', event, session?.user?.email || 'sin user');

        if (event === 'PASSWORD_RECOVERY') {
            window.location.hash = 'restablecer';
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

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
            console.warn('Error perfil:', error);
        }

        _propagateUser({
            id: authUser.id,
            nombre: profile?.nombre || authUser.user_metadata?.name || 
                    authUser.email?.split('@')[0] || 'Usuario',
            email: authUser.email,
            rol: profile?.rol || 'estudiante',
            avatar_url: profile?.avatar_url || null,
            emailVerificado: !!authUser.email_confirmed_at,
            // Para OAuth
            full_name: authUser.user_metadata?.full_name || null,
            avatar: authUser.user_metadata?.avatar_url || null
        });
    } catch (error) {
        console.error('Error en _cargarPerfil:', error);
        throw error;
    }
}

// ─── Inicializar auth (llamar desde app.js) ───────────────────────────────────
export async function initAuth() {
    try {
        setupAuthListener();
        
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
            console.warn('Error getUser:', error);
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
        console.error('Error initAuth:', error);
        _propagateUser(null);
        return null;
    }
}

// ─── Registro ────────────────────────────────────────────────────────────────
export async function registrarUsuario(nombre, email, password) {
    // Validaciones
    if (!nombre?.trim()) return { success: false, message: 'Ingresa tu nombre.' };
    if (!email?.trim()) return { success: false, message: 'Ingresa tu email.' };
    if (!password || password.length < 8) {
        return { success: false, message: 'La contraseña debe tener mínimo 8 caracteres.' };
    }

    try {
        const { data, error } = await supabase.auth.signUp({ 
            email: email.trim().toLowerCase(), 
            password,
            options: {
                data: { nombre: nombre.trim() }
            }
        });
        
        if (error) throw error;

        if (data.user) {
            // Crear perfil en tabla "perfiles" (con retry)
            let perfilError = null;
            for (let i = 0; i < 3; i++) {
                const { error: err } = await supabase.from('perfiles').insert({
                    id: data.user.id,
                    nombre: nombre.trim(),
                    email: email.trim().toLowerCase(),
                    rol: 'estudiante'
                });
                
                if (!err) break;
                perfilError = err;
                await new Promise(r => setTimeout(r, 500)); // Esperar 500ms
            }
            
            if (perfilError) {
                console.warn('Perfil no creado:', perfilError.message);
            }
        }

        const needsVerification = !data.session;
        return {
            success: true,
            needsVerification,
            message: needsVerification 
                ? '✅ Registro exitoso. Revisa tu correo para confirmar tu cuenta.'
                : '✅ ¡Registro exitoso! Ya puedes iniciar sesión.'
        };
    } catch (err) {
        console.error('Error registro:', err);
        
        if (err.message?.includes('already registered') || 
            err.message?.includes('duplicate key')) {
            return { success: false, message: 'Este correo ya está registrado.' };
        }
        
        if (err.message?.includes('Invalid email')) {
            return { success: false, message: 'Email inválido.' };
        }
        
        return { 
            success: false, 
            message: err.message || 'Error en el registro. Intenta de nuevo.' 
        };
    }
}

// ─── Login ────────────────────────────────────────────────────────────────────
export async function iniciarSesion(email, password) {
    if (!email?.trim() || !password) {
        return { success: false, message: 'Completa todos los campos.' };
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ 
            email: email.trim().toLowerCase(), 
            password 
        });
        
        if (error) throw error;
        
        if (data.user) {
            await _cargarPerfil(data.user);
        }
        
        return { success: true, message: '¡Bienvenido!' };
    } catch (err) {
        console.error('Error login:', err);
        
        if (err.message?.includes('Invalid login') || 
            err.message?.includes('Credentials')) {
            return { success: false, message: 'Correo o contraseña incorrectos.' };
        }
        
        if (err.message?.includes('Email not confirmed')) {
            return { success: false, message: 'Confirma tu correo antes de iniciar sesión.' };
        }
        
        return { 
            success: false, 
            message: err.message || 'Error al iniciar sesión.' 
        };
    }
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────
export async function iniciarSesionConGoogle() {
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}${window.location.pathname}`
            }
        });
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error Google OAuth:', error);
        return { success: false, message: error.message || 'Error con Google.' };
    }
}

// ─── Logout ───────────────────────────────────────────────────────────────────
export async function cerrarSesion() {
    try {
        await supabase.auth.signOut();
        _propagateUser(null);
        return { success: true };
    } catch (error) {
        console.error('Error logout:', error);
        return { success: false, message: error.message };
    }
}

// ─── Solicitar email de recuperación ─────────────────────────────────────────
export async function recuperarPassword(email) {
    if (!email?.trim()) {
        return { success: false, message: 'Ingresa tu correo.' };
    }

    try {
        const redirectTo = `${window.location.origin}${window.location.pathname}#restablecer`;
        const { error } = await supabase.auth.resetPasswordForEmail(
            email.trim().toLowerCase(), 
            { redirectTo }
        );
        
        if (error) throw error;
        
        return { 
            success: true, 
            message: '📧 Revisa tu correo. El link caduca en 1 hora.' 
        };
    } catch (error) {
        console.error('Error recuperar password:', error);
        return { 
            success: false, 
            message: error.message || 'Error enviando email de recuperación.' 
        };
    }
}

// ─── Establecer nueva contraseña (desde el link del email) ───────────────────
export async function restablecerPassword(nuevaPassword) {
    if (!nuevaPassword || nuevaPassword.length < 8) {
        return { success: false, message: 'Mínimo 8 caracteres.' };
    }

    try {
        const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
        if (error) throw error;
        return { success: true, message: '✅ Contraseña actualizada correctamente.' };
    } catch (error) {
        console.error('Error restablecer password:', error);
        return { 
            success: false, 
            message: error.message || 'Error actualizando contraseña.' 
        };
    }
}

// ─── Helpers públicos ─────────────────────────────────────────────────────────
export function obtenerUsuarioActual() { return currentUser; }
export function haySesionActiva()       { return !!currentUser; }
export function esAdmin()               { return currentUser?.rol === 'admin'; }
export function esEstudiante()          { return currentUser?.rol === 'estudiante'; }

// ─── UI Global ────────────────────────────────────────────────────────────────
export function actualizarUIGlobal() {
    try {
        const isAuth = haySesionActiva();
        const user = currentUser;

        const el = (id) => document.getElementById(id);

        // Actualizar nombre de usuario
        const userName = el('userName');
        if (userName) {
            userName.textContent = user?.nombre || 'Invitado';
        }

        // Actualizar avatar
        const avatar = el('userAvatar');
        if (avatar) {
            avatar.textContent = isAuth ? '👤' : '👤';
            avatar.title = user?.nombre || 'Iniciar sesión';
        }

        // Mostrar/ocultar links de navegación
        const show = (id, cond) => {
            const e = el(id);
            if (e) e.style.display = cond ? '' : 'none';
        };
        
        show('registroNavLink', !isAuth);
        show('loginNavLink', !isAuth);
        show('logoutNavLink', isAuth);
        show('subirNavLink', isAuth);
        show('perfilNavLink', isAuth);

        // Navbar auth state
        const authNav = el('authNav');
        if (authNav) {
            authNav.style.display = isAuth ? 'flex' : 'none';
        }

        const guestNav = el('guestNav');
        if (guestNav) {
            guestNav.style.display = isAuth ? 'none' : 'flex';
        }

    } catch (error) {
        console.warn('Error actualizarUIGlobal:', error);
    }
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────
export function cleanupAuth() {
    if (authListener) {
        supabase.auth.removeAuthListener(authListener.data);
        authListener = null;
    }
}

// No arrancar automáticamente - dejar que app.js lo controle
console.log('✅ auth.js v2.1 listo');
