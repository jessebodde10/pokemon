'use client';

import * as React from 'react';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CardImage } from '@/components/ui/card-image';
import { Input, Label } from '@/components/ui/primitives';
import { searchCatalogAction } from '@/app/analyze/actions';
import type { CatalogCard } from '@/types/domain';

/**
 * Manual card lookup. Searching is explicit (submit, not keystroke) so a
 * rate-limited external catalog is not hammered while the user is typing.
 */
export function CardSearchDialog({
  trigger,
  onSelect,
}: {
  trigger: React.ReactNode;
  onSelect: (card: CatalogCard) => void | Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false);
  const [results, setResults] = React.useState<CatalogCard[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsSearching(true);
    setError(null);

    const result = await searchCatalogAction({
      name: String(formData.get('name') ?? '').trim() || undefined,
      setName: String(formData.get('setName') ?? '').trim() || undefined,
      cardNumber: String(formData.get('cardNumber') ?? '').trim() || undefined,
      // Sent as a string; the action's Zod schema coerces and range-checks it.
      pokedexNumber:
        Number(String(formData.get('pokedexNumber') ?? '').trim()) || undefined,
    });

    if (result.ok) setResults(result.data);
    else setError(result.message);
    setIsSearching(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Zoek de juiste kaart</DialogTitle>
          <DialogDescription>
            Zoek op kaartnaam, set, kaartnummer of Pokédex-nummer. Vul in wat je
            zeker weet; lege velden worden genegeerd.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSearch} className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="search-name">Kaartnaam</Label>
            <Input id="search-name" name="name" placeholder="Charizard ex" />
          </div>
          <div>
            <Label htmlFor="search-set">Set</Label>
            <Input id="search-set" name="setName" placeholder="151" />
          </div>
          <div>
            <Label htmlFor="search-number">Kaartnummer</Label>
            <Input id="search-number" name="cardNumber" placeholder="199/165" />
          </div>
          <div>
            <Label htmlFor="search-pokedex">Pokédex-nummer</Label>
            <Input
              id="search-pokedex"
              name="pokedexNumber"
              inputMode="numeric"
              placeholder="6"
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={isSearching}
              className="w-full sm:w-auto"
            >
              {isSearching ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Zoeken…
                </>
              ) : (
                <>
                  <Search aria-hidden="true" />
                  Zoeken
                </>
              )}
            </Button>
          </div>
        </form>

        {error ? (
          <p role="alert" className="text-sm text-[var(--color-critical)]">
            {error}
          </p>
        ) : null}

        <div aria-live="polite">
          {results === null ? null : results.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Geen kaarten gevonden. Probeer een kortere naam of alleen het
              kaartnummer.
            </p>
          ) : (
            <ul className="grid max-h-80 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
              {results.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={async () => {
                      await onSelect(card);
                      setOpen(false);
                    }}
                    className="w-full rounded-xl border border-[var(--border-subtle)] p-2 text-left hover:border-[var(--color-holo-cyan)]"
                  >
                    <CardImage src={card.imageSmallUrl} alt={card.name} />
                    <p className="mt-2 truncate text-xs font-medium">
                      {card.name}
                    </p>
                    <p className="truncate text-[11px] text-[var(--text-muted)]">
                      {card.setName} · {card.cardNumber}
                    </p>
                    {card.variant ? (
                      <p className="truncate text-[11px] text-[var(--text-muted)]">
                        {card.variant}
                      </p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
