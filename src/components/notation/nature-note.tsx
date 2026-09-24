import { Etiquette } from '@/components/ui/etiquette';
import type { GradeKind, GradeStatus } from '@/lib/types/database';

/**
 * Les six natures d'une note, et les sept états de son cycle de vie.
 *
 * L'affichage ne les confond jamais : un zéro réel se lit « 0 », une absence
 * se lit « Absent », et une ligne non saisie se lit « Non saisie ». Trois
 * choses différentes, trois rendus différents (@CLAUDE.md, règle 4).
 */

const NATURES: Record<GradeKind, { libelle: string; ton: 'neutre' | 'primaire' | 'succes' | 'alerte' | 'danger' }> = {
  SCORE: { libelle: 'Note', ton: 'primaire' },
  ABSENT: { libelle: 'Absent', ton: 'danger' },
  EXCUSED: { libelle: 'Absence justifiée', ton: 'alerte' },
  EXEMPT: { libelle: 'Dispensé', ton: 'neutre' },
  NOT_APPLICABLE: { libelle: 'Sans objet', ton: 'neutre' },
  PENDING: { libelle: 'Non saisie', ton: 'neutre' },
};

const ETATS: Record<GradeStatus, { libelle: string; ton: 'neutre' | 'primaire' | 'succes' | 'alerte' | 'danger' }> = {
  DRAFT: { libelle: 'Brouillon', ton: 'neutre' },
  CAPTURED: { libelle: 'Saisie', ton: 'primaire' },
  VERIFIED: { libelle: 'Vérifiée', ton: 'alerte' },
  PUBLISHED: { libelle: 'Publiée', ton: 'succes' },
  CORRECTED: { libelle: 'Corrigée', ton: 'alerte' },
  CANCELLED: { libelle: 'Invalidée', ton: 'danger' },
  ARCHIVED: { libelle: 'Archivée', ton: 'neutre' },
};

export const NATURES_SAISISSABLES: GradeKind[] = [
  'SCORE',
  'ABSENT',
  'EXCUSED',
  'EXEMPT',
  'NOT_APPLICABLE',
  'PENDING',
];

export function libelleNature(nature: GradeKind): string {
  return NATURES[nature].libelle;
}

export function libelleEtat(etat: GradeStatus): string {
  return ETATS[etat].libelle;
}

export function NatureNote({ nature }: { nature: GradeKind }) {
  const { libelle, ton } = NATURES[nature];
  return <Etiquette ton={ton}>{libelle}</Etiquette>;
}

export function EtatNote({ etat }: { etat: GradeStatus }) {
  const { libelle, ton } = ETATS[etat];
  return <Etiquette ton={ton}>{libelle}</Etiquette>;
}

/**
 * Rendu d'une valeur de note.
 *
 * Le point essentiel : une note absente ne s'affiche JAMAIS comme un zéro.
 * `0` et `—` sont deux rendus distincts, et c'est voulu.
 */
export function ValeurNote({
  nature,
  valeur,
  decimales = 2,
}: {
  nature: GradeKind;
  valeur: number | null;
  decimales?: number;
}) {
  if (nature !== 'SCORE' || valeur === null) {
    return (
      <span className="text-encre-douce" aria-label={libelleNature(nature)}>
        —
      </span>
    );
  }
  return <span className="font-semibold tabular-nums text-encre">{valeur.toFixed(decimales)}</span>;
}
