// js/supabase-config.js — AXON-LAB v2.0
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

console.log('✅ Supabase listo');
