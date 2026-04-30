// js/supabase-config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';

const SUPABASE_URL = 'https://librysniqcicbdcobmzu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpYnJ5c25pcWNpY2JkY29ibXp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTc1NDEsImV4cCI6MjA5Mjk5MzU0MX0.1lJqz72D5p0W0xI79MBXh5tN_evrYske7RlE9tlZqj8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

export const LABS_BUCKET = 'laboratorios';
export const MEDIA_BUCKET = 'media';

export const EMAIL_FUNCTION_URL = 'https://librysniqcicbdcobmzu.supabase.co/functions/v1/send-email';

console.log('✅ Supabase listo');
