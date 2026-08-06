'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Badge,
  EmptyState,
  Input,
  Label,
  Panel,
  Select,
} from '@/components/ui/primitives';
import { EVENT_TYPES, EVENT_TYPE_LABELS } from '@/features/events/types';

/**
 * Beheerscherm.
 *
 * Edits live in component state only: this is a working interface over mock
 * data, not a management system. Nothing is written anywhere, and the screen
 * says so, so an organiser never believes a change was saved.
 *
 * The row shape is deliberately generic, so wiring each collection to real
 * mutations later is a matter of replacing the handlers, not the UI.
 */

export type AdminRow = {
  id: string;
  primary: string;
  secondary: string;
  meta?: string;
};

export type AdminCollection = {
  key: string;
  label: string;
  /** Singular, used in buttons and messages. */
  noun: string;
  rows: AdminRow[];
  /** Extra field shown in the editor, when the collection has one. */
  typed?: boolean;
};

export function AdminConsole({
  collections,
}: {
  collections: AdminCollection[];
}) {
  const [activeKey, setActiveKey] = React.useState(collections[0]?.key ?? '');
  const [state, setState] = React.useState<Record<string, AdminRow[]>>(() =>
    Object.fromEntries(
      collections.map((collection) => [collection.key, collection.rows]),
    ),
  );
  const [editing, setEditing] = React.useState<AdminRow | null>(null);
  const [creating, setCreating] = React.useState(false);

  const active = collections.find((collection) => collection.key === activeKey);
  const rows = state[activeKey] ?? [];

  function reset() {
    setState(
      Object.fromEntries(
        collections.map((collection) => [collection.key, collection.rows]),
      ),
    );
    toast.success('Teruggezet naar de oorspronkelijke gegevens');
  }

  function remove(id: string) {
    setState((current) => ({
      ...current,
      [activeKey]: (current[activeKey] ?? []).filter((row) => row.id !== id),
    }));
    toast.success(
      `${active?.noun ?? 'Item'} verwijderd (alleen in dit scherm)`,
    );
  }

  function save(row: AdminRow) {
    setState((current) => {
      const list = current[activeKey] ?? [];
      const exists = list.some((entry) => entry.id === row.id);
      return {
        ...current,
        [activeKey]: exists
          ? list.map((entry) => (entry.id === row.id ? row : entry))
          : [row, ...list],
      };
    });
    setEditing(null);
    setCreating(false);
    toast.success('Opgeslagen in dit scherm');
  }

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Onderdelen"
        className="flex flex-wrap gap-2"
      >
        {collections.map((collection) => {
          const selected = collection.key === activeKey;
          return (
            <button
              key={collection.key}
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setActiveKey(collection.key);
                setEditing(null);
                setCreating(false);
              }}
              className={
                selected
                  ? 'min-h-11 rounded-full border border-[var(--color-holo-cyan)] bg-[color-mix(in_oklab,var(--color-holo-cyan)_18%,transparent)] px-4 text-sm font-medium text-[var(--color-holo-cyan)]'
                  : 'min-h-11 rounded-full border border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text-muted)] hover:border-white/30 hover:text-[var(--text-primary)]'
              }
            >
              {collection.label}
              <span className="ml-2 tabular-nums opacity-70">
                {(state[collection.key] ?? []).length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{active?.label}</h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            <RotateCcw aria-hidden="true" />
            Herstellen
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setCreating(true);
              setEditing({
                id: `new-${Date.now()}`,
                primary: '',
                secondary: '',
                meta: '',
              });
            }}
          >
            <Plus aria-hidden="true" />
            Nieuw
          </Button>
        </div>
      </div>

      {editing ? (
        <AdminEditor
          row={editing}
          typed={active?.typed ?? false}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={save}
          isNew={creating}
        />
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="Niets meer over"
          description="Alle rijen zijn verwijderd. Gebruik Herstellen om de oorspronkelijke gegevens terug te halen."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <motion.li
              key={row.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Panel className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {row.primary || '(geen naam)'}
                  </p>
                  <p className="truncate text-sm text-[var(--text-muted)]">
                    {row.secondary}
                  </p>
                </div>
                {row.meta ? <Badge>{row.meta}</Badge> : null}
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${row.primary} bewerken`}
                    onClick={() => {
                      setCreating(false);
                      setEditing(row);
                    }}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${row.primary} verwijderen`}
                    onClick={() => remove(row.id)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </Panel>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminEditor({
  row,
  typed,
  isNew,
  onCancel,
  onSave,
}: {
  row: AdminRow;
  typed: boolean;
  isNew: boolean;
  onCancel: () => void;
  onSave: (row: AdminRow) => void;
}) {
  const [draft, setDraft] = React.useState(row);

  React.useEffect(() => setDraft(row), [row]);

  return (
    <Panel raised>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
        className="space-y-4"
      >
        <h3 className="font-semibold">
          {isNew ? 'Nieuw item' : 'Item bewerken'}
        </h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="admin-primary">Naam</Label>
            <Input
              id="admin-primary"
              value={draft.primary}
              onChange={(event) =>
                setDraft({ ...draft, primary: event.target.value })
              }
              required
              maxLength={120}
            />
          </div>
          <div>
            <Label htmlFor="admin-secondary">Omschrijving</Label>
            <Input
              id="admin-secondary"
              value={draft.secondary}
              onChange={(event) =>
                setDraft({ ...draft, secondary: event.target.value })
              }
              maxLength={200}
            />
          </div>
        </div>

        {typed ? (
          <div className="sm:max-w-xs">
            <Label htmlFor="admin-meta">Type</Label>
            <Select
              id="admin-meta"
              value={draft.meta ?? ''}
              onChange={(event) =>
                setDraft({ ...draft, meta: event.target.value })
              }
            >
              <option value="">Geen type</option>
              {EVENT_TYPES.map((type) => (
                <option key={type} value={EVENT_TYPE_LABELS[type]}>
                  {EVENT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button type="submit">Opslaan</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annuleren
          </Button>
        </div>
      </form>
    </Panel>
  );
}
