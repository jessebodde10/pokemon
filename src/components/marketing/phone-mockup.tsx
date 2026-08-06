import { Check, HelpCircle, Search } from 'lucide-react';

/**
 * Hero visual: a binder page turning into an analysis.
 *
 * The left grid is a 3x3 binder pocket sheet - the product's actual input. The
 * phone shows the review screen the user really lands on, with the same wording
 * and the same hedged amounts. It is a mockup, not a screenshot, but nothing in
 * it claims anything the product does not do: the amounts carry a band, the
 * unreadable card is marked unknown, and no grade is predicted.
 *
 * The sheen sweeping across the glass is the one piece of pure decoration on
 * the page, and it is the holofoil idea the whole identity hangs on.
 */

type Slot = {
  name: string;
  number: string;
  hue: number;
  state: 'confirmed' | 'pending' | 'unknown';
};

const SLOTS: Slot[] = [
  { name: 'Charizard ex', number: '199/165', hue: 18, state: 'confirmed' },
  { name: 'Pikachu', number: '025/165', hue: 48, state: 'confirmed' },
  { name: 'Mew ex', number: '205/165', hue: 320, state: 'confirmed' },
  { name: 'Umbreon VMAX', number: '215/203', hue: 265, state: 'pending' },
  { name: 'Bulbasaur', number: '001/165', hue: 140, state: 'confirmed' },
  { name: 'Charizard ex', number: '006/165', hue: 10, state: 'pending' },
  { name: '', number: '', hue: 220, state: 'unknown' },
  { name: 'Mewtwo', number: '150/165', hue: 285, state: 'confirmed' },
  { name: 'Gengar ex', number: '164/165', hue: 300, state: 'confirmed' },
];

