import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCity } from '@/contexts/CityContext';

export const CitySelector: React.FC = () => {
  const { i18n } = useTranslation();
  const { selectedCity, setSelectedCity, cityLabels } = useCity();
  const isRtl = i18n.language === 'ar';

  const cities = ['all', 'cairo', 'giza', 'alexandria'] as const;

  return (
    <div className="flex items-center gap-2">
      <MapPin className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedCity} onValueChange={(value) => setSelectedCity(value as any)}>
        <SelectTrigger className="w-[140px] h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-background border border-border z-50">
          {cities.map((city) => (
            <SelectItem key={city} value={city}>
              {isRtl ? cityLabels[city].ar : cityLabels[city].en}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
