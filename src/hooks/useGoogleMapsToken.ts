import { useState, useEffect } from 'react';

export const useGoogleMapsToken = () => {
  const [token, setToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const googleMapsToken = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        
        if (googleMapsToken) {
          setToken(googleMapsToken);
        } else {
          setError('Google Maps API key not configured');
        }
      } catch (err) {
        setError('Failed to load Google Maps API key');
      } finally {
        setIsLoading(false);
      }
    };

    fetchToken();
  }, []);

  return { token, isLoading, error };
};
