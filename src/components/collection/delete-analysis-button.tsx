'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { deleteAnalysisAction } from '@/app/analyze/actions';

/** Deleting an analysis also removes its uploaded photos, so it is confirmed. */
export function DeleteAnalysisButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger" size="sm">
          <Trash2 aria-hidden="true" />
          Verwijderen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Analyse verwijderen?</DialogTitle>
          <DialogDescription>
            De analyse, de herkende kaarten en de geüploade foto’s worden
            definitief verwijderd. Kaarten die je al aan je collectie hebt
            toegevoegd blijven bestaan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Annuleren
            </Button>
          </DialogClose>
          <Button
            variant="danger"
            size="sm"
            disabled={isPending}
            onClick={async () => {
              setIsPending(true);
              const result = await deleteAnalysisAction(sessionId);
              if (result.ok) {
                toast.success('Analyse verwijderd');
                setOpen(false);
                router.refresh();
              } else {
                toast.error(result.message);
              }
              setIsPending(false);
            }}
          >
            {isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}
            Definitief verwijderen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
