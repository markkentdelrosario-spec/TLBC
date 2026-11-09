import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

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
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (nextOpen) => {
    if (nextOpen) setInternalOpen(true);
    else {
      setInternalOpen(false);
      onClose?.();
    }
  };
  const userId = user?._id;
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

  function downloadQRCode() {
    const canvas = containerRef.current?.querySelector('canvas');
    if (!canvas || !userId) return;

    const link = document.createElement('a');
    link.download = `church-qr-${userId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
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
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-id-title"
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-white/30 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <header className="flex items-start justify-between bg-emerald-950 px-5 py-5 text-white sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">
                  The Life Builder Church
                </p>
                <h2 id="member-id-title" className="mt-1 text-xl font-bold">
                  Digital ID Card
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close digital ID card"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-xl text-white/90 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
              >
                ×
              </button>
            </header>

            <div className="p-5 sm:p-6">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  {user.profilePicture ? (
                    <img
                      src={user.profilePicture}
                      alt=""
                      className="h-14 w-14 rounded-full border-2 border-white object-cover shadow-sm"
                    />
                  ) : (
                    <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-white bg-emerald-900 text-lg font-bold text-amber-100 shadow-sm">
                      {fullName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-slate-900">{fullName}</h3>
                    <p className="mt-0.5 text-xs font-semibold text-emerald-800">
                      {primaryDesignation[user.role] || 'Church Member'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-emerald-100 pt-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Secondary designation</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                      {user.secondaryDesignation || 'None assigned'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Group</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                      {user.groupName || 'Not assigned'}
                    </p>
                  </div>
                  {user.email && (
                    <div className="col-span-2 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Email</p>
                      <p className="mt-1 truncate text-sm text-slate-700">{user.email}</p>
                    </div>
                  )}
                  {user.phoneNumber && (
                    <div className="col-span-2 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Phone</p>
                      <p className="mt-1 text-sm text-slate-700">{user.phoneNumber}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold text-slate-800">Attendance check-in</p>
                <p className="mt-1 text-center text-xs text-slate-500">
                  Show this code to your team when you arrive.
                </p>
                <div ref={containerRef} className="mt-3 rounded-xl border border-slate-100 bg-white p-2">
                  <QRCodeCanvas
                    value={userId}
                    size={176}
                    level="H"
                    includeMargin
                    aria-label={`Attendance QR code for ${fullName}`}
                  />
                </div>
                <p className="mt-2 text-[10px] text-slate-400">Member ID · {userId}</p>
              </div>

              <button
                type="button"
                onClick={downloadQRCode}
                className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2"
              >
                Download QR Code
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
