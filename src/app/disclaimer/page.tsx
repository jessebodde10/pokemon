import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/layout/legal-page';
import { LEGAL_DISCLAIMER } from '@/components/layout/site-shell';

export const metadata: Metadata = {
  title: 'Disclaimer',
  description:
    'Wat Pokora AI wel en niet is: indicatieve informatie, geen taxatie-, grading- of beleggingsdienst.',
  alternates: { canonical: '/disclaimer' },
};

export default function DisclaimerPage() {
  return (
    <LegalPage
      title="Disclaimer"
      intro={LEGAL_DISCLAIMER}
      updatedAt="5 augustus 2026"
    >
      <LegalSection heading="Schattingen, geen taxaties">
        <p>
          Alle bedragen in Pokora AI zijn schattingen met een bandbreedte. Ze
          zijn gebaseerd op de marktdata die op dat moment beschikbaar was bij
          de vermelde bron. Werkelijke verkoopprijzen hangen af van conditie,
          vraag, timing, verkoopkanaal en kosten, en kunnen daar aanzienlijk van
          afwijken.
        </p>
        <p>
          Wanneer er te weinig bruikbare waarnemingen zijn, tonen we geen bedrag
          maar “Onvoldoende marktdata”. We vullen ontbrekende data nooit aan met
          een schatting.
        </p>
      </LegalSection>

      <LegalSection heading="Geen gradingdienst">
        <p>
          Pokora AI voert geen professionele conditiebeoordeling uit en geeft
          geen voorspelling van een gradingresultaat. De optionele
          conditie-indicatie is een grove inschatting en staat standaard op
          “onbekend” wanneer alleen een binderfoto beschikbaar is.
        </p>
      </LegalSection>

      <LegalSection heading="Geen financieel advies">
        <p>
          Pokora AI geeft geen koop-, verkoop- of houdadvies en doet geen
          uitspraken over toekomstige waardeontwikkeling. De sectie “Verdient
          extra aandacht” beschrijft uitsluitend eigenschappen van de data,
          zoals onzekere herkenning of sterk uiteenlopende prijswaarnemingen.
        </p>
      </LegalSection>

      <LegalSection heading="Herkenning kan fout zijn">
        <p>
          Kaartherkenning op basis van foto’s is nooit perfect. Daarom wordt
          geen enkele herkenning automatisch als definitief opgeslagen: je
          bevestigt, corrigeert of verwijdert elke kaart zelf. Bevestig je
          niets, dan telt de kaart niet mee in het totaal.
        </p>
      </LegalSection>

      <LegalSection heading="Merken en rechten">
        <p>
          Pokora AI is een onafhankelijk hulpmiddel en is niet verbonden aan, en
          wordt niet gesteund door, de uitgevers of rechthebbenden van de
          Pokémon-kaarten. Kaart- en setnamen worden uitsluitend beschrijvend
          gebruikt om kaarten te kunnen identificeren.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
