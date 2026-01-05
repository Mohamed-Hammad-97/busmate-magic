import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useGoogleMapsToken = () => {
  const [token, setToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        console.log('useGoogleMapsToken: Starting to fetch token...');
        
        // First try environment variable
        const envToken = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (envToken) {
          console.log('useGoogleMapsToken: Found env token');
          setToken(envToken);
          setIsLoading(false);
          return;
        }

        console.log('useGoogleMapsToken: No env token, fetching from edge function...');
        
        // Fetch from edge function
        const { data, error: fetchError } = await supabase.functions.invoke('get-google-maps-key');
        
        console.log('useGoogleMapsToken: Edge function response:', { data, fetchError });
        
        if (fetchError) {
          console.error('useGoogleMapsToken: Error fetching key:', fetchError);
          setError('Failed to load Google Maps API key');
        } else if (data?.apiKey) {
          console.log('useGoogleMapsToken: Successfully got API key');
          setToken(data.apiKey);
        } else {
          console.error('useGoogleMapsToken: No API key in response');
          setError('Google Maps API key not configured');
        }
      } catch (err) {
        console.error('useGoogleMapsToken: Exception:', err);
        setError('Failed to load Google Maps API key');
      } finally {
        setIsLoading(false);
      }
    };

    fetchToken();
  }, []);

  return { token, isLoading, error };
};
