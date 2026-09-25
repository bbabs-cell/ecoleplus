import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { cheminInterne } from '../navigation.ts';

describe('cheminInterne', () => {
  it('laisse passer un chemin interne', () => {
    assert.equal(cheminInterne('/bulletins/42'), '/bulletins/42');
    assert.equal(cheminInterne('/nouveau-mot-de-passe'), '/nouveau-mot-de-passe');
  });

  it('refuse une URL absolue', () => {
    assert.equal(cheminInterne('https://exemple-malveillant.test/'), '/tableau-de-bord');
    assert.equal(cheminInterne('http://exemple-malveillant.test/'), '/tableau-de-bord');
  });

  // `//hote` est un chemin protocole-relatif : le navigateur y voit un autre
  // domaine, alors que la chaîne commence bien par une barre oblique.
  it('refuse un chemin protocole-relatif', () => {
    assert.equal(cheminInterne('//exemple-malveillant.test/'), '/tableau-de-bord');
  });

  it('refuse la variante à barre inversée, que certains navigateurs normalisent', () => {
    assert.equal(cheminInterne('/\\exemple-malveillant.test/'), '/tableau-de-bord');
  });

  it('refuse ce qui n’est pas une chaîne, ou ne commence pas par une barre', () => {
    assert.equal(cheminInterne(null), '/tableau-de-bord');
    assert.equal(cheminInterne(undefined), '/tableau-de-bord');
    assert.equal(cheminInterne(42), '/tableau-de-bord');
    assert.equal(cheminInterne('tableau-de-bord'), '/tableau-de-bord');
  });

  it('accepte un défaut explicite', () => {
    assert.equal(cheminInterne('https://ailleurs.test', '/connexion'), '/connexion');
  });
});
