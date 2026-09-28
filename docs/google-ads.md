# Google Ads voor Wegenkenner

Eén kleine zoekcampagne, alleen Nederland, exacte zoekwoorden. Doel: uitvinden wat een speler kost, niet volume.

## Account

1. ads.google.com, nieuw account, valuta EUR, tijdzone Amsterdam. Sla de "smart campaign" wizard over: kies onderaan **Switch to expert mode** en daarna **Create a campaign without a goal's guidance**.
2. Campagnetype **Search**. Zet **Search partners** en **Display network** uit.
3. Locatie: Nederland, en bij "Location options" kies **Presence** (mensen in Nederland, niet mensen die erin geïnteresseerd zijn).
4. Taal: Nederlands en Engels.
5. Budget: € 2 per dag. Bieden: **Maximize clicks** met een maximum CPC van € 0,30.
6. Landingspagina: `https://wegenkenner.nl/?utm_source=google&utm_medium=cpc&utm_campaign=zoek`

## Advertentiegroep 1: quiz

Zoekwoorden, allemaal **exact** (tussen rechte haken):

```
[snelwegen quiz]
[snelwegen spel]
[wegennet quiz]
[knooppunten quiz]
[knooppunten leren]
[snelwegen leren]
[nederlandse snelwegen quiz]
[aardrijkskunde spel nederland]
[topografie nederland spel]
[dagelijkse puzzel nederland]
```

Koppen (max 30 tekens, Google mixt ze):

```
Ken jij de A27 op de kaart?
Het dagelijkse wegenspel
Snelwegen quiz, gratis
Vijf vragen per dag
Knooppunten en afritten
Speel Wegenkenner
```

Beschrijvingen (max 90 tekens):

```
Elke dag vijf vragen over het Nederlandse wegennet. Gratis, in de browser, geen account nodig.
Vind de snelweg op een lege kaart, sleep de borden, wijs het knooppunt aan. Speel mee.
```

## Advertentiegroep 2: kennis

```
[hoeveel snelwegen heeft nederland]
[langste snelweg nederland]
[knooppunt oudenrijn]
[knooppunt ridderkerk]
[alle knooppunten nederland]
[snelwegen nederland kaart]
```

Landingspagina voor deze groep: `https://wegenkenner.nl/wegen/?utm_source=google&utm_medium=cpc&utm_campaign=kennis`

Koppen:

```
Alle snelwegen op de kaart
Elke weg, elk knooppunt
Hoe goed ken jij ze?
Gratis wegenspel
```

## Uitsluitingen

Negatieve zoekwoorden op campagneniveau, anders betaal je voor verkeersinformatie en examens:

```
file
files
verkeersinformatie
werkzaamheden
afgesloten
theorie examen
cbr
rijles
vacature
```

## Na een week

Kijk in Google Ads bij Zoektermen welke echte zoekopdrachten klikken opleverden. Alles wat niets met het spel te maken heeft gaat naar de negatieve lijst. Bij Search Console zie je of dezelfde termen ook organisch binnenkomen; die kun je dan uit de campagne halen en aan de site geven.

Eerste ijkpunt: onder € 0,50 per klik en meer dan 30 procent van de klikkers die de dagelijkse speelt is goed genoeg om door te laten lopen.
