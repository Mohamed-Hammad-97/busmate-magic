import React, { useEffect, useRef, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { School, MapPin, Users } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Registration = Tables<'registrations'> & {
  parent_accounts: Tables<'parent_accounts'>;
  schools: Tables<'schools'>;
};

interface RegistrationsMapProps {
  registrations: Registration[];
}

const RegistrationsMap: React.FC<RegistrationsMapProps> = ({ registrations }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const { token: mapboxToken, isLoading: tokenLoading } = useMapboxToken();
  
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [showAllStudents, setShowAllStudents] = useState(false);

  // Get unique schools from registrations
  const schools = useMemo(() => {
    const schoolMap: Record<string, Tables<'schools'>> = {};
    registrations.forEach((reg) => {
      if (reg.schools && !schoolMap[reg.schools.id]) {
        schoolMap[reg.schools.id] = reg.schools;
      }
    });
    return Object.values(schoolMap);
  }, [registrations]);

  // Get registrations for selected school
  const filteredRegistrations = useMemo(() => {
    if (showAllStudents) return registrations;
    if (!selectedSchool) return [];
    return registrations.filter((reg) => reg.school_id === selectedSchool);
  }, [registrations, selectedSchool, showAllStudents]);

  // Initialize map
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

  // Update markers when selection changes
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add school marker if selected
    if (selectedSchool) {
      const school = schools.find((s) => s.id === selectedSchool);
      if (school) {
        const el = document.createElement('div');
        el.innerHTML = `
          <div style="
            width: 40px;
            height: 40px;
            background: hsl(var(--primary));
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m4 6 8-4 8 4"></path>
              <path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"></path>
              <path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"></path>
              <path d="M18 5v17"></path>
              <path d="M6 5v17"></path>
              <circle cx="12" cy="9" r="2"></circle>
            </svg>
          </div>
        `;
        const marker = new mapboxgl.Marker(el)
          .setLngLat([school.longitude, school.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>${school.name}</strong>`))
          .addTo(map.current!);
        markersRef.current.push(marker);
      }
    }

    // Add student markers with 3D pin style
    filteredRegistrations.forEach((reg) => {
      if (!reg.parent_accounts) return;
      
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="
          position: relative;
          cursor: pointer;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));
        ">
          <!-- 3D Pin Body -->
          <div style="
            width: 36px;
            height: 44px;
            background: linear-gradient(135deg, #FF6B6B 0%, #EE5A5A 50%, #D94848 100%);
            border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: inset 0 -4px 8px rgba(0,0,0,0.2), inset 0 4px 8px rgba(255,255,255,0.3);
          ">
            <!-- Face Icon -->
            <div style="
              width: 24px;
              height: 24px;
              background: white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-top: -4px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            ">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D94848" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="9" cy="10" r="1" fill="#D94848"></circle>
                <circle cx="15" cy="10" r="1" fill="#D94848"></circle>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
              </svg>
            </div>
          </div>
          <!-- Pin Point -->
          <div style="
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-top: 12px solid #D94848;
            margin: -2px auto 0;
            filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2));
          "></div>
          <!-- Shadow -->
          <div style="
            width: 20px;
            height: 6px;
            background: rgba(0,0,0,0.2);
            border-radius: 50%;
            margin: 2px auto 0;
            filter: blur(2px);
          "></div>
        </div>
      `;

      const marker = new mapboxgl.Marker(el)
        .setLngLat([reg.parent_accounts.pickup_longitude, reg.parent_accounts.pickup_latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="min-width: 150px;">
              <strong>${reg.student_name || 'Student'}</strong><br/>
              <span style="color: #666;">Parent: ${reg.parent_accounts.parent_name}</span><br/>
              <span style="color: #666;">School: ${reg.schools?.name || 'N/A'}</span>
            </div>
          `)
        )
        .addTo(map.current!);

      markersRef.current.push(marker);
    });

    // Fit bounds if we have markers
    if (filteredRegistrations.length > 0 || selectedSchool) {
      const bounds = new mapboxgl.LngLatBounds();
      
      if (selectedSchool) {
        const school = schools.find((s) => s.id === selectedSchool);
        if (school) bounds.extend([school.longitude, school.latitude]);
      }
      
      filteredRegistrations.forEach((reg) => {
        if (reg.parent_accounts) {
          bounds.extend([reg.parent_accounts.pickup_longitude, reg.parent_accounts.pickup_latitude]);
        }
      });

      if (!bounds.isEmpty()) {
        map.current.fitBounds(bounds, { padding: 50, maxZoom: 14 });
      }
    }
  }, [filteredRegistrations, selectedSchool, schools]);

  const handleSchoolClick = (schoolId: string) => {
    setShowAllStudents(false);
    setSelectedSchool(schoolId === selectedSchool ? null : schoolId);
  };

  const handleShowAll = () => {
    setSelectedSchool(null);
    setShowAllStudents(true);
  };

  if (tokenLoading) {
    return (
      <div className="h-[500px] flex items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  if (!mapboxToken) {
    return (
      <div className="h-[500px] flex items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">Mapbox token not configured</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[500px]">
      {/* Schools Sidebar */}
      <div className="w-64 border border-border rounded-lg bg-card flex flex-col">
        <div className="p-3 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2">
            <School className="h-4 w-4" />
            Schools
          </h3>
        </div>
        <div className="p-2 border-b border-border">
          <Button
            variant={showAllStudents ? 'default' : 'outline'}
            size="sm"
            className="w-full"
            onClick={handleShowAll}
          >
            <Users className="h-4 w-4 mr-2" />
            Show All Students ({registrations.length})
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {schools.map((school) => {
              const count = registrations.filter((r) => r.school_id === school.id).length;
              return (
                <Button
                  key={school.id}
                  variant={selectedSchool === school.id ? 'default' : 'ghost'}
                  size="sm"
                  className="w-full justify-start text-left h-auto py-2"
                  onClick={() => handleSchoolClick(school.id)}
                >
                  <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{school.name}</div>
                    <div className="text-xs text-muted-foreground">{count} students</div>
                  </div>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="w-full h-full rounded-lg border border-border" />
        {(selectedSchool || showAllStudents) && (
          <div className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-md border border-border text-sm">
            {showAllStudents 
              ? `Showing all ${filteredRegistrations.length} students`
              : `${filteredRegistrations.length} students for ${schools.find(s => s.id === selectedSchool)?.name}`
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default RegistrationsMap;
