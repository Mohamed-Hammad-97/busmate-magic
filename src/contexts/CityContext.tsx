import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type City = 'all' | 'cairo' | 'giza' | 'alexandria';

interface CityContextType {
  selectedCity: City;
  setSelectedCity: (city: City) => void;
  cityLabels: Record<City, { en: string; ar: string }>;
  effectiveCity: City;
  allowedCities: City[]; // empty = all cities allowed
}

const CityContext = createContext<CityContextType | undefined>(undefined);

const cityLabels: Record<City, { en: string; ar: string }> = {
  all: { en: 'All Cities', ar: 'كل المدن' },
  cairo: { en: 'Cairo', ar: 'القاهرة' },
  giza: { en: 'Giza', ar: 'الجيزة' },
  alexandria: { en: 'Alexandria', ar: 'الإسكندرية' },
};

const employeeCityToFilterCity: Record<string, City> = {
  cairo: 'cairo',
  'القاهرة': 'cairo',
  giza: 'giza',
  'الجيزة': 'giza',
  alexandria: 'alexandria',
  'الإسكندرية': 'alexandria',
};

export const CityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { employee, isSuperAdmin } = useAuth();

  // Cities the employee is assigned to (supports multiple)
  const rawCities: string[] = employee
    ? ((employee.cities && employee.cities.length ? employee.cities : (employee.city ? [employee.city] : [])) as string[])
    : [];
  const assignedCities = rawCities
    .map((c) => employeeCityToFilterCity[c.toLowerCase()] || null)
    .filter((c): c is City => !!c);

  const isCityLocked = !isSuperAdmin && assignedCities.length > 0;
  const allowedCities = isCityLocked ? assignedCities : [];

  const [selectedCity, setSelectedCity] = useState<City>(() => {
    const stored = localStorage.getItem('selectedCity');
    return (stored as City) || 'all';
  });

  // Keep selection within the employee's allowed cities
  useEffect(() => {
    if (isCityLocked && !assignedCities.includes(selectedCity)) {
      setSelectedCity(assignedCities[0]);
    }
  }, [isCityLocked, assignedCities.join(','), selectedCity]);

  useEffect(() => {
    localStorage.setItem('selectedCity', selectedCity);
  }, [selectedCity]);

  const effectiveCity = isCityLocked && !assignedCities.includes(selectedCity) ? assignedCities[0] : selectedCity;

  const handleSetCity = (city: City) => {
    if (isCityLocked && !assignedCities.includes(city)) return; // can only pick allowed cities
    setSelectedCity(city);
  };

  return (
    <CityContext.Provider value={{ selectedCity: effectiveCity, setSelectedCity: handleSetCity, cityLabels, effectiveCity, allowedCities }}>
      {children}
    </CityContext.Provider>
  );
};


export const useCity = () => {
  const context = useContext(CityContext);
  if (!context) {
    throw new Error('useCity must be used within a CityProvider');
  }
  return context;
};
