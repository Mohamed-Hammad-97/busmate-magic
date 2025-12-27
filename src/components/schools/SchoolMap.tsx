import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Tables } from '@/integrations/supabase/types';

type School = Tables<'schools'>;

interface SchoolMapProps {
  schools: School[];
  onSchoolClick?: (school: School) => void;
  mapboxToken: string;
}

const SchoolMap: React.FC<SchoolMapProps> = ({ schools, onSchoolClick, mapboxToken }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [31.2357, 30.0444], // Cairo, Egypt
      zoom: 10,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add markers for each school
    schools.forEach(school => {
      const el = document.createElement('div');
      el.className = 'school-marker';
      el.style.cssText = `
        width: 30px;
        height: 30px;
        background: hsl(var(--primary));
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 8-4 8 4"></path><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"></path><path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"></path><path d="M18 5v17"></path><path d="M6 5v17"></path><circle cx="12" cy="9" r="2"></circle></svg>`;

      const marker = new mapboxgl.Marker(el)
        .setLngLat([school.longitude, school.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<strong>${school.name}</strong><br/>${school.city || 'No city'}`
          )
        )
        .addTo(map.current!);

      el.addEventListener('click', () => {
        onSchoolClick?.(school);
      });

      markersRef.current.push(marker);
    });

    // Fit map to show all markers
    if (schools.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      schools.forEach(school => {
        bounds.extend([school.longitude, school.latitude]);
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 14 });
    }
  }, [schools, onSchoolClick]);

  const focusOnSchool = (school: School) => {
    map.current?.flyTo({
      center: [school.longitude, school.latitude],
      zoom: 15,
      duration: 1500,
    });
  };

  return (
    <div ref={mapContainer} className="w-full h-[400px] rounded-lg border border-border" />
  );
};

export default SchoolMap;
