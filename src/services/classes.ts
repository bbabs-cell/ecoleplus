import { clientServeur } from '@/lib/supabase/server';
import type { Classe, Level, Subject, Teacher, TeachingAssignment } from '@/lib/types/database';

export interface ClasseDetaillee extends Classe {
  niveau: Pick<Level, 'id' | 'name' | 'position'> | null;
  enseignantPrincipal: Pick<Teacher, 'id' | 'given_name' | 'family_name'> | null;
  effectif: number;
}

/**
 * Classes d'une année, avec leur effectif réel.
 *
 * L'effectif est compté à partir des inscriptions vivantes : une inscription
 * transférée ou archivée n'occupe plus de place, exactement comme le calcule
 * la vérification de capacité côté base.
 */
export async function listerClasses(anneeId: string): Promise<ClasseDetaillee[]> {
  const supabase = await clientServeur();

  const [classesRes, inscriptionsRes] = await Promise.all([
    supabase
      .from('classes')
      .select('*, niveau:levels(id, name, position), enseignantPrincipal:teachers(id, given_name, family_name)')
      .eq('academic_year_id', anneeId)
      .order('name'),
    supabase
      .from('enrollments')
      .select('class_id')
      .eq('academic_year_id', anneeId)
      .in('status', ['PREREGISTERED', 'ENROLLED', 'ACTIVE', 'SUSPENDED']),
  ]);

  if (classesRes.error) throw classesRes.error;

  const effectifs = new Map<string, number>();
  for (const ligne of inscriptionsRes.data ?? []) {
    if (ligne.class_id) {
      effectifs.set(ligne.class_id, (effectifs.get(ligne.class_id) ?? 0) + 1);
    }
  }

  type LigneBrute = Classe & {
    niveau: Pick<Level, 'id' | 'name' | 'position'> | null;
    enseignantPrincipal: Pick<Teacher, 'id' | 'given_name' | 'family_name'> | null;
  };

  return ((classesRes.data ?? []) as unknown as LigneBrute[]).map((ligne) => ({
    ...ligne,
    effectif: effectifs.get(ligne.id) ?? 0,
  }));
}

export interface AffectationDetaillee extends TeachingAssignment {
  matiere: Pick<Subject, 'id' | 'name' | 'code'> | null;
  enseignant: Pick<Teacher, 'id' | 'given_name' | 'family_name'> | null;
}

export async function listerAffectations(anneeId: string): Promise<AffectationDetaillee[]> {
  const supabase = await clientServeur();

  const { data: classes } = await supabase
    .from('classes')
    .select('id')
    .eq('academic_year_id', anneeId);

  const identifiants = (classes ?? []).map((classe) => classe.id);
  if (identifiants.length === 0) return [];

  const { data, error } = await supabase
    .from('teaching_assignments')
    .select('*, matiere:subjects(id, name, code), enseignant:teachers(id, given_name, family_name)')
    .in('class_id', identifiants);

  if (error) throw error;
  return (data ?? []) as unknown as AffectationDetaillee[];
}
