import { Squelette } from '@/components/ui/etats';

export default function ChargementApp() {
  return (
    <div className="mx-auto max-w-4xl space-y-6" role="status" aria-label="Chargement en cours">
      <div className="space-y-2">
        <Squelette className="h-8 w-56" />
        <Squelette className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Squelette className="h-20" />
        <Squelette className="h-20" />
        <Squelette className="h-20" />
      </div>
      <Squelette className="h-64" />
    </div>
  );
}
