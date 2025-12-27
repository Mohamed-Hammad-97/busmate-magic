import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useMapboxToken = () => {
  const [token, setToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        // For Mapbox public token, we'll use the one stored in secrets
        // Since it's a public token, we can also store it as an environment variable
        const mapboxToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
        
        if (mapboxToken) {
          setToken(mapboxToken);
        } else {
          // Fallback: Use the token directly (this should be set in .env)
          // For now, we'll use a placeholder that the user provided
          setToken('pk.eyJ1IjoiYWhtZWRoYW1hYWQiLCJhIjoiY21qbW5pd3FnMDJqZzNlc2s4d2kwempvNiJ9.epSJQYdtc-gBr7HZq02JDw');
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
