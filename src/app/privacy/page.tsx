import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/layout/legal-page';
import { serverConfig } from '@/config/env';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'Welke foto’s Valtivo AI verwerkt, waarom, hoe lang gastanalyses bewaard blijven en hoe je je gegevens verwijdert.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      intro="Valtivo AI verwerkt foto’s van kaarten. Hieronder staat precies wat er gebeurt met die foto’s en met de gegevens die eruit worden afgeleid."
      updatedAt="5 augustus 2026"
    >
      <LegalSection heading="Welke foto’s worden verwerkt">
        <p>
          We verwerken uitsluitend de afbeeldingen die je zelf uploadt: foto’s
          van losse kaarten of van binderpagina’s. We vragen niet om foto’s van
          personen, documenten of andere onderwerpen, en raden af om die te
          uploaden.
        </p>
      </LegalSection>

      <LegalSection heading="Waarom ze worden verwerkt">
        <p>
          De foto’s worden gebruikt om kaarten te lokaliseren en te herkennen,
          om die herkenning te koppelen aan kaartrecords, en om er marktdata bij
          te zoeken. Het resultaat is jouw analyse. We gebruiken je foto’s niet
          om modellen te trainen.
        </p>
      </LegalSection>

      <LegalSection heading="Externe AI- en databronnen">
        <p>
          Afhankelijk van de configuratie kan Valtivo AI gebruikmaken van
          externe diensten: een multimodaal AI-model voor kaartherkenning, een
          publieke kaartcatalogus en een prijsbron. Bij herkenning door een
          extern model wordt de betreffende afbeelding naar die dienst
          verstuurd. In de demo-/mockmodus gebeurt dit niet: dan wordt alles
          lokaal met voorbeelddata afgehandeld.
        </p>
      </LegalSection>

      <LegalSection heading="Hoe lang gegevens bewaard blijven">
        <p>
          Analyses van gasten worden automatisch verwijderd na{' '}
          {serverConfig.limits.guestTtlHours} uur, inclusief de geüploade
          foto’s. Analyses van ingelogde gebruikers blijven bewaard totdat je ze
          zelf verwijdert.
        </p>
      </LegalSection>

      <LegalSection heading="Je gegevens verwijderen">
        <p>
          Ingelogde gebruikers kunnen elke analyse verwijderen via het
          dashboard. Daarmee worden ook de bijbehorende foto’s, herkende kaarten
          en prijsgegevens verwijderd. Kaarten die je bewust aan je collectie
          hebt toegevoegd blijven bestaan tot je ze zelf verwijdert.
        </p>
      </LegalSection>

      <LegalSection heading="Opslag en beveiliging">
        <p>
          Foto’s worden opgeslagen in een afgeschermde opslagbucket en zijn
          alleen bereikbaar via kortlopende, ondertekende links. Bestandsnamen
          worden serverzijdig gegenereerd; je oorspronkelijke bestandsnaam wordt
          alleen ter herkenning getoond. IP-adressen worden niet in leesbare
          vorm opgeslagen: voor limietcontrole gebruiken we uitsluitend een
          gezouten hash.
        </p>
      </LegalSection>

      <LegalSection heading="Statistieken">
        <p>
          We registreren gebeurtenissen zoals “analyse gestart” en “rapport
          bekeken” met alleen aantallen en technische identifiers. Er worden
          geen e-mailadressen, bestandsnamen of afbeeldingsinhoud in deze
          gebeurtenissen opgenomen.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
