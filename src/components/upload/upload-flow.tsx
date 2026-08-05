'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/primitives';
import {
  formatBytes,
  isAcceptedMimeType,
  uploadConstraints,
} from '@/config/public';
import {
  createAnalysisSessionAction,
  startAnalysisAction,
  uploadImageAction,
} from '@/app/analyze/actions';
import {
  describePhotoQuality,
  type PhotoQualityVerdict,
} from '@/features/analysis/quality';
import {
  prepareUpload,
  type PreparedUpload,
} from '@/lib/images/prepare-upload';

type QueuedFile = {
  id: string;
  /** The file the user picked. Kept for its name and original size. */
  file: File;
  /** Prepared payload; null until preparation finishes. */
  prepared: PreparedUpload | null;
  previewUrl: string | null;
  status: 'preparing' | 'ready' | 'uploading' | 'uploaded' | 'error';
  message?: string;
  quality?: PhotoQualityVerdict;
};

function validateFile(file: File): string | null {
  if (!isAcceptedMimeType(file.type)) {
    return 'Alleen JPG, PNG en WEBP worden ondersteund.';
  }
  if (file.size > uploadConstraints.maxBytes) {
    return `Maximaal ${formatBytes(uploadConstraints.maxBytes)} per afbeelding.`;
  }
  if (file.size === 0) return 'Dit bestand is leeg.';
  return null;
}