function BinderSheet() {
  return (
    <div
      aria-hidden="true"
      className="grid w-full grid-cols-3 gap-2.5 rounded-[1.75rem] border border-white/15 bg-white/[0.05] p-3 sm:gap-3 sm:p-4"
    >
      {SLOTS.map((slot, index) => (
        <div
          key={index}
          className="relative aspect-[63/88] overflow-hidden rounded-lg border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
          style={{
            background: `linear-gradient(150deg, hsl(${slot.hue} 62% 42%), hsl(${(slot.hue + 45) % 360} 52% 20%))`,
          }}
        >
          {/* Sleeve highlight: the plastic pocket catching light near the top */}
          <div className="absolute inset-x-1 top-1 h-[45%] rounded-md bg-white/[0.13]" />
          {slot.state === 'unknown' ? (
            <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold text-white/60">
              ?
            </span>
          ) : (
            <span className="absolute bottom-1 left-1 font-mono text-[7px] tracking-tight text-white/75">
              {slot.number}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function ReviewRow({
  name,
  meta,
  value,
  state,
}: {
  name: string;
  meta: string;
  value: string;
  state: 'confirmed' | 'pending' | 'unknown';
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.04] p-2">
      <div
        className="h-9 w-[26px] shrink-0 rounded-[5px]"
        style={{
          background:
            state === 'unknown'
              ? 'linear-gradient(150deg,#2b3350,#171c2e)'
              : 'linear-gradient(150deg,#7c5cff55,#22d3ee33)',
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] leading-tight font-semibold">
          {name}
        </p>
        <p className="truncate font-mono text-[8px] leading-tight text-[var(--color-ink-500)]">
          {meta}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={
            state === 'unknown'
              ? 'font-mono text-[8px] leading-tight text-[var(--color-caution)]'
              : 'font-mono text-[9px] leading-tight font-semibold text-[var(--color-gold)]'
          }
        >
          {value}
        </p>
      </div>
      <span
        className="grid size-4 shrink-0 place-items-center rounded-full"
        style={{
          background:
            state === 'confirmed'
              ? 'color-mix(in oklab, #4ade80 26%, transparent)'
              : state === 'pending'
                ? 'color-mix(in oklab, #fbbf24 26%, transparent)'
                : 'color-mix(in oklab, #6f78a3 26%, transparent)',
        }}
      >
        {state === 'confirmed' ? (
          <Check className="size-2.5 text-[var(--color-positive)]" />
        ) : state === 'pending' ? (
          <Search className="size-2.5 text-[var(--color-caution)]" />
        ) : (
          <HelpCircle className="size-2.5 text-[var(--color-ink-300)]" />
        )}
      </span>
    </div>
  );
}

export function PhoneMockup() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto w-[236px] sm:w-[262px]"
      style={{ animation: 'float-soft 7s ease-in-out infinite' }}
    >
      {/* Glow pooling under the device */}
      <div
        className="absolute -inset-10 -z-10 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklab, #7c5cff 42%, transparent), transparent 68%)',
        }}
      />

      {/* Device body */}
      <div className="relative overflow-hidden rounded-[2.6rem] border border-white/15 bg-[#05060b] p-[9px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)]">
        {/* Screen */}
        <div className="relative overflow-hidden rounded-[2.1rem] bg-[var(--color-ink-950)]">
          {/* Dynamic island */}
          <div className="absolute top-2 left-1/2 z-20 h-[18px] w-[68px] -translate-x-1/2 rounded-full bg-black" />

          <div className="relative z-10 px-3 pt-8 pb-4">
            {/* App bar */}
            <div className="flex items-center justify-between">
              <span className="label-mono !text-[8px] !tracking-[0.18em]">
                Stap 2 van 3
              </span>
              <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 font-mono text-[8px] text-[var(--color-ink-300)]">
                9 kaarten
              </span>
            </div>

            <h3 className="mt-2.5 text-[15px] leading-tight font-bold tracking-tight">
              Controleer de herkenning
            </h3>
            <p className="mt-1 text-[9px] leading-snug text-[var(--color-ink-500)]">
              Niets telt mee tot je het bevestigt.
            </p>

            <div className="mt-3 space-y-1.5">
              <ReviewRow
                name="Charizard ex"
                meta="151 · 199/165 · 91%"
                value="€245–336"
                state="confirmed"
              />
              <ReviewRow
                name="Umbreon VMAX"
                meta="EVS · 215/203 · 86%"
                value="Geen data"
                state="pending"
              />
              <ReviewRow
                name="Pikachu"
                meta="151 · 025/165 · 84%"
                value="€2–4"
                state="confirmed"
              />
              <ReviewRow
                name="Onbekende kaart"
                meta="niet leesbaar · 21%"
                value="—"
                state="unknown"
              />
            </div>

            {/* Running total, with a band and a source line */}
            <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.04] p-2.5">
              <p className="label-mono !text-[7px]">Bevestigd totaal</p>
              <p className="mt-0.5 font-mono text-[15px] font-semibold tracking-tight text-[var(--color-gold)]">
                €247 – €340
              </p>
              <p className="mt-0.5 font-mono text-[7px] text-[var(--color-ink-500)]">
                midden €289 · 42 waarnemingen · 3 dgn oud
              </p>
            </div>

            <div className="mt-2.5 rounded-full bg-white/[0.9] py-1.5 text-center text-[10px] font-semibold text-[var(--color-ink-950)]">
              Bekijk collectierapport
            </div>
          </div>

          {/* The sheen. Sits above the UI, below nothing. */}
          <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
            <div
              className="absolute -top-1/4 h-[150%] w-16"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.16), rgba(124,92,255,0.14), transparent)',
                animation: 'glass-sheen 6.5s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroVisual() {
  return (
    <div className="relative">
      {/* The binder sheet sits behind and to the left, tilted away from the
          phone. It has to stay legible as a 3x3 pocket page - that is the whole
          point of the visual - so it fades toward the phone rather than being
          uniformly dimmed into abstract colour blocks. */}
      <div
        className="absolute top-2 -left-4 hidden w-[310px] -rotate-6 opacity-80 sm:block lg:-left-14 lg:w-[350px]"
        style={{
          maskImage:
            'linear-gradient(115deg, #000 0%, #000 42%, rgba(0,0,0,0.35) 72%, transparent 96%)',
        }}
      >
        <BinderSheet />
      </div>

      <div className="relative sm:pl-24 lg:pl-28">
        <PhoneMockup />
      </div>

      <p className="mt-6 text-center font-mono text-[10px] text-[var(--color-ink-500)] sm:pl-24 sm:text-left lg:pl-28">
        Voorbeeldweergave · geen echte marktwaarnemingen
      </p>
    </div>
  );
}
