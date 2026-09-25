import type { Metadata, Viewport } from 'next';
import { brand } from '@/config/brand';
import { localeActive } from '@/i18n/serveur';
import { direction } from '@/i18n/locales';
import './globals.css';

export const metadata: Metadata = {
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s · ${brand.name}` },
  description: brand.description,
};

/**
 * `viewportFit: 'cover'` fait passer la page sous l'encoche et la barre
 * gestuelle d'iOS ; les marges de sécurité sont reprises là où il le faut par
 * `env(safe-area-inset-*)`. Sans cela, l'application s'affiche entre deux
 * bandes sur iPhone.
 *
 * Le zoom n'est PAS bridé : `maximumScale` reste libre. Empêcher d'agrandir
 * une page est un défaut d'accessibilité, pas un choix de mise en page.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf7f2' },
    { media: '(prefers-color-scheme: dark)', color: '#16140f' },
  ],
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
