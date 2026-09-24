import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { localeActive } from '@/i18n/serveur';
import { direction } from '@/i18n/locales';
import './globals.css';

export const metadata: Metadata = {
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s · ${brand.name}` },
  description: brand.description,
};

export default async function RacineLayout({ children }: { children: React.ReactNode }) {
  // La langue vient du cookie posé par le proxy depuis le claim `locale`, ou du
  // choix explicite de l'utilisateur. `dir` se déduit de la langue, jamais du
  // pays : `ar-MA` s'écrit de droite à gauche comme `ar`.
  const locale = await localeActive();

  return (
    <html lang={locale} dir={direction(locale)}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
