import { useEffect, useState } from 'react';

export default function ConnectionStatusBanner() {
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <p
      role="status"
      aria-live="polite"
      className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950"
    >
      Your device appears to be offline. Some information may be unavailable.
    </p>
  );
}
