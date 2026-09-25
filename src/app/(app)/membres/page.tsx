import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { exigerPermission } from '@/services/permissions';
import {
  listerInvitationsEnAttente,
  listerMembres,
  listerRolesAttribuables,
} from '@/services/membres';
import { formaterDate, initiales, nomAffiche } from '@/lib/format';
import { Carte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';
import { EtatVide } from '@/components/ui/etats';
import { Etiquette } from '@/components/ui/etiquette';
import { Pagination } from '@/components/ui/pagination';
import { ActionsInvitation, ActionsMembre, FormulaireInvitation } from './formulaires';
import { TitrePage } from '@/components/ui/titre-page';

export const metadata: Metadata = { title: 'Membres' };

export default async function PageMembres({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const contexte = await exigerPermission('members.read');
  const { page: pageBrute } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageBrute ?? '1', 10) || 1);

  const peutInviter = contexte.permissions.has('members.invite');
  const peutChangerRole = contexte.permissions.has('members.update_role');
  const peutSuspendre = contexte.permissions.has('members.suspend');

  const [membres, roles, invitations] = await Promise.all([
    listerMembres(page),
    peutChangerRole || peutInviter ? listerRolesAttribuables() : Promise.resolve([]),
    peutInviter ? listerInvitationsEnAttente() : Promise.resolve([]),
  ]);

  const format = contexte.reglages.name_display_format;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-1">
        <TitrePage teinte="admin">Membres</TitrePage>
        <p className="text-sm text-encre-douce">
          Comptes rattachés à l&apos;organisation, leur rôle et leur portée.
        </p>
      </header>

      {peutInviter ? (
        <FormulaireInvitation
          roles={roles}
          etablissements={contexte.etablissements.map(({ id, name }) => ({ id, name }))}
        />
      ) : null}

      {peutInviter && invitations.length > 0 ? (
        <Carte>
          <EnTeteCarte>
            <TitreCarte>Invitations en attente</TitreCarte>
            <SousTitreCarte>
              Une invitation expire automatiquement au bout de 14 jours.
            </SousTitreCarte>
          </EnTeteCarte>
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex flex-wrap items-center gap-3 border-t border-bordure px-5 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-encre">{invitation.email}</p>
                <p className="text-xs text-encre-douce">
                  {invitation.role.label} · expire le{' '}
                  {formaterDate(invitation.expires_at, contexte.reglages)}
                </p>
              </div>
              <ActionsInvitation invitationId={invitation.id} />
            </div>
          ))}
        </Carte>
      ) : null}

      <Carte className="overflow-hidden">
        {membres.lignes.length === 0 ? (
          <EtatVide
            icone={<Users className="size-8" />}
            titre="Aucun membre"
            description="Invitez vos collaborateurs pour qu'ils rejoignent l'organisation."
          />
        ) : (
          <>
            {membres.lignes.map((membre) => {
              const nom = nomAffiche(membre.profil, format);
              const estMoi = membre.profile_id === contexte.utilisateur.id;

              return (
                <div
                  key={membre.id}
                  className="flex flex-wrap items-center gap-3 border-b border-bordure p-5 last:border-b-0"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primaire-douce text-xs font-semibold text-primaire"
                    aria-hidden="true"
                  >
                    {initiales(membre.profil, format)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-encre">{nom || 'Sans nom'}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-encre-douce">
                      <Etiquette ton={membre.role.code === 'OWNER' ? 'primaire' : 'neutre'}>
                        {membre.role.label}
                      </Etiquette>
                      {membre.role.scope === 'ESTABLISHMENT' ? (
                        <span>
                          {membre.etablissements.length > 0
                            ? membre.etablissements.map((e) => e.name).join(', ')
                            : 'Aucun établissement rattaché'}
                        </span>
                      ) : (
                        <span>Toute l&apos;organisation</span>
                      )}
                    </p>
                  </div>

                  <ActionsMembre
                    membershipId={membre.id}
                    roleActuelId={membre.role_id}
                    suspendu={membre.status === 'SUSPENDED'}
                    roles={roles}
                    peutChangerRole={peutChangerRole}
                    peutSuspendre={peutSuspendre}
                    estMoi={estMoi}
                  />
                </div>
              );
            })}
            <Pagination
              page={membres.page}
              pages={membres.pages}
              total={membres.total}
              chemin="/membres"
            />
          </>
        )}
      </Carte>
    </div>
  );
}
