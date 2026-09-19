'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { accepterInvitationAction } from '@/services/invitation.actions';
import { ETAT_INITIAL } from '@/services/formulaire';
import { Bouton } from '@/components/ui/bouton';
import { Alerte } from '@/components/ui/alerte';

function BoutonEnvoi() {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" className="w-full" disabled={pending}>
      {pending ? 'Validation…' : "Rejoindre l'organisation"}
    </Bouton>
  );
}

export function FormulaireInvitation({ jeton }: { jeton: string }) {
  const [etat, action] = useActionState(accepterInvitationAction, ETAT_INITIAL);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="jeton" value={jeton} />
      {etat.statut === 'erreur' ? <Alerte ton="danger">{etat.message}</Alerte> : null}
      <BoutonEnvoi />
    </form>
  );
}
