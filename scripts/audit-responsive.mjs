/**
 * Audit d'affichage — débordement horizontal et cibles tactiles.
 *
 * Les consignes de @docs/design-guidelines.md demandent un « responsive réel,
 * pas juste du desktop réduit ». Une consigne qu'on ne mesure pas n'est pas
 * tenue : ce script charge chaque écran à huit largeurs et rapporte ce qui ne
 * va pas, plutôt que de s'en remettre à un coup d'œil.
 *
 * Il n'est PAS une dépendance du projet : Playwright ne figure pas dans
 * package.json, comme `supabase/tests/concurrence_recus.sh` ne figure pas dans
 * les tests npm. On l'installe quand on veut s'en servir.
 *
 *   npm --prefix /tmp/audit init -y && npm --prefix /tmp/audit i playwright
 *   EP_PLAYWRIGHT=/tmp/audit/node_modules \
 *   EP_EMAIL=… EP_MOTDEPASSE=… node scripts/audit-responsive.mjs
 *
 * `EP_PLAYWRIGHT` désigne le dossier `node_modules` où Playwright est installé.
 * Sans lui, le script le cherche dans celui du projet. `NODE_PATH` ne sert à
 * rien ici : Node l'ignore pour les modules ES.
 *
 * Variables : BASE (défaut http://localhost:3000), EP_EMAIL, EP_MOTDEPASSE,
 * EP_ECRANS, EP_PLAYWRIGHT, CHROMIUM. Le mot de passe n'est jamais écrit ici
 * (@CLAUDE.md, règle 6).
 */
import { pathToFileURL } from 'node:url';

const { chromium } = process.env.EP_PLAYWRIGHT
  ? await import(pathToFileURL(`${process.env.EP_PLAYWRIGHT}/playwright/index.mjs`).href)
  : await import('playwright');

const BASE = process.env.BASE ?? 'http://localhost:3000';
const EMAIL = process.env.EP_EMAIL;
const MOTDEPASSE = process.env.EP_MOTDEPASSE;

if (!EMAIL || !MOTDEPASSE) {
  console.error('Renseignez EP_EMAIL et EP_MOTDEPASSE (un compte de démonstration).');
  process.exit(2);
}

/** Largeurs réelles : petit Android, iPhone, iPhone Max, tablette, portable, bureau. */
const LARGEURS = [320, 360, 390, 430, 768, 1024, 1280, 1920];

/** En dessous, une cible se rate au doigt. C'est la recommandation d'Apple. */
const CIBLE_MINIMALE = 44;

/** Au-delà de cette largeur, le pointeur est précis : la densité reprend. */
const SEUIL_TACTILE = 1024;

const ECRANS = process.env.EP_ECRANS?.split(',') ?? [
  '/tableau-de-bord', '/etablissements', '/annees', '/niveaux', '/matieres',
  '/enseignants', '/classes', '/apprenants', '/presences', '/evaluations',
  '/baremes', '/bulletins', '/finances', '/membres', '/journal', '/organisation',
];

const navigateur = await chromium.launch({
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: ['--no-sandbox'],
});
const page = await (await navigateur.newContext({ viewport: { width: 390, height: 844 } })).newPage();

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' });
await page.fill('#email', EMAIL);
await page.fill('#motDePasse', MOTDEPASSE);
await page.click('button[type="submit"]');
await page.waitForURL('**/tableau-de-bord', { timeout: 60_000 });

const problemes = [];

for (const largeur of LARGEURS) {
  await page.setViewportSize({ width: largeur, height: 900 });

  for (const ecran of ECRANS) {
    await page.goto(`${BASE}${ecran}`, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(250);

    const mesure = await page.evaluate((minimum) => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.opacity !== '0';
      };

      // La cible réelle d'une case à cocher est le rang entier : elle est
      // IMBRIQUÉE dans son `<label>`, et cliquer le texte la bascule.
      //
      // Un `<label for=…>` posé À CÔTÉ du contrôle, lui, n'agrandit rien : les
      // deux boîtes sont disjointes, et viser le libellé ne vise pas le
      // contrôle. Seule l'imbrication compte — c'est la différence que la
      // première version de ce script confondait, tantôt en criant au défaut,
      // tantôt en en masquant un.
      const hauteurCible = (el) => {
        const propre = el.getBoundingClientRect().height;
        const enveloppe = el.closest('label');
        if (!enveloppe || !visible(enveloppe)) return propre;
        return Math.max(propre, enveloppe.getBoundingClientRect().height);
      };

      const petites = [...document.querySelectorAll(
        'a, button, input:not([type=hidden]), select, textarea, [role="button"]',
      )]
        .filter(visible)
        .filter((el) => hauteurCible(el) < minimum)
        .map((el) => `<${el.tagName.toLowerCase()}> ${Math.round(hauteurCible(el))}px « ${(el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 24)} »`);

      const racine = document.documentElement;
      return {
        deborde: racine.scrollWidth > window.innerWidth + 1,
        scrollWidth: racine.scrollWidth,
        petites: [...new Set(petites)],
      };
    }, CIBLE_MINIMALE);

    if (mesure.deborde) {
      problemes.push(
        `DÉBORDEMENT  ${largeur}px ${ecran} — la page mesure ${mesure.scrollWidth}px`,
      );
    }
    if (largeur < SEUIL_TACTILE) {
      for (const petite of mesure.petites) {
        problemes.push(`CIBLE        ${largeur}px ${ecran} — ${petite}`);
      }
    }
  }
}

await navigateur.close();

if (problemes.length === 0) {
  console.log(`Rien à signaler : ${ECRANS.length} écrans × ${LARGEURS.length} largeurs.`);
} else {
  console.log(problemes.join('\n'));
  console.log(`\n${problemes.length} problème(s).`);
}
process.exit(problemes.length === 0 ? 0 : 1);
