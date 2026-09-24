import { clientServeur } from '@/lib/supabase/server';
import type {
  Classe,
  FeeInstallment,
  FeeObligation,
  FeeStructure,
  Learner,
  Level,
  Payment,
  Receipt,
} from '@/lib/types/database';

/**
 * Devise de fonctionnement de l'établissement.
 *
 * Réglage d'établissement, avec repli sur celui de l'organisation. Aucune
 * conversion nulle part : une conversion non contrôlée dans une comptabilité
 * est une erreur, pas une commodité.
 */
export async function deviseEtablissement(
  etablissementId: string,
  deviseOrganisation: string,
): Promise<string> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from('establishment_settings')
    .select('value')
    .eq('establishment_id', etablissementId)
    .eq('key', 'finance.currency')
    .maybeSingle();

  const valeur = data?.value;
  return typeof valeur === 'string' && /^[A-Z]{3}$/.test(valeur) ? valeur : deviseOrganisation;
}

export interface FraisDetaille extends FeeStructure {
  niveau: Pick<Level, 'id' | 'name'> | null;
  echeances: FeeInstallment[];
  ecart: number;
}

export async function listerFrais(anneeId: string): Promise<FraisDetaille[]> {
  const supabase = await clientServeur();

  const { data, error } = await supabase
    .from('fee_structures')
    .select('*, niveau:levels(id, name)')
    .eq('academic_year_id', anneeId)
    .order('name');

  if (error) throw error;
  const frais = (data ?? []) as unknown as (FeeStructure & {
    niveau: Pick<Level, 'id' | 'name'> | null;
  })[];

  const identifiants = frais.map((f) => f.id);
  const parFrais = new Map<string, FeeInstallment[]>();

  if (identifiants.length > 0) {
    const { data: echeances } = await supabase
      .from('fee_installments')
      .select('*')
      .in('fee_structure_id', identifiants)
      .order('position');

    for (const echeance of echeances ?? []) {
      const liste = parFrais.get(echeance.fee_structure_id) ?? [];
      liste.push(echeance);
      parFrais.set(echeance.fee_structure_id, liste);
    }
  }

  return frais.map((f) => {
    const echeances = parFrais.get(f.id) ?? [];
    // L'écart se recalcule ici plutôt que par un aller-retour SQL par frais :
    // la somme d'entiers est exacte en JavaScript tant qu'elle reste sûre.
    const somme = echeances.reduce((total, e) => total + e.share_minor, 0);
    return { ...f, echeances, ecart: echeances.length === 0 ? 0 : somme - f.amount_minor };
  });
}

export interface CreanceDetaillee extends FeeObligation {
  frais: Pick<FeeStructure, 'id' | 'name' | 'kind'> | null;
}

export async function creancesDeLInscription(inscriptionId: string): Promise<CreanceDetaillee[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('fee_obligations')
    .select('*, frais:fee_structures(id, name, kind)')
    .eq('enrollment_id', inscriptionId)
    .order('due_on');

  if (error) throw error;
  return (data ?? []) as unknown as CreanceDetaillee[];
}

export interface PaiementDetaille extends Payment {
  recu: Pick<Receipt, 'id' | 'number' | 'voided_at' | 'void_reason'> | null;
}

export async function paiementsDeLInscription(inscriptionId: string): Promise<PaiementDetaille[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('payments')
    .select('*, recu:receipts(id, number, voided_at, void_reason)')
    .eq('enrollment_id', inscriptionId)
    .order('paid_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PaiementDetaille[];
}

export interface SituationFinanciere {
  devise: string;
  du: number;
  regle: number;
  solde: number;
  creances: number;
  enRetard: number;
}

/**
 * Situation financière d'une inscription.
 *
 * Le calcul se fait en SQL, sur des entiers : le solde ne se stocke nulle part
 * et ne se recalcule pas côté navigateur. Une ligne par devise — s'il y en a
 * plusieurs, c'est un signal, pas une moyenne à faire.
 */
export async function situationFinanciere(inscriptionId: string): Promise<SituationFinanciere[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase.rpc('situation_financiere', {
    p_enrollment_id: inscriptionId,
  });

  if (error) throw error;

  return (data ?? []).map((ligne) => ({
    devise: ligne.devise,
    du: ligne.du_minor,
    regle: ligne.regle_minor,
    solde: ligne.solde_minor,
    creances: ligne.creances,
    enRetard: ligne.en_retard,
  }));
}

export interface RecuDetaille extends Receipt {
  paiement:
    | (Pick<
        Payment,
        'id' | 'amount_minor' | 'currency' | 'method_label' | 'reference' | 'paid_on' | 'notes'
      > & {
        inscription: {
          id: string;
          apprenant: Pick<Learner, 'id' | 'given_name' | 'family_name' | 'learner_code'>;
          classe: Pick<Classe, 'id' | 'name'> | null;
        } | null;
      })
    | null;
}

export async function recu(recuId: string): Promise<RecuDetaille | null> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from('receipts')
    .select(
      '*, paiement:payments(id, amount_minor, currency, method_label, reference, paid_on, notes,' +
        ' inscription:enrollments(id, apprenant:learners(id, given_name, family_name, learner_code),' +
        ' classe:classes(id, name)))',
    )
    .eq('id', recuId)
    .maybeSingle();

  return (data as unknown as RecuDetaille) ?? null;
}

