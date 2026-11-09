import { useCallback, useEffect, useState } from 'react';
import { apiRequest, getErrorMessage } from '../../services/api';

const buttonClass =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700';
const inputClass =
  'mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

export default function AdminSlideshowManagement({
  getIdToken,
  apiBaseUrl = '/api',
}) {
  const [slides, setSlides] = useState([]);
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState([]);
  const [editingId, setEditingId] = useState('');
  const [editDraft, setEditDraft] = useState({ title: '', caption: '', image: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSlides = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest('/slideshows', { getIdToken, apiBaseUrl });
      setSlides(result.slides || []);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, getIdToken]);

  useEffect(() => {
    loadSlides();
  }, [loadSlides]);

  async function addSlide(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!images.length) {
      setError('Choose at least one image for the slideshow.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = new FormData();
      body.append('caption', caption.trim());
      images.forEach((image) => body.append('images', image));
      await apiRequest('/slideshows', {
        getIdToken,
        apiBaseUrl,
        method: 'POST',
        body,
      });
      setCaption('');
      setImages([]);
      form.reset();
      setNotice(`${images.length} slideshow image${images.length === 1 ? '' : 's'} added.`);
      await loadSlides();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(slide) {
    setEditingId(slide._id);
    setEditDraft({ title: slide.title, caption: slide.caption || '', image: null });
    setError('');
    setNotice('');
  }

  async function saveEdit(event, slide) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = new FormData();
      body.append('title', editDraft.title.trim());
      body.append('caption', editDraft.caption.trim());
      if (editDraft.image) body.append('image', editDraft.image);
      await apiRequest(`/slideshows/${slide._id}`, {
        getIdToken,
        apiBaseUrl,
        method: 'PATCH',
        body,
      });
      setEditingId('');
      setNotice('Slideshow image updated.');
      await loadSlides();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function reorderSlide(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= slides.length || busy) return;
    const nextSlides = [...slides];
    [nextSlides[index], nextSlides[nextIndex]] = [nextSlides[nextIndex], nextSlides[index]];
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest('/slideshows/reorder/list', {
        getIdToken,
        apiBaseUrl,
        method: 'PATCH',
        body: JSON.stringify({ slideIds: nextSlides.map((slide) => slide._id) }),
      });
      setSlides(result.slides || nextSlides);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function deleteSlide(slide) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/slideshows/${slide._id}`, {
        getIdToken,
        apiBaseUrl,
        method: 'DELETE',
      });
      setSlides((current) => current.filter((item) => item._id !== slide._id));
      setNotice('Slideshow image deleted.');
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="slideshow-management"
      className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900"
    >
      <header className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">Admin settings</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">Welcome slideshow</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
          Add, replace, edit, reorder, or remove images shown when members enter their dashboard.
        </p>
      </header>

      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</p>}

      <form onSubmit={addSlide} className="mb-6 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 dark:bg-slate-800">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 sm:col-span-2">
          Caption
          <input maxLength={500} className={inputClass} value={caption} onChange={(event) => setCaption(event.target.value)} />
        </label>
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 sm:col-span-2">
          Slideshow images (JPEG, PNG, WebP, or GIF; up to 5 MB each, 20 images per upload)
          <input
            required
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="mt-2 block min-h-11 w-full text-sm text-slate-600 file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-violet-100 file:px-3 file:font-semibold file:text-violet-800"
            onChange={(event) => {
              const selected = Array.from(event.target.files || []);
              if (selected.length > 20) {
                setImages([]);
                setError('Select no more than 20 images at a time.');
                event.target.value = '';
                return;
              }
              setError('');
              setImages(selected);
            }}
          />
          {images.length > 0 && (
            <span className="mt-2 block text-xs font-normal text-slate-500 dark:text-slate-300">
              {images.length} image{images.length === 1 ? '' : 's'} selected: {images.map((image) => image.name).join(', ')}
            </span>
          )}
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50 sm:col-span-2" disabled={busy}>
          {busy ? 'Uploading images…' : `Add ${images.length || ''} slideshow image${images.length === 1 ? '' : 's'}`}
        </button>
      </form>

      {loading ? (
        <p role="status" className="py-6 text-center text-sm text-slate-500">Loading slideshow…</p>
      ) : slides.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-300">
          No slideshow images have been added yet.
        </p>
      ) : (
        <div className="space-y-3">
          {slides.map((slide, index) => (
            <article key={slide._id} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:items-center dark:border-slate-700">
              <img src={slide.url} alt="" className="h-24 w-full rounded-lg object-cover sm:w-28" />
              {editingId === slide._id ? (
                <form onSubmit={(event) => saveEdit(event, slide)} className="grid min-w-0 gap-2 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Title
                    <input required maxLength={120} className={inputClass} value={editDraft.title} onChange={(event) => setEditDraft((draft) => ({ ...draft, title: event.target.value }))} />
                  </label>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Caption
                    <input maxLength={500} className={inputClass} value={editDraft.caption} onChange={(event) => setEditDraft((draft) => ({ ...draft, caption: event.target.value }))} />
                  </label>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 sm:col-span-2">
                    Replace image (optional)
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="mt-2 block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-violet-100 file:px-3 file:font-semibold file:text-violet-800" onChange={(event) => setEditDraft((draft) => ({ ...draft, image: event.target.files?.[0] || null }))} />
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <button className="min-h-11 rounded-lg bg-violet-600 px-3 text-sm font-semibold text-white disabled:opacity-50" disabled={busy}>Save changes</button>
                    <button type="button" className={buttonClass} onClick={() => setEditingId('')} disabled={busy}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-900 dark:text-slate-100">{index + 1}. {slide.title}</p>
                  {slide.caption && <p className="mt-1 break-words text-sm text-slate-500 dark:text-slate-300">{slide.caption}</p>}
                </div>
              )}
              {editingId !== slide._id && (
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button type="button" className={buttonClass} aria-label={`Move ${slide.title} up`} onClick={() => reorderSlide(index, -1)} disabled={busy || index === 0}>↑</button>
                  <button type="button" className={buttonClass} aria-label={`Move ${slide.title} down`} onClick={() => reorderSlide(index, 1)} disabled={busy || index === slides.length - 1}>↓</button>
                  <button type="button" className={buttonClass} onClick={() => beginEdit(slide)} disabled={busy}>Edit</button>
                  <button type="button" className="min-h-11 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50" onClick={() => deleteSlide(slide)} disabled={busy}>Delete</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
