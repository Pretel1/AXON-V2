// js/labs.js — AXON-LAB v2.0
import { supabase, LABS_BUCKET, MEDIA_BUCKET } from './supabase-config.js';
import { obtenerUsuarioActual, registerSetCurrentUser } from './auth.js';

let currentUser = null;
export function setCurrentUser(user) { currentUser = user; }
registerSetCurrentUser(setCurrentUser);   // Resolver circular import

// ─── Tipos de recursos ────────────────────────────────────────────────────────
export const TIPOS_RECURSO = {
    ARCHIVO: 'archivo',    // Upload a Supabase Storage
    ENLACE:  'enlace',     // URL externa (OneDrive, Drive, etc.)
    VIDEO:   'video',      // URL de vídeo externo (YouTube, Vimeo)
    IMAGEN:  'imagen'      // Imagen subida a bucket media
};

// ─── Validar URL ──────────────────────────────────────────────────────────────
export function validarURL(url) {
    try { new URL(url); return true; } catch { return false; }
}

// ─── Detectar tipo de URL ─────────────────────────────────────────────────────
export function detectarTipoEnlace(url) {
    if (!url) return 'desconocido';
    const u = url.toLowerCase();
    if (u.includes('youtube.com') || u.includes('youtu.be') || u.includes('vimeo.com'))
        return 'video';
    if (u.includes('onedrive') || u.includes('sharepoint') || u.includes('1drv.ms'))
        return 'onedrive';
    if (u.includes('drive.google.com'))
        return 'google-drive';
    if (u.includes('dropbox.com'))
        return 'dropbox';
    return 'enlace';
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUBIR LABORATORIO (archivo físico)
// ─────────────────────────────────────────────────────────────────────────────
export async function uploadLab(file, title, description, category, tags = []) {
    const user = currentUser || obtenerUsuarioActual();
    if (!user) return { success: false, error: 'Debes iniciar sesión.' };

    if (!file)               return { success: false, error: 'Selecciona un archivo.' };
    if (file.size > 50 * 1024 * 1024) return { success: false, error: 'El archivo supera los 50 MB.' };

    const ext      = file.name.split('.').pop().toLowerCase();
    const safeName = `${user.id}_${Date.now()}.${ext}`;

    // Determinar bucket según tipo
    const isMedia = ['jpg','jpeg','png','gif','webp','mp4','mov','avi','mkv'].includes(ext);
    const bucket  = isMedia ? MEDIA_BUCKET : LABS_BUCKET;

    try {
        // 1. Subir archivo al bucket
        const { error: upErr } = await supabase.storage
            .from(bucket)
            .upload(safeName, file, { cacheControl: '3600', upsert: false });
        if (upErr) throw upErr;

        // 2. Obtener URL pública
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(safeName);

        // 3. Insertar registro en BD
        const { data, error: dbErr } = await supabase
            .from('laboratorios')
            .insert({
                titulo:      title.trim(),
                descripcion: description.trim(),
                categoria:   category,
                tipo_recurso: TIPOS_RECURSO.ARCHIVO,
                archivo_url:  urlData.publicUrl,
                nombre_archivo: file.name,
                tamano_archivo: file.size,
                extension:    ext,
                bucket_name:  bucket,
                storage_path: safeName,
                user_id:      user.id,
                tags:         tags,
                downloads:    0
            })
            .select()
            .single();

        if (dbErr) throw dbErr;
        return { success: true, lab: _mapLab(data) };
    } catch (err) {
        console.error('uploadLab error:', err);
        return { success: false, error: err.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  GUARDAR ENLACE EXTERNO (OneDrive, Drive, YouTube, etc.)
// ─────────────────────────────────────────────────────────────────────────────
export async function saveLinkLab(url, title, description, category, tags = []) {
    const user = currentUser || obtenerUsuarioActual();
    if (!user) return { success: false, error: 'Debes iniciar sesión.' };

    if (!url || !validarURL(url))
        return { success: false, error: 'La URL no es válida.' };

    const tipoEnlace = detectarTipoEnlace(url);
    const tipoRecurso = tipoEnlace === 'video' ? TIPOS_RECURSO.VIDEO : TIPOS_RECURSO.ENLACE;

    try {
        const { data, error } = await supabase
            .from('laboratorios')
            .insert({
                titulo:       title.trim(),
                descripcion:  description.trim(),
                categoria:    category,
                tipo_recurso: tipoRecurso,
                archivo_url:  url.trim(),
                tipo_enlace:  tipoEnlace,
                user_id:      user.id,
                tags:         tags,
                downloads:    0
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, lab: _mapLab(data) };
    } catch (err) {
        console.error('saveLinkLab error:', err);
        return { success: false, error: err.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  LISTAR LABORATORIOS
// ─────────────────────────────────────────────────────────────────────────────
export async function listLabs({ category = null, search = null, limit = 50, page = 0 } = {}) {
    try {
        let query = supabase
            .from('laboratorios')
            .select('*, perfiles(nombre)', { count: 'exact' })
            .order('creado_en', { ascending: false })
            .range(page * limit, (page + 1) * limit - 1);

        if (category && category !== 'todos')
            query = query.eq('categoria', category);

        if (search && search.trim())
            query = query.or(`titulo.ilike.%${search}%,descripcion.ilike.%${search}%`);

        const { data, error, count } = await query;
        if (error) throw error;

        return { success: true, labs: data.map(_mapLab), total: count };
    } catch (err) {
        return { success: false, error: err.message, labs: [], total: 0 };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  OBTENER LAB POR ID
// ─────────────────────────────────────────────────────────────────────────────
export async function getLabById(id) {
    try {
        const { data, error } = await supabase
            .from('laboratorios')
            .select('*, perfiles(nombre, email)')
            .eq('id', id)
            .single();
        if (error) throw error;
        return { success: true, lab: _mapLab(data) };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ELIMINAR LAB
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteLab(labId) {
    const user = currentUser || obtenerUsuarioActual();
    if (!user) return { success: false, error: 'No autenticado.' };

    try {
        const { data: lab } = await supabase
            .from('laboratorios')
            .select('user_id, storage_path, bucket_name, tipo_recurso')
            .eq('id', labId)
            .single();

        if (!lab) return { success: false, error: 'No encontrado.' };
        if (lab.user_id !== user.id && user.rol !== 'admin')
            return { success: false, error: 'Sin permisos.' };

        // Borrar del storage si es archivo físico
        if (lab.tipo_recurso === TIPOS_RECURSO.ARCHIVO && lab.storage_path) {
            await supabase.storage.from(lab.bucket_name || LABS_BUCKET).remove([lab.storage_path]);
        }

        const { error } = await supabase.from('laboratorios').delete().eq('id', labId);
        if (error) throw error;
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  INCREMENTAR DESCARGAS / VISITAS
// ─────────────────────────────────────────────────────────────────────────────
export async function incrementDownloads(labId) {
    // Usamos rpc para evitar race conditions
    const { error } = await supabase.rpc('increment_downloads', { lab_id: labId });
    if (error) {
        // Fallback manual si la RPC no existe
        const { data } = await supabase
            .from('laboratorios').select('downloads').eq('id', labId).single();
        await supabase.from('laboratorios')
            .update({ downloads: (data?.downloads || 0) + 1 }).eq('id', labId);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  CATEGORÍAS ÚNICAS
// ─────────────────────────────────────────────────────────────────────────────
export async function getUniqueCategories() {
    try {
        const { data } = await supabase.from('laboratorios').select('categoria');
        const cats = new Set(['todos']);
        data?.forEach(r => { if (r.categoria) cats.add(r.categoria); });
        return Array.from(cats);
    } catch { return ['todos']; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAPPER INTERNO
// ─────────────────────────────────────────────────────────────────────────────
function _mapLab(d) {
    return {
        id:           d.id,
        title:        d.titulo,
        description:  d.descripcion,
        category:     d.categoria,
        tipoRecurso:  d.tipo_recurso,
        tipoEnlace:   d.tipo_enlace,
        fileUrl:      d.archivo_url,
        fileName:     d.nombre_archivo,
        fileSize:     d.tamano_archivo,
        extension:    d.extension,
        tags:         d.tags || [],
        userId:       d.user_id,
        autorNombre:  d.perfiles?.nombre || 'Desconocido',
        createdAt:    d.creado_en,
        downloads:    d.downloads || 0
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS UI
// ─────────────────────────────────────────────────────────────────────────────
export function formatBytes(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('es-PE', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

export function iconoTipo(tipo) {
    const iconos = { archivo: '📄', enlace: '🔗', video: '🎬', imagen: '🖼️', onedrive: '☁️', 'google-drive': '📁', dropbox: '📦' };
    return iconos[tipo] || '📄';
}

// ─────────────────────────────────────────────────────────────────────────────
//  INIT PÁGINAS
// ─────────────────────────────────────────────────────────────────────────────
export async function initHomePage() {
    const grid = document.getElementById('labs-grid');
    if (!grid) return;
    grid.innerHTML = '<p style="text-align:center;color:gray;">Cargando...</p>';

    const { labs } = await listLabs({ limit: 6 });
    if (!labs?.length) { grid.innerHTML = '<p style="text-align:center;color:gray;">No hay laboratorios aún.</p>'; return; }

    grid.innerHTML = labs.map(l => _cardHTML(l)).join('');
    _bindCardClicks(grid);
}

export async function initLabsPage() {
    const container = document.getElementById('listaLaboratorios');
    const searchInput = document.getElementById('searchInput');
    const catFilter   = document.getElementById('filtroCategoria');
    if (!container) return;

    // Cargar categorías en el filtro
    if (catFilter) {
        const cats = await getUniqueCategories();
        catFilter.innerHTML = cats.map(c => `<option value="${c}">${c === 'todos' ? '🏷️ Todas' : c}</option>`).join('');
        catFilter.addEventListener('change', () => _renderLabs(container, searchInput?.value, catFilter.value));
    }

    if (searchInput) {
        let timer;
        searchInput.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => _renderLabs(container, searchInput.value, catFilter?.value), 350);
        });
    }

    await _renderLabs(container, '', 'todos');
}

async function _renderLabs(container, search = '', category = 'todos') {
    container.innerHTML = '<p style="text-align:center;padding:2rem;color:gray;">Cargando...</p>';
    const { labs, error } = await listLabs({ category, search });
    if (error) { container.innerHTML = `<p style="color:red;">Error: ${error}</p>`; return; }
    if (!labs?.length) { container.innerHTML = '<p style="text-align:center;padding:2rem;color:gray;">No se encontraron laboratorios.</p>'; return; }
    container.innerHTML = labs.map(l => _cardHTML(l)).join('');
    _bindCardClicks(container);
}

export async function initCategoriesPage() {
    const container = document.getElementById('categoriasGrid');
    if (!container) return;
    const cats = await getUniqueCategories();
    const filtered = cats.filter(c => c !== 'todos');
    container.innerHTML = filtered.map(cat => `
        <div class="categoria-card" style="cursor:pointer;padding:1.5rem;border-radius:12px;border:1px solid #e5e7eb;text-align:center;"
             onclick="window.location.hash='laboratorios?cat=${cat}'">
            <div style="font-size:2rem;">${_iconoCat(cat)}</div>
            <h3>${cat}</h3>
        </div>`).join('');
}

export async function initUploadPage() {
    // El script inline de subir.html maneja todo;
    // esta función es el fallback del router
    const user = currentUser || obtenerUsuarioActual();
    const msg = document.getElementById('msgSubir');
    if (!user && msg) {
        msg.innerHTML = '⚠️ Debes iniciar sesión para subir laboratorios.';
        setTimeout(() => window.location.hash = 'login', 1500);
    }
}

export async function initDetailPage() {
    const params  = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const labId   = params.get('id');
    const content = document.getElementById('detalleContent');
    if (!labId || !content) return;

    content.innerHTML = '<p style="text-align:center;padding:3rem;">Cargando...</p>';

    const { success, lab, error } = await getLabById(labId);
    if (!success) { content.innerHTML = `<p style="color:red;">Error: ${error}</p>`; return; }

    const esEnlace  = [TIPOS_RECURSO.ENLACE, TIPOS_RECURSO.VIDEO].includes(lab.tipoRecurso);
    const botonHTML = esEnlace
        ? `<a href="${lab.fileUrl}" target="_blank" rel="noopener" class="btn btn-primary">${iconoTipo(lab.tipoEnlace)} Abrir enlace</a>`
        : `<button id="downloadBtn" class="btn btn-primary">📥 Descargar ${lab.extension?.toUpperCase() || ''}</button>`;

    content.innerHTML = `
        <div class="detail-card">
            <span class="detail-category">${lab.category}</span>
            <h1 class="detail-title">${lab.title}</h1>
            <div class="detail-stats">
                <span>👤 ${lab.autorNombre}</span>
                <span>📅 ${formatDate(lab.createdAt)}</span>
                <span>${iconoTipo(lab.tipoRecurso)} ${lab.tipoRecurso}</span>
                <span>⬇️ ${lab.downloads} descargas</span>
                ${lab.fileSize ? `<span>💾 ${formatBytes(lab.fileSize)}</span>` : ''}
            </div>
            <hr style="margin:1.5rem 0;">
            <p style="line-height:1.7;">${lab.description || 'Sin descripción.'}</p>
            ${lab.tags?.length ? `<div style="margin-top:1rem;">${lab.tags.map(t => `<span class="tag">#${t}</span>`).join(' ')}</div>` : ''}
            <div style="margin-top:2rem; display:flex; gap:1rem; flex-wrap:wrap;">
                ${botonHTML}
                <button class="btn btn-outline" onclick="window.location.hash='laboratorios'">← Volver</button>
            </div>
        </div>`;

    if (!esEnlace) {
        document.getElementById('downloadBtn')?.addEventListener('click', async () => {
            await incrementDownloads(lab.id);
            window.open(lab.fileUrl, '_blank');
        });
    } else {
        await incrementDownloads(lab.id);
    }
}

// ─── Helpers privados de UI ───────────────────────────────────────────────────
function _cardHTML(lab) {
    const icon = iconoTipo(lab.tipoEnlace || lab.tipoRecurso);
    return `
    <div class="lab-card" data-id="${lab.id}" style="cursor:pointer;">
        <div class="lab-card__badge">${lab.category}</div>
        <h3 class="lab-card__title">${lab.title}</h3>
        <p class="lab-card__desc">${(lab.description || '').substring(0, 120)}${lab.description?.length > 120 ? '…' : ''}</p>
        <div class="lab-card__meta">
            <span>${icon} ${lab.tipoRecurso}</span>
            <span>⬇️ ${lab.downloads}</span>
            <span>📅 ${formatDate(lab.createdAt)}</span>
        </div>
    </div>`;
}

function _bindCardClicks(container) {
    container.querySelectorAll('.lab-card[data-id]').forEach(card => {
        card.addEventListener('click', () => {
            window.location.hash = `detalle?id=${card.dataset.id}`;
        });
    });
}

function _iconoCat(cat) {
    const m = { Programación: '💻', Seguridad: '🔐', Redes: '🌐', IA: '🤖', Bases_de_datos: '🗄️', Web: '🌍' };
    return m[cat] || '📚';
}

console.log('✅ labs.js v2 listo');
