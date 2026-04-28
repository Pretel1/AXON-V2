// js/supabase-config.js — AXON-LAB v2.0
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ⚠️  REEMPLAZA con tus valores reales de:
//     Supabase Dashboard → Project Settings → API
const SUPABASE_URL     = 'https://xxrxoyotgragaunygsne.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dmHdG4_xal2iWHFagZjo2Q_PFtxHfPJ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true   // Obligatorio para reset-password por email
    }
});

// ─── Buckets de Storage ──────────────────────────────────────────────────────
export const LABS_BUCKET  = 'laboratorios';  // PDFs, DOCX, ZIP, etc.
export const MEDIA_BUCKET = 'media';          // Imágenes y vídeos

console.log('✅ Supabase listo');