export function UploadFlow({ maxImages }: { maxImages: number }) {
  const router = useRouter();
  const [queue, setQueue] = React.useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(
    () => () => {
      for (const entry of queue) {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      }
    },
    // Revoking on unmount only; per-item cleanup happens in removeFile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const addFiles = React.useCallback(
    (files: FileList | File[]) => {
      setGlobalError(null);
      const incoming = Array.from(files);

      setQueue((current) => {
        const room = maxImages - current.length;
        if (room <= 0) {
          setGlobalError(
            `Je kunt maximaal ${maxImages} afbeeldingen per analyse uploaden.`,
          );
          return current;
        }

        const accepted: QueuedFile[] = [];
        const rejected: string[] = [];

        for (const file of incoming.slice(0, room)) {
          const error = validateFile(file);
          if (error) {
            rejected.push(`${file.name}: ${error}`);
            continue;
          }
          accepted.push({
            id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            prepared: null,
            previewUrl: null,
            status: 'preparing',
          });
        }

        if (incoming.length > room) {
          rejected.push(
            `${incoming.length - room} bestand(en) niet toegevoegd: limiet van ${maxImages} bereikt.`,
          );
        }
        if (rejected.length > 0) setGlobalError(rejected.join(' '));

        // Decoding and re-encoding happen off the render path, so the tile
        // shows up straight away and fills itself in.
        for (const entry of accepted) {
          void prepareUpload(entry.file).then((prepared) => {
            // Dimensions of the original, so shrinking the upload never turns
            // a good photo into a "low resolution" warning.
            const quality =
              prepared.source.width > 0
                ? describePhotoQuality({
                    width: prepared.source.width,
                    height: prepared.source.height,
                    byteSize: prepared.source.byteSize,
                  })
                : undefined;

            setQueue((items) => {
              // The tile may have been removed while we were preparing it.
              if (!items.some((item) => item.id === entry.id)) {
                URL.revokeObjectURL(prepared.previewUrl);
                return items;
              }
              return items.map((item) =>
                item.id === entry.id
                  ? {
                      ...item,
                      prepared,
                      previewUrl: prepared.previewUrl,
                      status: 'ready',
                      ...(quality && quality.level !== 'ok' ? { quality } : {}),
                    }
                  : item,
              );
            });
          });
        }

        return [...current, ...accepted];
      });
    },
    [maxImages],
  );

  const removeFile = React.useCallback((id: string) => {
    setQueue((current) => {
      const target = current.find((entry) => entry.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((entry) => entry.id !== id);
    });
  }, []);

  async function handleSubmit() {
    if (queue.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setGlobalError(null);
    try {
      await submitQueue();
    } catch {
      // Whatever went wrong, the button has to come back. Leaving it spinning
      // is the one outcome with no way out for the user.
      setGlobalError(
        'Er ging iets mis bij het starten van de analyse. Probeer het opnieuw.',
      );
      setIsSubmitting(false);
    }
  }

  async function submitQueue() {
    const created = await createAnalysisSessionAction();
    if (!created.ok) {
      setGlobalError(created.message);
      setIsSubmitting(false);
      return;
    }
    const { sessionId } = created.data;

    let uploaded = 0;
    for (const entry of queue) {
      setQueue((current) =>
        current.map((item) =>
          item.id === entry.id ? { ...item, status: 'uploading' } : item,
        ),
      );

      const formData = new FormData();
      formData.set('sessionId', sessionId);
      formData.set('file', entry.prepared?.file ?? entry.file);
      if (entry.prepared?.downscaled) {
        // The server scores quality on the photo as taken, not on the smaller
        // copy we send it.
        formData.set('sourceWidth', String(entry.prepared.source.width));
        formData.set('sourceHeight', String(entry.prepared.source.height));
        formData.set('sourceBytes', String(entry.prepared.source.byteSize));
      }
      // A server action can reject outright rather than return a result - a
      // rejected transport (offline, a proxy dropping the body) never reaches
      // the action's own error handling. Without this the loop would abort and
      // leave the button spinning with no explanation.
      const result = await uploadImageAction(formData).catch(() => ({
        ok: false as const,
        code: 'UPLOAD_FAILED',
        message:
          'Uploaden is onderbroken. Controleer je verbinding en probeer het opnieuw.',
      }));

      setQueue((current) =>
        current.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                status: result.ok ? 'uploaded' : 'error',
                message: result.ok ? undefined : result.message,
              }
            : item,
        ),
      );
      if (result.ok) uploaded += 1;
    }

    if (uploaded === 0) {
      setGlobalError(
        'Geen van de afbeeldingen kon worden geüpload. Controleer het bestandstype en probeer het opnieuw.',
      );
      setIsSubmitting(false);
      return;
    }

    const started = await startAnalysisAction(sessionId);
    if (!started.ok) {
      setGlobalError(started.message);
      setIsSubmitting(false);
      return;
    }

    toast.success('Analyse gestart');
    router.push(`/analyze/${sessionId}/processing`);
  }

  const uploadedCount = queue.filter(
    (entry) => entry.status === 'uploaded',
  ).length;
  const flaggedCount = queue.filter((entry) => entry.quality).length;
  const isPreparing = queue.some((entry) => entry.status === 'preparing');

  return (
    <div className="space-y-5">
      <Panel
        className={
          isDragging
            ? 'border-[var(--color-holo-cyan)] bg-[color-mix(in_oklab,var(--color-holo-cyan)_8%,var(--surface-panel))]'
            : undefined
        }
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (event.dataTransfer.files.length > 0) {
            addFiles(event.dataTransfer.files);
          }
        }}
      >
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <Upload
            className="size-8 text-[var(--color-holo-cyan)]"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">Sleep je foto’s hierheen</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              JPG, PNG of WEBP · maximaal{' '}
              {formatBytes(uploadConstraints.maxBytes)} per foto · maximaal{' '}
              {maxImages} foto’s
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
            >
              Bestanden kiezen
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('camera-input')?.click()}
            >
              <Camera aria-hidden="true" />
              Foto maken
            </Button>
          </div>

          <input
            ref={inputRef}
            id="file-input"
            type="file"
            multiple
            accept={uploadConstraints.acceptedMimeTypes.join(',')}
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <input
            id="camera-input"
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </div>
      </Panel>

      {globalError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-[color-mix(in_oklab,var(--color-critical)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-critical)_12%,transparent)] px-4 py-3 text-sm text-[var(--color-critical)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {globalError}
        </p>
      ) : null}

      {queue.length > 0 ? (
        <section aria-label="Geselecteerde afbeeldingen">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">
              {queue.length} van {maxImages} foto’s
            </h2>
            {uploadedCount > 0 ? (
              <span className="text-xs text-[var(--text-muted)]">
                {uploadedCount} geüpload
              </span>
            ) : null}
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {queue.map((entry) => (
              <li key={entry.id} className="panel-raised overflow-hidden p-0">
                <div className="relative aspect-[4/3] bg-[var(--color-ink-800)]">
                  {entry.previewUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element --
                       Local object URL for a file the user just picked. */
                    <img
                      src={entry.previewUrl}
                      alt={`Voorbeeld van ${entry.file.name}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center">
                      <Loader2
                        className="size-5 animate-spin text-[var(--text-muted)]"
                        aria-hidden="true"
                      />
                      <span className="sr-only">Foto wordt voorbereid</span>
                    </div>
                  )}
                  {entry.status === 'uploading' ? (
                    <div className="absolute inset-0 grid place-items-center bg-black/60">
                      <Loader2
                        className="size-6 animate-spin text-white"
                        aria-hidden="true"
                      />
                      <span className="sr-only">Bezig met uploaden</span>
                    </div>
                  ) : null}
                  {entry.status === 'uploaded' ? (
                    <span className="absolute top-2 right-2 rounded-full bg-[var(--color-positive)] p-1 text-[var(--color-ink-950)]">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      <span className="sr-only">Geüpload</span>
                    </span>
                  ) : null}
                </div>

                <div className="flex items-start justify-between gap-2 p-2.5">
                  <div className="min-w-0">
                    <p
                      className="truncate text-xs font-medium"
                      title={entry.file.name}
                    >
                      {entry.file.name}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {entry.prepared?.downscaled ? (
                        <>
                          <span className="line-through">
                            {formatBytes(entry.file.size)}
                          </span>{' '}
                          {formatBytes(entry.prepared.file.size)}
                        </>
                      ) : (
                        formatBytes(entry.file.size)
                      )}
                    </p>
                    {entry.message ? (
                      <p className="mt-1 text-[11px] text-[var(--color-critical)]">
                        {entry.message}
                      </p>
                    ) : null}
                    {entry.quality
                      ? entry.quality.messages.map((message) => (
                          <p
                            key={message}
                            className={
                              entry.quality?.level === 'poor'
                                ? 'mt-1 text-[11px] leading-snug text-[var(--color-critical)]'
                                : 'mt-1 text-[11px] leading-snug text-[var(--color-caution)]'
                            }
                          >
                            {message}
                          </p>
                        ))
                      : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(entry.id)}
                    disabled={isSubmitting}
                    className="rounded-full p-1.5 text-[var(--text-muted)] hover:bg-[var(--color-ink-800)] hover:text-[var(--color-critical)] disabled:opacity-40"
                    aria-label={`${entry.file.name} verwijderen`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {flaggedCount > 0 ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-[color-mix(in_oklab,var(--color-caution)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-caution)_10%,transparent)] px-4 py-3 text-sm text-[var(--color-caution)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {flaggedCount === 1
              ? 'Eén foto is waarschijnlijk te klein of te sterk gecomprimeerd.'
              : `${flaggedCount} foto’s zijn waarschijnlijk te klein of te sterk gecomprimeerd.`}{' '}
            Je kunt gewoon doorgaan, maar een scherpere foto levert een
            betrouwbaardere analyse op.
          </span>
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          size="lg"
          onClick={handleSubmit}
          disabled={queue.length === 0 || isSubmitting || isPreparing}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Bezig met uploaden…
            </>
          ) : isPreparing ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Foto’s voorbereiden…
            </>
          ) : (
            'Start analyse'
          )}
        </Button>
        <p className="text-xs text-[var(--text-muted)]">
          Je kunt de herkenning daarna nog controleren en corrigeren.
        </p>
      </div>
    </div>
  );
}
