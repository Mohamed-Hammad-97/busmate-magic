import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useGoogleMapsToken = () => {
  const [token, setToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        // First try environment variable
        const envToken = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (envToken) {
          setToken(envToken);
          setIsLoading(false);
          return;
        }

        // Fallback: fetch from edge function
        const { data, error: fetchError } = await supabase.functions.invoke('get-google-maps-key');
        
        if (fetchError) {
          setError('Failed to load Google Maps API key');
          console.error('Error fetching Google Maps key:', fetchError);
        } else if (data?.apiKey) {
          setToken(data.apiKey);
        } else {
          setError('Google Maps API key not configured');
        }
      } catch (err) {
        setError('Failed to load Google Maps API key');
        console.error('Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchToken();
  }, []);

  return { token, isLoading, error };
};
