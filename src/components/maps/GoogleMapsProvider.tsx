import React, { createContext, useContext, useEffect, useState } from 'react';
import { useGoogleMapsToken } from '@/hooks/useGoogleMapsToken';
import { Loader2 } from 'lucide-react';

const libraries: ("places" | "drawing" | "geometry")[] = ["places", "drawing", "geometry"];

interface GoogleMapsContextType {
  isLoaded: boolean;
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({ isLoaded: false });

export const useGoogleMaps = () => useContext(GoogleMapsContext);

interface GoogleMapsProviderProps {
  children: React.ReactNode;
}

// Inner component that loads Google Maps only when token is available
const GoogleMapsLoader: React.FC<{ apiKey: string; children: React.ReactNode }> = ({ apiKey, children }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // Check if already loaded
    if (window.google?.maps) {
      setIsLoaded(true);
      return;
    }

    // Load Google Maps script manually to avoid re-initialization issues
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      // Script already exists, wait for it to load
      if (window.google?.maps) {
        setIsLoaded(true);
      } else {
        existingScript.addEventListener('load', () => setIsLoaded(true));
        existingScript.addEventListener('error', () => setLoadError(true));
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${libraries.join(',')}&language=ar&region=EG`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setIsLoaded(true);
    };

    script.onerror = () => {
      setLoadError(true);
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove script on unmount to prevent re-loading issues
    };
  }, [apiKey]);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-muted rounded-lg">
        <p className="text-muted-foreground">Failed to load Google Maps</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-muted rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <GoogleMapsContext.Provider value={{ isLoaded }}>
      {children}
    </GoogleMapsContext.Provider>
  );
};

export const GoogleMapsProvider: React.FC<GoogleMapsProviderProps> = ({ children }) => {
  const { token, isLoading: tokenLoading, error: tokenError } = useGoogleMapsToken();

  if (tokenLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-muted rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tokenError || !token) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-muted rounded-lg">
        <p className="text-muted-foreground">Google Maps API key not configured</p>
      </div>
    );
  }

  return (
    <GoogleMapsLoader apiKey={token}>
      {children}
    </GoogleMapsLoader>
  );
};
