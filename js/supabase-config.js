// js/supabase-config.js — AXON-LAB v2.0
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL      = 'https://librysniqcicbdcobmzu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // ← pega aquí tu clave anon legacy

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken:   true,
        persistSession:     true,
        detectSessionInUrl: true
    }
});

export const LABS_BUCKET  = 'laboratorios';
export const MEDIA_BUCKET = 'media';

export const EMAIL_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-email`;

console.log('✅ Supabase listo');
