import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatPill {
  icon: LucideIcon;
  value: string | number;
  label: string;
}

interface PageHeroProps {
  icon: LucideIcon;
  title: string;
  description: string;
  stats?: StatPill[];
  actions?: React.ReactNode;
}

export const PageHero: React.FC<PageHeroProps> = ({ icon: Icon, title, description, stats, actions }) => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-primary/70 p-8 text-primary-foreground">
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3 blur-2xl" />
      <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              <p className="text-primary-foreground/70">{description}</p>
            </div>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>

      {stats && stats.length > 0 && (
        <div className="relative z-10 flex flex-wrap gap-3 mt-6">
          {stats.map((stat, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 text-sm">
              <stat.icon className="h-4 w-4" />
              <span className="font-semibold">{stat.value}</span>
              <span className="text-primary-foreground/70">{stat.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
