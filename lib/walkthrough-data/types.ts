import type { LucideIcon } from 'lucide-react';

export interface WalkthroughStep {
  title: string;
  bullets: string[];
  tryItLink?: { label: string; href: string };
  tip?: string;
}

export interface WalkthroughSection {
  id: string;
  number: number;
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  steps: WalkthroughStep[];
}

export interface WalkthroughData {
  slug: string;
  name: string;
  role: string;
  greeting: string;
  description: string;
  icon: LucideIcon;
  accentColor: string;        // e.g. 'brand-green', 'blue-400'
  accentGradient: string;     // e.g. 'from-brand-green/20 to-emerald-500/20'
  borderColor: string;        // e.g. 'border-brand-green/30'
  sections: WalkthroughSection[];
}
