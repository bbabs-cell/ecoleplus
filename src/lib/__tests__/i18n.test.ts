/**
 * Internationalisation — le repli est la propriété qui compte.
 *
 * La clé de traduction étant la chaîne française exacte, une chaîne non
 * traduite s'affiche en français plutôt qu'en identifiant technique. Ce test
 * vérifie cette propriété plutôt que la couverture : un dictionnaire incomplet
 * n'est pas un défaut, c'est l'état normal d'un projet qui se traduit écran
 * par écran.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tailleDictionnaire, traduire } from '../../i18n/dictionnaires.ts';
import {
  LOCALES,
  direction,
  estLocaleConnue,
  normaliserLocale,
} from '../../i18n/locales.ts';

describe('repli sur la clé', () => {
  it("rend la chaîne française telle quelle quand la traduction manque", () => {
    const inedit = 'Une phrase que personne n’a encore traduite';
    for (const locale of LOCALES) {
      assert.equal(traduire(inedit, locale), inedit);
    }
  });

  it('traduit ce qui est traduit', () => {
    assert.equal(traduire('Apprenants', 'en'), 'Learners');
    assert.equal(traduire('Apprenants', 'es'), 'Alumnado');
    assert.equal(traduire('Apprenants', 'ar'), 'المتعلّمون');
  });

  it('laisse le français intact — la clé EST le français', () => {
    assert.equal(traduire('Apprenants', 'fr'), 'Apprenants');
    assert.equal(tailleDictionnaire('fr'), 0);
  });

  it("ne rend jamais une chaîne vide", () => {
    for (const locale of LOCALES) {
      for (const chaine of ['Note', 'Absent', 'Non saisie', 'Solde', 'Inconnu']) {
        assert.ok(traduire(chaine, locale).length > 0, `${chaine} en ${locale}`);
      }
    }
  });
});

describe('direction d’écriture', () => {
  it('se déduit de la langue, jamais du pays', () => {
    assert.equal(direction('fr'), 'ltr');
    assert.equal(direction('en'), 'ltr');
    assert.equal(direction('es'), 'ltr');
    assert.equal(direction('ar'), 'rtl');
    // Une variante régionale garde la direction de sa langue.
    assert.equal(direction('ar-MA'), 'rtl');
    assert.equal(direction('fr-CA'), 'ltr');
  });

  it('traite les autres écritures de droite à gauche', () => {
    assert.equal(direction('he'), 'rtl');
    assert.equal(direction('fa'), 'rtl');
    assert.equal(direction('ur'), 'rtl');
  });
});

describe('normalisation', () => {
  it('ramène une variante à sa langue de base quand elle est gérée', () => {
    assert.equal(normaliserLocale('fr-CA'), 'fr');
    assert.equal(normaliserLocale('ar-MA'), 'ar');
    assert.equal(normaliserLocale('en-GB'), 'en');
  });

  it('retombe sur le français pour une langue inconnue', () => {
    assert.equal(normaliserLocale('de'), 'fr');
    assert.equal(normaliserLocale(''), 'fr');
    assert.equal(normaliserLocale(null), 'fr');
    assert.equal(normaliserLocale(undefined), 'fr');
  });

  it("ne laisse pas passer une valeur arbitraire — le cookie vient du navigateur", () => {
    assert.equal(estLocaleConnue('../../etc/passwd'), false);
    assert.equal(normaliserLocale('<script>'), 'fr');
  });
});

describe('cohérence des dictionnaires', () => {
  it("traduit les neuf états d'une note dans chaque langue", () => {
    // Ce vocabulaire porte la règle 4 : le confondre serait pire que de ne pas
    // le traduire du tout.
    const etats = [
      'Note',
      'Absent',
      'Absence justifiée',
      'Dispensé',
      'Sans objet',
      'Non saisie',
      'Invalidée',
    ];
    for (const locale of ['en', 'es', 'ar'] as const) {
      const rendus = etats.map((etat) => traduire(etat, locale));
      assert.equal(
        new Set(rendus).size,
        etats.length,
        `${locale} : deux états rendus identiques — ${rendus.join(', ')}`,
      );
    }
  });
});
