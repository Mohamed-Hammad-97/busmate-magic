import React from 'react';
import { LoadScript } from '@react-google-maps/api';
import { useGoogleMapsToken } from '@/hooks/useGoogleMapsToken';
import { Loader2 } from 'lucide-react';

const libraries: ("places" | "drawing" | "geometry")[] = ["places", "drawing", "geometry"];

interface GoogleMapsProviderProps {
  children: React.ReactNode;
}

export const GoogleMapsProvider: React.FC<GoogleMapsProviderProps> = ({ children }) => {
  const { token, isLoading, error } = useGoogleMapsToken();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-muted rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] bg-muted rounded-lg">
        <p className="text-muted-foreground">Google Maps API key not configured</p>
      </div>
    );
  }

  return (
    <LoadScript 
      googleMapsApiKey={token} 
      libraries={libraries}
      language="ar"
      region="EG"
    >
      {children}
    </LoadScript>
  );
};
