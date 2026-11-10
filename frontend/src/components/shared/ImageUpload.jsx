import { useEffect, useState } from 'react';
import { apiRequest, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const buttonClass =
  'inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50';

export default function ImageUpload({
  getIdToken,
  apiBaseUrl = '/api',
  folder,
  label = 'Choose image',
  onUploaded,
  compact = false,
}) {
  const { showToast } = useToast();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  function chooseFile(event) {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    setPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return nextFile ? URL.createObjectURL(nextFile) : '';
    });
  }

  async function upload(event) {
    event.preventDefault();
    if (!file) {
      showToast('Choose an image before uploading.', 'error');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('folder', folder);
      const result = await apiRequest('/upload', {
        getIdToken,
        apiBaseUrl,
        method: 'POST',
        body: formData,
      });
      await onUploaded?.({
        secure_url: result.secure_url,
        public_id: result.public_id,
      });
      showToast('Image uploaded successfully.', 'success');
      setFile(null);
      setPreviewUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return '';
      });
    } catch (uploadError) {
      showToast(getErrorMessage(uploadError), 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form className={compact ? 'flex min-w-0 flex-wrap items-end gap-2' : 'space-y-3'} onSubmit={upload}>
      <label className={`min-w-0 text-sm font-semibold text-slate-700 ${compact ? 'flex-1' : 'block'}`}>
        {label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="mt-1 block w-full text-xs text-slate-600 file:mr-2 file:min-h-9 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-2 file:text-xs file:font-semibold file:text-emerald-800"
          onChange={chooseFile}
          disabled={uploading}
        />
      </label>
      {!compact && previewUrl && (
        <img
          src={previewUrl}
          alt="Selected image preview"
          className="max-h-48 max-w-full rounded-xl border border-slate-200 object-contain"
        />
      )}
      <button type="submit" className={`${buttonClass} ${compact ? 'min-h-9 px-3 text-xs' : ''}`} disabled={uploading || !file}>
        {uploading ? 'Uploading…' : compact ? 'Upload' : 'Upload image'}
      </button>
    </form>
  );
}
