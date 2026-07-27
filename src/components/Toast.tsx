import { useEffect, useState, useCallback } from 'react';

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3200);
    return () => clearTimeout(t);
  }, [message]);

  const toast = useCallback((m: string) => setMessage(m), []);
  const node = message ? <div className="toast">{message}</div> : null;

  return { toast, node };
}