/** Ce qu'un reçu a réglé, créance par créance. */
export async function affectationsDuRecu(
  paiementId: string,
): Promise<{ amount_minor: number; label: string }[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('payment_allocations')
    .select('amount_minor, creance:fee_obligations(label)')
    .eq('payment_id', paiementId);

  if (error) throw error;

  type Ligne = { amount_minor: number; creance: { label: string } | null };
  return ((data ?? []) as unknown as Ligne[]).map((ligne) => ({
    amount_minor: ligne.amount_minor,
    label: ligne.creance?.label ?? 'Créance supprimée',
  }));
}

export interface SoldeApprenant {
  inscriptionId: string;
  apprenant: Pick<Learner, 'id' | 'given_name' | 'family_name' | 'learner_code'>;
  devise: string;
  du: number;
  regle: number;
  solde: number;
  enRetard: number;
}

/**
 * Soldes d'une classe entière.
 *
 * Une seule lecture des créances, agrégée ici : appeler `situation_financiere`
 * par apprenant ferait autant d'allers-retours que d'inscrits.
 */
export async function soldesDeLaClasse(classeId: string): Promise<SoldeApprenant[]> {
  const supabase = await clientServeur();

  const { data: inscriptions, error } = await supabase
    .from('enrollments')
    .select('id, apprenant:learners(id, given_name, family_name, learner_code)')
    .eq('class_id', classeId)
    .in('status', ['PREREGISTERED', 'ENROLLED', 'ACTIVE', 'SUSPENDED']);

  if (error) throw error;

  type LigneInscription = {
    id: string;
    apprenant: Pick<Learner, 'id' | 'given_name' | 'family_name' | 'learner_code'>;
  };
  const lignes = (inscriptions ?? []) as unknown as LigneInscription[];
  if (lignes.length === 0) return [];

  const { data: creances } = await supabase
    .from('fee_obligations')
    .select('enrollment_id, currency, total_minor, paid_minor, due_on')
    .in(
      'enrollment_id',
      lignes.map((l) => l.id),
    )
    .is('cancelled_at', null);

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const parInscription = new Map<string, SoldeApprenant>();

  for (const ligne of lignes) {
    parInscription.set(ligne.id, {
      inscriptionId: ligne.id,
      apprenant: ligne.apprenant,
      devise: '',
      du: 0,
      regle: 0,
      solde: 0,
      enRetard: 0,
    });
  }

  for (const creance of creances ?? []) {
    const solde = parInscription.get(creance.enrollment_id);
    if (!solde) continue;

    // `total_minor` est une colonne générée : le générateur de types la déclare
    // nullable, alors que son expression ne peut pas produire de nul — ses trois
    // termes sont NOT NULL. Le repli ne masque donc aucun cas réel.
    const total = creance.total_minor ?? 0;

    solde.devise = creance.currency;
    solde.du += total;
    solde.regle += creance.paid_minor;
    solde.solde += total - creance.paid_minor;
    if (creance.due_on < aujourdhui && total > creance.paid_minor) {
      solde.enRetard += 1;
    }
  }

  return [...parInscription.values()].sort((a, b) =>
    `${a.apprenant.family_name} ${a.apprenant.given_name}`.localeCompare(
      `${b.apprenant.family_name} ${b.apprenant.given_name}`,
      'fr',
    ),
  );
}
