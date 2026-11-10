import { useEffect, useState } from 'react';
import { createReportPdf } from '../../utils/createReportPdf';
import { downloadCsv } from '../../utils/downloadCsv';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function FilePreviewModal({
  open,
  onClose,
  title,
  filename,
  format,
  rows,
  metadata,
  onDownload,
}) {
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfBlob, setPdfBlob] = useState(null);
  const [pdfError, setPdfError] = useState('');

  useEffect(() => {
    if (!open || format !== 'pdf') {
      setPdfUrl('');
      setPdfBlob(null);
      setPdfError('');
      return undefined;
    }
    let active = true;
    let objectUrl = '';
    setPdfUrl('');
    setPdfBlob(null);
    setPdfError('');
    createReportPdf(title, rows, metadata)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfBlob(blob);
        setPdfUrl(objectUrl);
      })
      .catch((error) => {
        if (active) setPdfError(error instanceof Error ? error.message : 'Unable to prepare PDF preview.');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [format, metadata, open, rows, title]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  function confirmDownload() {
    if (format === 'csv') downloadCsv(filename, rows);
    else if (pdfBlob) downloadBlob(pdfBlob, filename);
    onDownload?.();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-preview-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 dark:border-slate-700 sm:p-5">
          <div className="min-w-0">
            <h2 id="file-preview-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
              File preview
            </h2>
            <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-300">{filename}</p>
          </div>
          <button
            type="button"
            aria-label="Close file preview"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-xl text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
          {format === 'csv' ? (
            <div className="max-h-[62vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-slate-100 text-xs font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  <tr>
                    {(rows[0] || []).map((cell, index) => (
                      <th key={`${index}-${cell}`} className="whitespace-nowrap border-b border-slate-200 px-3 py-3 dark:border-slate-700">
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.slice(1).map((row, rowIndex) => (
                    <tr key={rowIndex} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-800/60">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="max-w-xs whitespace-nowrap px-3 py-2.5 text-slate-700 dark:text-slate-200">
                          {cell ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            pdfError ? (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {pdfError}
              </p>
            ) : pdfUrl ? (
              <iframe
                title={`${title} PDF preview`}
                src={pdfUrl}
                className="h-[62vh] min-h-80 w-full rounded-lg border border-slate-200 bg-white dark:border-slate-700"
              />
            ) : (
              <p role="status" className="py-12 text-center text-sm text-slate-500">
                Preparing PDF preview…
              </p>
            )
          )}
        </div>

        <footer className="flex flex-col-reverse justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:p-5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Cancel / Close
          </button>
          <button
            type="button"
            onClick={confirmDownload}
            disabled={format === 'pdf' && !pdfBlob}
            className="min-h-11 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm Download
          </button>
        </footer>
      </section>
    </div>
  );
}
