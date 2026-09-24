import { clientServeur } from '@/lib/supabase/server';
import type { FichierStocke, Learner, Profile } from '@/lib/types/database';

export type Fichier = FichierStocke;

export interface FichierDetaille extends Fichier {
  deposePar: Pick<Profile, 'id' | 'given_name' | 'family_name'> | null;
  apprenant: Pick<Learner, 'id' | 'given_name' | 'family_name'> | null;
}

/**
 * Documents d'une inscription.
 *
 * La RLS filtre déjà : un fichier hors périmètre ne remonte pas, et un fichier
 * supprimé non plus. Aucun filtre supplémentaire n'est donc écrit ici — le
 * masquer en plus côté serveur donnerait l'illusion que c'est l'application
 * qui protège.
 */
export async function fichiersDeLInscription(inscriptionId: string): Promise<FichierDetaille[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('files')
    .select('*, deposePar:profiles!files_uploaded_by_fkey(id, given_name, family_name)')
    .eq('enrollment_id', inscriptionId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as FichierDetaille[];
}

export async function fichiersDeLApprenant(apprenantId: string): Promise<FichierDetaille[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('files')
    .select('*, deposePar:profiles!files_uploaded_by_fkey(id, given_name, family_name)')
    .eq('learner_id', apprenantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as FichierDetaille[];
}

/** Justificatifs attachés à un pointage de présence. */
export async function justificatifsDuPointage(recordId: string): Promise<FichierDetaille[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('files')
    .select('*, deposePar:profiles!files_uploaded_by_fkey(id, given_name, family_name)')
    .eq('attendance_record_id', recordId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as FichierDetaille[];
}
