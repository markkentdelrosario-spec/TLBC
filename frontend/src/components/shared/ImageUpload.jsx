import { useEffect, useState } from 'react';
import { apiRequest, getErrorMessage } from '../../services/api';

const buttonClass =
  'inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50';

export default function ImageUpload({
  getIdToken,
  apiBaseUrl = '/api',
  folder,
  label = 'Choose image',
  onUploaded,
}) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  function chooseFile(event) {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    setError('');
    setNotice('');
    setPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return nextFile ? URL.createObjectURL(nextFile) : '';
    });
  }

  async function upload(event) {
    event.preventDefault();
    if (!file) {
      setError('Choose an image before uploading.');
      return;
    }

    setUploading(true);
    setError('');
    setNotice('');
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
      setNotice('Image uploaded successfully.');
      setFile(null);
      setPreviewUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return '';
      });
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    } finally {
      setUploading(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={upload}>
      <label className="block text-sm font-semibold text-slate-700">
        {label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:font-semibold file:text-emerald-800"
          onChange={chooseFile}
          disabled={uploading}
        />
      </label>
      {previewUrl && (
        <img
          src={previewUrl}
          alt="Selected image preview"
          className="max-h-48 max-w-full rounded-xl border border-slate-200 object-contain"
        />
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
      <button type="submit" className={buttonClass} disabled={uploading || !file}>
        {uploading ? 'Uploading…' : 'Upload image'}
      </button>
    </form>
  );
}
