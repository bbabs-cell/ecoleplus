'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Ban, Printer } from 'lucide-react';
import { annulerRecuAction } from '@/services/finances.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import { Bouton } from '@/components/ui/bouton';
import { Alerte } from '@/components/ui/alerte';
import { Champ, Saisie } from '@/components/ui/champ';

/**
 * Annulation d'un reçu.
 *
 * Il n'existe aucun bouton « supprimer », et ce n'est pas un oubli : un reçu
 * supprimé est une comptabilité falsifiée. L'annulation exige un motif, laisse
 * le document consultable, et rend son montant aux créances qu'il réglait.
 */
export function AnnulerRecu({ recuId }: { recuId: string }) {
  const [etat, action] = useActionState(annulerRecuAction, ETAT_INITIAL);
  const [ouvert, setOuvert] = useState(false);
  const { pending } = useFormStatus();

  if (etat.statut === 'succes') {
    return <Alerte ton="succes">{etat.message}</Alerte>;
  }

  if (!ouvert) {
    return (
      <Bouton variante="secondaire" onClick={() => setOuvert(true)}>
        <Ban className="size-4" aria-hidden="true" />
        Annuler ce reçu
      </Bouton>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="recuId" value={recuId} />
      {etat.statut === 'erreur' ? <Alerte ton="danger">{etat.message}</Alerte> : null}

      <Champ
        label="Motif de l'annulation"
        htmlFor="raison"
        aide="Conservé au journal d'audit. Le reçu reste consultable."
        obligatoire
      >
        <Saisie
          id="raison"
          name="raison"
          required
          placeholder="Encaissement enregistré deux fois"
        />
      </Champ>

      <div className="flex gap-2">
        <Bouton variante="danger" type="submit" disabled={pending}>
          {pending ? 'Annulation…' : "Confirmer l'annulation"}
        </Bouton>
        <Bouton variante="discret" type="button" onClick={() => setOuvert(false)}>
          Renoncer
        </Bouton>
      </div>
    </form>
  );
}

/** Impression du reçu — la remise à la famille passe encore par le papier. */
export function ImprimerRecu() {
  return (
    <Bouton variante="secondaire" onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" aria-hidden="true" />
      Imprimer
    </Bouton>
  );
}
