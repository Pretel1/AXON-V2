// js/supabase-config.js — AXON-LAB v2.0
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// 🔗 URL de tu proyecto
const SUPABASE_URL = 'https://librysniqcicbdcobmzu.supabase.co';

// 🔑 USA TU NUEVA PUBLISHABLE KEY (NO anon, NO secret)
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_AQUI_TU_CLAVE';

// 🚀 Cliente Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    },
    global: {
        headers: {
            'x-app-name': 'axon-lab'
        }
    }
});

// 📦 Buckets
export const LABS_BUCKET  = 'laboratorios';
export const MEDIA_BUCKET = 'media';

// 📧 Edge Function (correo)
export const EMAIL_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-email`;

console.log('✅ Supabase listo');
