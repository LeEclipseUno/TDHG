# Wegenkenner in de Play Store

De app in de Play Store is een Trusted Web Activity (TWA): een dun Android-jasje dat wegenkenner.nl opent zonder browserbalk. Dezelfde code, dezelfde updates, geen aparte build.

## Eenmalig

1. Ga naar https://www.pwabuilder.com, vul `https://wegenkenner.nl` in en kies **Package for stores**, **Android**.
2. Instellingen:
   - Package ID: `nl.wegenkenner.app`
   - App name: `Wegenkenner`, launcher name: `Wegenkenner`
   - Signing key: **Create new** (bewaar het gedownloade keystore-bestand en de wachtwoorden in de wachtwoordmanager; kwijt is kwijt)
   - Display mode: standalone, Status bar color: `#091b2c`
3. Download het pakket. Daarin zit `assetlinks.json` met de SHA-256 vingerafdruk van de signing key.
4. Zet dat bestand in deze repo op `public/.well-known/assetlinks.json` en push. Zonder dit bestand toont de app een browserbalk.
5. Maak in https://play.google.com/console een app aan (eenmalig 25 dollar registratie), upload de `.aab` uit het pakket onder **Productie** of eerst **Interne test**.
6. Store-vermelding: korte omschrijving "Hoe goed ken jij de Nederlandse snelwegen?", lange omschrijving uit de About-pagina, screenshots van telefoon (minimaal twee, 1080x1920), feature graphic 1024x500 uit `branding/`.
7. Privacybeleid-URL: `https://wegenkenner.nl/privacy.html`. Data safety: e-mailadres (account), app-activiteit (scores), geen advertentie-ID buiten AdSense.

## Daarna

- Nieuwe versie van de site: niets doen, de app laadt de site.
- Verandert het manifest ingrijpend (naam, kleuren, start_url): opnieuw door PWABuilder halen en een nieuwe `.aab` uploaden. Gebruik dezelfde signing key.
- Google Play billing is niet nodig: Plus wordt via de site verkocht, dat mag voor een TWA zolang de aankoop niet in de app zelf wordt afgedwongen.
