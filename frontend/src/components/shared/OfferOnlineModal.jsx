import { useEffect, useRef } from 'react';

export default function OfferOnlineModal({ open, onClose }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeButtonRef.current?.focus();
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-online-title"
        className="w-full max-w-md rounded-3xl border border-white/30 bg-white p-5 text-center shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4 text-left">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              The Life Builder Church
            </p>
            <h2 id="offer-online-title" className="mt-1 text-xl font-bold text-slate-900">
              Offer Online
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close Offer Online"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-300 text-xl text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            ×
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Scan this QR code to give online.
        </p>
        <img
          src="/images/QR/QR1.jpg"
          alt="Offer Online giving QR code"
          className="mx-auto mt-5 aspect-square w-full max-w-[320px] rounded-2xl border border-slate-200 bg-white object-contain p-2"
        />
      </section>
    </div>
  );
}
