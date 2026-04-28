-- ============================================================
--  AXON-LAB — Script SQL completo para Supabase
--  Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TABLA: perfiles
--    Extiende auth.users con datos de perfil adicionales
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.perfiles (
    id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre      TEXT        NOT NULL,
    email       TEXT        NOT NULL,
    rol         TEXT        NOT NULL DEFAULT 'estudiante'
                            CHECK (rol IN ('estudiante', 'docente', 'admin')),
    avatar_url  TEXT,
    bio         TEXT,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 2. TABLA: laboratorios
--    Admite tanto archivos subidos como enlaces externos
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.laboratorios (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo          TEXT        NOT NULL,
    descripcion     TEXT,
    categoria       TEXT        NOT NULL,
    tipo_recurso    TEXT        NOT NULL DEFAULT 'archivo'
                                CHECK (tipo_recurso IN ('archivo','enlace','video','imagen')),

    -- Campos de archivo (solo cuando tipo_recurso = 'archivo' | 'imagen')
    archivo_url     TEXT        NOT NULL,       -- URL pública o enlace externo
    nombre_archivo  TEXT,
    tamano_archivo  BIGINT,
    extension       TEXT,
    bucket_name     TEXT,
    storage_path    TEXT,

    -- Campos de enlace externo
    tipo_enlace     TEXT,                       -- 'onedrive','google-drive','dropbox','video','enlace'

    -- Metadatos
    tags            TEXT[]      DEFAULT '{}',
    downloads       INTEGER     NOT NULL DEFAULT 0,
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 3. TABLA: favoritos  (usuario marca labs favoritos)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.favoritos (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
    lab_id     UUID NOT NULL REFERENCES public.laboratorios(id) ON DELETE CASCADE,
    creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, lab_id)
);

-- ────────────────────────────────────────────────────────────
-- 4. ÍNDICES para búsquedas rápidas
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_labs_categoria   ON public.laboratorios(categoria);
CREATE INDEX IF NOT EXISTS idx_labs_user        ON public.laboratorios(user_id);
CREATE INDEX IF NOT EXISTS idx_labs_tipo        ON public.laboratorios(tipo_recurso);
CREATE INDEX IF NOT EXISTS idx_labs_creado      ON public.laboratorios(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_labs_titulo_gin  ON public.laboratorios USING GIN (to_tsvector('spanish', titulo));

-- ────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────

-- perfiles
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de perfiles"
    ON public.perfiles FOR SELECT USING (true);

CREATE POLICY "Usuario actualiza su perfil"
    ON public.perfiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Usuario inserta su perfil"
    ON public.perfiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- laboratorios
ALTER TABLE public.laboratorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de laboratorios"
    ON public.laboratorios FOR SELECT USING (true);

CREATE POLICY "Usuario autenticado inserta laboratorio"
    ON public.laboratorios FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Dueño o admin puede actualizar laboratorio"
    ON public.laboratorios FOR UPDATE
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

CREATE POLICY "Dueño o admin puede eliminar laboratorio"
    ON public.laboratorios FOR DELETE
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.perfiles
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- favoritos
ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario gestiona sus favoritos"
    ON public.favoritos FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 6. FUNCIÓN + TRIGGER: crear perfil automáticamente
--    al registrar un usuario nuevo
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.perfiles (id, nombre, email, rol)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
        NEW.email,
        'estudiante'
    )
    ON CONFLICT (id) DO NOTHING;   -- Evitar duplicados si JS ya lo insertó
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- 7. FUNCIÓN RPC: incrementar descargas (thread-safe)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_downloads(lab_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.laboratorios
    SET downloads = downloads + 1
    WHERE id = lab_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 8. TRIGGER: actualizar campo "actualizado_en" automáticamente
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.actualizado_en = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER labs_updated_at
    BEFORE UPDATE ON public.laboratorios
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER perfiles_updated_at
    BEFORE UPDATE ON public.perfiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- 9. STORAGE BUCKETS  (ejecutar también en SQL Editor)
-- ────────────────────────────────────────────────────────────

-- Bucket: laboratorios (PDFs, docs, ZIP, Python, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'laboratorios',
    'laboratorios',
    true,
    52428800,   -- 50 MB
    ARRAY[
        'application/pdf',
        'application/zip',
        'application/x-zip-compressed',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
        'application/json',
        'application/octet-stream'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- Bucket: media (imágenes y vídeos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'media',
    'media',
    true,
    52428800,
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage: laboratorios
CREATE POLICY "Lectura pública laboratorios storage"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'laboratorios');

CREATE POLICY "Usuario autenticado sube a laboratorios"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'laboratorios' AND auth.role() = 'authenticated');

CREATE POLICY "Dueño elimina de laboratorios"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'laboratorios' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Políticas de Storage: media
CREATE POLICY "Lectura pública media storage"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'media');

CREATE POLICY "Usuario autenticado sube a media"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

CREATE POLICY "Dueño elimina de media"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ── FIN DEL SCRIPT ────────────────────────────────────────────────────────────
-- Verifica las tablas con:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
