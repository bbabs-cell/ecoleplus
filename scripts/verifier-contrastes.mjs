/**
 * Vérifie les contrastes de la palette contre WCAG 2.1.
 *
 * Une couleur « qui a l'air bien » n'est pas une couleur lisible. Ce script
 * lit les jetons de `src/app/globals.css` et refuse tout ce qui passe sous le
 * seuil, en clair comme en sombre.
 *
 *   node scripts/verifier-contrastes.mjs
 */
import { readFileSync } from 'node:fs';

const SEUIL_TEXTE = 4.5; // AA, texte normal
const SEUIL_GRAND = 3.0; // AA, texte large et éléments d'interface

const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

/** Extrait le bloc `:root` clair, puis celui du mode sombre. */
function jetons(source, sombre) {
  const bloc = sombre
    ? source.slice(source.indexOf('prefers-color-scheme: dark'))
    : source.slice(source.indexOf(':root {'), source.indexOf('@media'));
  const table = {};
  for (const [, nom, valeur] of bloc.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) {
    table[nom] = valeur;
  }
  return table;
}

const canal = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

function luminance(hex) {
  const [r, v, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * canal(r) + 0.7152 * canal(v) + 0.0722 * canal(b);
}

function contraste(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const DOMAINES = ['socle', 'academique', 'personnes', 'presences', 'notation', 'finances', 'admin'];
const echecs = [];

for (const sombre of [false, true]) {
  const t = jetons(css, sombre);
  const mode = sombre ? 'sombre' : 'clair';

  const verifier = (avant, arriere, seuil, quoi) => {
    if (!t[avant] || !t[arriere]) return echecs.push(`${mode} : jeton absent (${avant} / ${arriere})`);
    const r = contraste(t[avant], t[arriere]);
    const ligne = `${mode.padEnd(7)} ${quoi.padEnd(42)} ${r.toFixed(2)}:1`;
    if (r < seuil) echecs.push(`ÉCHEC   ${ligne} — seuil ${seuil}`);
    else console.log(`  ok    ${ligne}`);
  };

  // Le texte courant, partout où il se pose.
  verifier('--encre', '--surface', SEUIL_TEXTE, 'encre sur fond');
  verifier('--encre', '--carte', SEUIL_TEXTE, 'encre sur carte');
  verifier('--encre-douce', '--carte', SEUIL_TEXTE, 'encre douce sur carte');
  verifier('--encre-douce', '--surface', SEUIL_TEXTE, 'encre douce sur fond');
  verifier('--primaire-contraste', '--primaire', SEUIL_TEXTE, 'texte de bouton sur primaire');

  // Chaque teinte de domaine sur sa propre pastille, et sur la carte.
  for (const d of DOMAINES) {
    verifier(`--t-${d}`, `--t-${d}-douce`, SEUIL_TEXTE, `teinte ${d} sur sa pastille`);
    verifier(`--t-${d}`, '--carte', SEUIL_TEXTE, `teinte ${d} sur carte`);
  }

  // Les tons d'état, qui portent du texte.
  for (const e of ['succes', 'alerte', 'danger', 'accent']) {
    verifier(`--${e}`, `--${e}-douce`, SEUIL_TEXTE, `${e} sur son fond doux`);
  }

  // La bordure doit rester perceptible : c'est elle qui découpe les cartes.
  verifier('--bordure', '--surface', SEUIL_GRAND - 1.5, 'bordure sur fond (perceptible)');
}

if (echecs.length) {
  console.error('\n' + echecs.join('\n'));
  console.error(`\n${echecs.length} contraste(s) insuffisant(s).`);
  process.exit(1);
}
console.log('\nTous les contrastes passent le seuil AA.');
