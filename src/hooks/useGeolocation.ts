import { useState, useEffect, useCallback, useRef } from "react";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  isTracking: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    isTracking: false,
  });

  const watchIdRef = useRef<number | null>(null);
  const onUpdateRef = useRef<((lat: number, lng: number) => void) | null>(null);
  const trackingRequestedRef = useRef(false);

  const defaultOptions: PositionOptions = {
    enableHighAccuracy: options.enableHighAccuracy ?? true,
    maximumAge: options.maximumAge ?? 5000,
    timeout: options.timeout ?? 10000,
  };

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    const { latitude, longitude, accuracy } = position.coords;
    setState((prev) => ({
      ...prev,
      latitude,
      longitude,
      accuracy,
      error: null,
    }));
    
    if (onUpdateRef.current) {
      onUpdateRef.current(latitude, longitude);
    }
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = "Unknown error";
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = "Location permission denied";
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = "Location unavailable";
        break;
      case error.TIMEOUT:
        errorMessage = "Location request timed out";
        break;
    }
    setState((prev) => ({ ...prev, error: errorMessage }));
  }, []);

  const startTracking = useCallback(
    (onUpdate?: (lat: number, lng: number) => void) => {
      if (!navigator.geolocation) {
        setState((prev) => ({
          ...prev,
          error: "Geolocation is not supported",
        }));
        return;
      }

      onUpdateRef.current = onUpdate || null;
      trackingRequestedRef.current = true;

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      
      // Get initial position
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        handleError,
        defaultOptions
      );

      // Start watching position
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        defaultOptions
      );

      setState((prev) => ({ ...prev, isTracking: true }));
    },
    [handleSuccess, handleError]
  );

  const stopTracking = useCallback(() => {
    trackingRequestedRef.current = false;
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    onUpdateRef.current = null;
    setState((prev) => ({ ...prev, isTracking: false }));
  }, []);

  // Mobile browsers can suspend their GPS watcher while the screen is locked.
  // Request a fresh fix and rebuild the watcher as soon as the trip tab returns.
  useEffect(() => {
    const resumeTracking = () => {
      if (document.visibilityState !== "visible" || !trackingRequestedRef.current || !navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, defaultOptions);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, defaultOptions);
    };

    document.addEventListener("visibilitychange", resumeTracking);
    window.addEventListener("focus", resumeTracking);
    return () => {
      document.removeEventListener("visibilitychange", resumeTracking);
      window.removeEventListener("focus", resumeTracking);
    };
  }, [handleSuccess, handleError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    ...state,
    startTracking,
    stopTracking,
  };
}
