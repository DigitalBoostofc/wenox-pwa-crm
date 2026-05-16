import { useEffect, useState } from 'react';

/** true quando a media query casa. Seguro em jsdom (sem matchMedia → false). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, [query]);

  return matches;
}

/** Desktop = largura ≥ 1024px (breakpoint lg do Tailwind). */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
