import { Etiquette } from '@/components/ui/etiquette';
import type { EnrollmentStatus } from '@/lib/types/database';

/**
 * Libellés et tons des huit statuts d'inscription.
 *
 * Le ton distingue la scolarité en cours (vert), les situations d'attente ou
 * d'interruption (ambre), les sorties non abouties (rouge) et les fins
 * normales (neutre). Un diplômé n'est pas une alerte.
 */
const STATUTS: Record<EnrollmentStatus, { libelle: string; ton: 'neutre' | 'primaire' | 'succes' | 'alerte' | 'danger' }> = {
  PREREGISTERED: { libelle: 'Préinscrit', ton: 'alerte' },
  ENROLLED: { libelle: 'Inscrit', ton: 'primaire' },
  ACTIVE: { libelle: 'Actif', ton: 'succes' },
  SUSPENDED: { libelle: 'Suspendu', ton: 'alerte' },
  TRANSFERRED: { libelle: 'Transféré', ton: 'neutre' },
  GRADUATED: { libelle: 'Diplômé', ton: 'neutre' },
  DROPPED_OUT: { libelle: 'Abandon', ton: 'danger' },
  ARCHIVED: { libelle: 'Archivé', ton: 'neutre' },
};

export const STATUTS_INSCRIPTION_ORDONNES: EnrollmentStatus[] = [
  'PREREGISTERED',
  'ENROLLED',
  'ACTIVE',
  'SUSPENDED',
  'TRANSFERRED',
  'GRADUATED',
  'DROPPED_OUT',
  'ARCHIVED',
];

export function libelleStatut(statut: EnrollmentStatus): string {
  return STATUTS[statut].libelle;
}

export function StatutInscription({ statut }: { statut: EnrollmentStatus }) {
  const { libelle, ton } = STATUTS[statut];
  return <Etiquette ton={ton}>{libelle}</Etiquette>;
}
