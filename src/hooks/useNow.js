import { useEffect, useState } from 'react';

/** Current timestamp, refreshed every `interval` ms. Drives live countdowns. */
export function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}
