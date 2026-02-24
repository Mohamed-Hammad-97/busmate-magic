import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type City = 'all' | 'cairo' | 'giza' | 'alexandria';

interface CityContextType {
  selectedCity: City;
  setSelectedCity: (city: City) => void;
  cityLabels: Record<City, { en: string; ar: string }>;
  effectiveCity: City;
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

  // Determine if employee is city-locked
  const employeeCity = employee?.city
    ? employeeCityToFilterCity[employee.city.toLowerCase()] || null
    : null;
  const isCityLocked = !isSuperAdmin && !!employeeCity;

  const [selectedCity, setSelectedCity] = useState<City>(() => {
    if (isCityLocked && employeeCity) return employeeCity;
    const stored = localStorage.getItem('selectedCity');
    return (stored as City) || 'all';
  });

  // When employee data loads & they're city-locked, force their city
  useEffect(() => {
    if (isCityLocked && employeeCity) {
      setSelectedCity(employeeCity);
    }
  }, [isCityLocked, employeeCity]);

  useEffect(() => {
    localStorage.setItem('selectedCity', selectedCity);
  }, [selectedCity]);

  // effectiveCity: for city-locked employees, always their city
  const effectiveCity = isCityLocked && employeeCity ? employeeCity : selectedCity;

  const handleSetCity = (city: City) => {
    if (isCityLocked) return; // Prevent changing if locked
    setSelectedCity(city);
  };

  return (
    <CityContext.Provider value={{ selectedCity: effectiveCity, setSelectedCity: handleSetCity, cityLabels, effectiveCity }}>
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
