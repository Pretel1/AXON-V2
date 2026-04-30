// js/supabase-config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://librysniqcicbdcobmzu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_OMlvkBnkhJOY1sZVIhS54Q_DENu2TpF';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

export const LABS_BUCKET = 'laboratorios';
export const MEDIA_BUCKET = 'media';

// ⚠️ ESTA LÍNEA ES CLAVE
export const EMAIL_FUNCTION_URL = 'https://librysniqcicbdcobmzu.supabase.co/functions/v1/send-email';

console.log('✅ Supabase listo');
