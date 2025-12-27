import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

type City = 'all' | 'cairo' | 'giza' | 'alexandria';

interface CityContextType {
  selectedCity: City;
  setSelectedCity: (city: City) => void;
  cityLabels: Record<City, { en: string; ar: string }>;
}

const CityContext = createContext<CityContextType | undefined>(undefined);

const cityLabels: Record<City, { en: string; ar: string }> = {
  all: { en: 'All Cities', ar: 'كل المدن' },
  cairo: { en: 'Cairo', ar: 'القاهرة' },
  giza: { en: 'Giza', ar: 'الجيزة' },
  alexandria: { en: 'Alexandria', ar: 'الإسكندرية' },
};

export const CityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedCity, setSelectedCity] = useState<City>(() => {
    const stored = localStorage.getItem('selectedCity');
    return (stored as City) || 'all';
  });

  useEffect(() => {
    localStorage.setItem('selectedCity', selectedCity);
  }, [selectedCity]);

  return (
    <CityContext.Provider value={{ selectedCity, setSelectedCity, cityLabels }}>
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
