import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/layout/legal-page';
import { serverConfig } from '@/config/env';

export const metadata: Metadata = {
  title: 'Voorwaarden',
  description:
    'De gebruiksvoorwaarden van Valtivo AI: wat je mag uploaden, welke limieten gelden en wat je van de dienst mag verwachten.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Gebruiksvoorwaarden"
      intro="Korte, leesbare afspraken over het gebruik van Valtivo AI."
      updatedAt="5 augustus 2026"
    >
      <LegalSection heading="Wat de dienst doet">
        <p>
          Valtivo AI herkent Pokémon-kaarten op foto’s die je uploadt en toont
          daar een indicatieve analyse bij. De dienst wordt aangeboden “zoals
          hij is”, zonder garantie op beschikbaarheid, volledigheid of
          nauwkeurigheid.
        </p>
      </LegalSection>

      <LegalSection heading="Wat je uploadt">
        <p>
          Upload alleen foto’s die je zelf hebt gemaakt of waarvoor je de
          rechten hebt. Upload geen foto’s van personen, identiteitsdocumenten
          of andere gevoelige inhoud. Je blijft verantwoordelijk voor het
          materiaal dat je aanbiedt.
        </p>
      </LegalSection>

      <LegalSection heading="Limieten">
        <p>
          Als gast kun je {serverConfig.limits.guestDailyAnalyses} analyse per
          24 uur uitvoeren met maximaal {serverConfig.limits.guestMaxImages}{' '}
          foto’s. Met een account zijn dat{' '}
          {serverConfig.limits.userDailyAnalyses} analyses per 24 uur met
          maximaal {serverConfig.limits.userMaxImages} foto’s per analyse. Deze
          limieten beschermen de dienst tegen misbruik en kunnen worden
          aangepast.
        </p>
      </LegalSection>

      <LegalSection heading="Wat de dienst niet is">
        <p>
          Valtivo AI is geen taxatiedienst, geen gradingdienst, geen marktplaats
          en geen aanbieder van financieel advies. Beslissingen die je op basis
          van de getoonde informatie neemt, neem je zelf.
        </p>
      </LegalSection>

      <LegalSection heading="Account en beëindiging">
        <p>
          Je kunt op elk moment stoppen met het gebruik van de dienst en je
          analyses verwijderen via het dashboard. Wij kunnen toegang beperken
          wanneer de dienst wordt misbruikt of overbelast.
        </p>
      </LegalSection>

      <LegalSection heading="Aansprakelijkheid">
        <p>
          Voor zover wettelijk toegestaan is Valtivo AI niet aansprakelijk voor
          schade die voortvloeit uit het gebruik van de getoonde schattingen,
          herkenningen of adviesloze observaties.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
