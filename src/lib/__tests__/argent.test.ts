/**
 * Conversions de montants — le seul endroit du code où l'argent change de
 * forme, et donc le seul où il peut se perdre.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  decimalesDevise,
  enUniteMineure,
  formaterMontant,
  formaterMontantNu,
  versChampSaisie,
} from '../argent.ts';

const sansEspacesFines = (valeur: string) => valeur.replace(/[  ]/g, ' ');

describe('décimales par devise', () => {
  it("ne suppose aucune devise : Intl répond", () => {
    assert.equal(decimalesDevise('EUR'), 2);
    assert.equal(decimalesDevise('XOF'), 0, 'le franc CFA n\'a pas de subdivision courante');
    assert.equal(decimalesDevise('TND'), 3, 'le dinar tunisien en a trois');
  });

  it('retombe sur deux décimales pour un code inconnu', () => {
    assert.equal(decimalesDevise('ZZZ'), 2);
  });
});

describe('saisie vers unité mineure', () => {
  it('convertit sur les chiffres, pas sur un flottant', () => {
    assert.equal(enUniteMineure('1234,56', 'EUR'), 123456);
    assert.equal(enUniteMineure('1 234,56', 'EUR'), 123456);
    assert.equal(enUniteMineure('1234.56', 'EUR'), 123456);
    assert.equal(enUniteMineure('0,01', 'EUR'), 1);
  });

  it("ne multiplie pas une devise sans décimale", () => {
    assert.equal(enUniteMineure('25000', 'XOF'), 25000);
  });

  it('refuse une saisie plus précise que la devise plutôt que de la tronquer', () => {
    // Arrondir en silence, c'est perdre de l'argent sans le dire.
    assert.equal(enUniteMineure('1234,567', 'EUR'), null);
  });

  it("ne rend jamais zéro pour une saisie illisible", () => {
    assert.equal(enUniteMineure('abc', 'EUR'), null);
    assert.equal(enUniteMineure('', 'EUR'), null);
    assert.equal(enUniteMineure('  ', 'EUR'), null);
  });

  it('distingue le zéro saisi de l\'absence de saisie', () => {
    assert.equal(enUniteMineure('0', 'EUR'), 0);
    assert.equal(enUniteMineure('0,00', 'EUR'), 0);
    assert.equal(enUniteMineure('', 'EUR'), null);
  });

  it("c'est bien la voie flottante qui échoue, pas celle-ci", () => {
    // Trois montants ordinaires qu'une multiplication en virgule flottante
    // rend faux. C'est la raison d'être de ce module.
    for (const [texte, attendu] of [
      ['19,99', 1999],
      ['1,10', 110],
      ['8,20', 820],
    ] as const) {
      const parFlottant = parseFloat(texte.replace(',', '.')) * 100;
      assert.notEqual(parFlottant, attendu, `${texte} : le flottant devrait dériver`);
      assert.equal(enUniteMineure(texte, 'EUR'), attendu, `${texte} : la conversion exacte`);
    }
  });
});

describe('unité mineure vers affichage', () => {
  it('rend le montant dans sa devise', () => {
    assert.equal(sansEspacesFines(formaterMontant(123456, 'EUR')), '1 234,56 €');
  });

  it("n'invente pas de décimale en franc CFA", () => {
    assert.ok(!formaterMontant(25000, 'XOF').includes(','));
  });

  it("n'affiche jamais un montant absent comme un zéro", () => {
    assert.equal(formaterMontant(null, 'EUR'), '—');
    assert.ok(formaterMontant(0, 'EUR').includes('0,00'));
  });

  it('sait aussi rendre le montant nu', () => {
    assert.equal(sansEspacesFines(formaterMontantNu(123456, 'EUR')), '1 234,56');
  });
});

describe('aller-retour', () => {
  it('ne dérive sur aucun montant', () => {
    let derives = 0;
    for (let mineur = 0; mineur < 500000; mineur += 7) {
      if (enUniteMineure(versChampSaisie(mineur, 'EUR'), 'EUR') !== mineur) derives += 1;
    }
    assert.equal(derives, 0);
  });

  it('vaut aussi pour une devise sans décimale', () => {
    let derives = 0;
    for (let mineur = 0; mineur < 200000; mineur += 13) {
      if (enUniteMineure(versChampSaisie(mineur, 'XOF'), 'XOF') !== mineur) derives += 1;
    }
    assert.equal(derives, 0);
  });
});
