import React, { createContext, useContext } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
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

export const GoogleMapsProvider: React.FC<GoogleMapsProviderProps> = ({ children }) => {
  const { token, isLoading: tokenLoading, error: tokenError } = useGoogleMapsToken();

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: token || '',
    libraries,
    language: 'ar',
    region: 'EG',
    // Prevent loading if no token
    preventGoogleFontsLoading: false,
  });

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
