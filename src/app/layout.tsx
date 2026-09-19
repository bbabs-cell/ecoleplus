import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import './globals.css';

export const metadata: Metadata = {
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s · ${brand.name}` },
  description: brand.description,
};

export default function RacineLayout({ children }: { children: React.ReactNode }) {
  // `lang` sera piloté par la locale de l'organisation avec l'internationalisation
  // complète (phase 5), qui apportera aussi `dir="rtl"` pour l'arabe.
  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
