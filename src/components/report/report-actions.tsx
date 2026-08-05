'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { BookmarkPlus, Loader2, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  refreshPricesAction,
  saveToCollectionAction,
} from '@/app/analyze/actions';

export function ReportActions({
  sessionId,
  isLoggedIn,
}: {
  sessionId: string;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<'prices' | 'collection' | null>(
    null,
  );

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={pending !== null}
        onClick={async () => {
          setPending('prices');
          const result = await refreshPricesAction(sessionId);
          if (result.ok) {
            toast.success(
              `Marktinformatie vernieuwd voor ${result.data.refreshed} kaart(en)`,
            );
            router.refresh();
          } else {
            toast.error(result.message);
          }
          setPending(null);
        }}
      >
        {pending === 'prices' ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCcw aria-hidden="true" />
        )}
        Prijsdata vernieuwen
      </Button>

      {isLoggedIn ? (
        <Button
          size="sm"
          disabled={pending !== null}
          onClick={async () => {
            setPending('collection');
            const result = await saveToCollectionAction(sessionId);
            if (result.ok) {
              toast.success(
                result.data.added > 0
                  ? `${result.data.added} kaart(en) toegevoegd aan je collectie`
                  : 'Er waren geen bevestigde kaarten om toe te voegen',
              );
            } else {
              toast.error(result.message);
            }
            setPending(null);
          }}
        >
          {pending === 'collection' ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <BookmarkPlus aria-hidden="true" />
          )}
          Toevoegen aan collectie
        </Button>
      ) : null}
    </div>
  );
}
