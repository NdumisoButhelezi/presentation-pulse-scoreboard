import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  
  useEffect(() => {
    // Check if window is defined (browser environment)
    if (typeof window === 'undefined') return;
    
    const media = window.matchMedia(query);
    
    // Set initial value
    setMatches(media.matches);
    
    // Define callback for media query changes
    const listener = () => {
      setMatches(media.matches);
    };
    
    // Add the listener
    media.addEventListener('change', listener);
    
    // Remove listener on cleanup
    return () => {
      media.removeEventListener('change', listener);
    };
  }, [query]);
  
  return matches;
}
