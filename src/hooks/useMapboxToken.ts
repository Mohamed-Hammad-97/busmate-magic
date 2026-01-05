import { useState, useEffect } from 'react';

export const useMapboxToken = () => {
  const [token, setToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        // Use environment variable only - no hardcoded fallback
        const mapboxToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
        
        if (mapboxToken) {
          setToken(mapboxToken);
        } else {
          setError('Mapbox token not configured. Please set VITE_MAPBOX_PUBLIC_TOKEN environment variable.');
        }
      } catch (err) {
        setError('Failed to load Mapbox token');
      } finally {
        setIsLoading(false);
      }
    };

    fetchToken();
  }, []);

  return { token, isLoading, error };
};
