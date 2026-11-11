import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { getDesignations } from '../../utils/designations';

const primaryDesignation = {
  admin: 'Administrator',
  pastor: 'Pastor',
  member: 'Church Member',
};

export default function MemberQRCode({
  user,
  open: controlledOpen,
  onClose,
  showTrigger = true,
}) {
  const cardRef = useRef(null);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const open = controlledOpen ?? internalOpen;
  const setOpen = (nextOpen) => {
    if (nextOpen) setInternalOpen(true);
    else {
      setInternalOpen(false);
      onClose?.();
    }
  };
  const userId = user?.qrId || user?._id;
  const fullName = user?.name || user?.displayName || 'Church member';

  useEffect(() => {
    if (!open) return undefined;
    const trigger = triggerRef.current;
    closeRef.current?.focus();
    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      trigger?.focus();
    };
  }, [open]);

  async function downloadQRCode() {
    if (!cardRef.current || !userId || downloading) return;

    setDownloading(true);
    setDownloadError('');
    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 3,
      });
      const link = document.createElement('a');
      link.download = `church-id-${String(userId).replace(/[^a-zA-Z0-9_-]/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Unable to export the digital ID card.', error);
      setDownloadError(
        'The ID card image could not be created. Check that the card images are available, then try again.'
      );
    } finally {
      setDownloading(false);
    }
  }

  if (!userId) return null;

  return (
    <>
      {showTrigger && (
        <section className="bg-slate-50 px-4 py-2 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl justify-end">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open digital church ID card"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18v2M18 18h2v2h-2z" />
              </svg>
              <span>My QR ID</span>
            </button>
          </div>
        </section>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/60 p-2 backdrop-blur-sm sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-id-title"
            className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-y-auto rounded-3xl border border-white/30 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-h-[calc(100dvh-2rem)]"
          >
            <header className="flex shrink-0 items-center justify-end px-3 pt-3">
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close digital ID card"
                className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 text-xl text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                ×
              </button>
            </header>

            <div
              ref={cardRef}
              className="digital-id-card mx-3 mb-3 shrink-0 overflow-hidden rounded-3xl border border-slate-200 bg-white sm:mx-4"
            >
              <header className="flex items-center gap-3 bg-emerald-950 px-4 py-4 text-white">
                <img
                  src="/images/logo/Logo.jpg"
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full border-2 border-white/80 object-cover"
                />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">
                    The Life Builder Church
                  </p>
                  <h2 id="member-id-title" className="mt-0.5 text-lg font-bold">
                    Digital ID Card
                  </h2>
                </div>
              </header>

              <div className="grid grid-cols-1 gap-3 p-3 sm:p-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center md:gap-4">
                <div className="digital-id-card__profile rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    {user.profilePicture ? (
                      <img
                        src={user.profilePicture}
                        alt=""
                        crossOrigin="anonymous"
                        className="h-16 w-16 shrink-0 rounded-full border-2 border-white object-cover shadow-sm"
                      />
                    ) : (
                      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-white bg-emerald-900 text-2xl font-bold text-amber-100 shadow-sm">
                        {fullName.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <h3 className="break-words text-lg font-bold text-slate-900">{fullName}</h3>
                      <p className="mt-1 text-sm font-semibold text-emerald-800">
                        {primaryDesignation[user.role] || 'Church Member'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-emerald-100 pt-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Secondary designation</p>
                      <p className="mt-1 break-words text-xs font-semibold text-slate-800">
                        {getDesignations(user).join(', ') || 'None assigned'}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Group</p>
                      <p className="mt-1 break-words text-xs font-semibold text-slate-800">
                        {user.groupName || 'Not assigned'}
                      </p>
                    </div>
                    {user.email && (
                      <div className="col-span-2 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Email</p>
                        <p className="mt-1 break-all text-xs text-slate-700">{user.email}</p>
                      </div>
                    )}
                    {user.phoneNumber && (
                      <div className="col-span-2 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Phone</p>
                        <p className="mt-1 text-xs text-slate-700">{user.phoneNumber}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="digital-id-card__qr flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-3 py-4">
                  <p className="text-xs font-bold text-slate-800">Attendance check-in</p>
                  <p className="mt-0.5 text-center text-[10px] text-slate-500">
                    Show this code to your team when you arrive.
                  </p>
                  <div className="mt-2 rounded-xl border border-slate-100 bg-white p-1.5">
                    <QRCodeCanvas
                      value={userId}
                      size={192}
                      level="H"
                      includeMargin
                      aria-label={`Attendance QR code for ${fullName}`}
                    />
                  </div>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Member ID</p>
                  <p className="mt-1 max-w-full break-all text-center font-mono text-xs font-semibold text-slate-900">
                    {userId}
                  </p>
                </div>
                <footer className="pt-1 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400 md:col-span-2">
                  Church Member Identification · The Life Builder Church
                </footer>
              </div>
            </div>

            <div className="shrink-0 px-3 pb-3 sm:px-4">
              {downloadError && (
                <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  {downloadError}
                </p>
              )}
              <button
                type="button"
                onClick={downloadQRCode}
                disabled={downloading}
                className="flex min-h-10 w-full items-center justify-center rounded-xl bg-emerald-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
              >
                {downloading ? 'Preparing ID card…' : 'Download Digital ID Card'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
