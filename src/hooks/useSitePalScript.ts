import { useState, useEffect, useRef } from 'react';
import { SITEPAL_CONFIG } from '../config/sitepalConfig';

interface UseSitePalScriptReturn {
  isScriptLoaded: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Custom hook to manage SitePal script loading
 * Ensures the SitePal script is loaded only once and provides loading state
 */
export const useSitePalScript = (): UseSitePalScriptReturn => {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    // Check if script is already loaded
    if (scriptLoadedRef.current || typeof window.AI_vhost_embed === 'function') {
      setIsScriptLoaded(true);
      setIsLoading(false);
      return;
    }

    // Check if script element already exists
    const existingScript = document.getElementById('sitepal-script');
    if (existingScript) {
      // Script element exists, wait for it to load
      setIsLoading(true);
      const checkLoaded = () => {
        if (typeof window.AI_vhost_embed === 'function') {
          setIsScriptLoaded(true);
          setIsLoading(false);
          scriptLoadedRef.current = true;
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
      return;
    }

    // Load the script
    setIsLoading(true);
    setError(null);

    const script = document.createElement('script');
    script.id = 'sitepal-script';
    script.src = SITEPAL_CONFIG.SCRIPT_URL;
    script.async = true;

    script.onload = () => {
      console.log('[useSitePalScript] SitePal script loaded successfully');
      setIsScriptLoaded(true);
      setIsLoading(false);
      scriptLoadedRef.current = true;
    };

    script.onerror = () => {
      console.error('[useSitePalScript] Failed to load SitePal script');
      const errorMessage = 'Failed to load SitePal script. Please check your internet connection and try again.';
      setError(errorMessage);
      setIsLoading(false);
    };

    // Add timeout for script loading
    const timeout = setTimeout(() => {
      if (!scriptLoadedRef.current) {
        console.error('[useSitePalScript] Script loading timeout');
        setError('Script loading timeout. Please refresh the page and try again.');
        setIsLoading(false);
      }
    }, SITEPAL_CONFIG.INITIALIZATION.SCRIPT_LOAD_TIMEOUT_MS);

    document.body.appendChild(script);

    // Cleanup function
    return () => {
      clearTimeout(timeout);
      // Note: We don't remove the script on cleanup as it might be used by other components
    };
  }, []);

  return {
    isScriptLoaded,
    isLoading,
    error,
  };
};

export default useSitePalScript;
