# StudyFlow

Organizer nauki dla studentów: zadania, kalendarz, plan zajęć (import CSV), przedmioty i oceny.
Zbudowany w React + Vite. Logowanie i dane użytkowników – Firebase (Authentication + Firestore),
więc te same dane widać na każdym urządzeniu.

## Uruchomienie

Wymagany Node.js (wersja 20 lub nowsza).

```bash
npm install      # tylko za pierwszym razem
npm run dev      # serwer deweloperski – adres pojawi się w terminalu (zwykle http://localhost:5173)
```

Bez konfiguracji Firebase aplikacja pokaże ekran z instrukcją – zobacz niżej.

Wersja produkcyjna (folder `dist/`):

```bash
npm run build
npm run preview
```

## Konfiguracja Firebase (jednorazowo)

1. Wejdź na [console.firebase.google.com](https://console.firebase.google.com) i utwórz projekt
   (Google Analytics nie jest potrzebne).
2. **Ustawienia projektu → Ogólne → Twoje aplikacje →** ikona `</>` (aplikacja internetowa).
   Nadaj nazwę, np. „StudyFlow”, i skopiuj wartości z `firebaseConfig`.
3. Skopiuj plik `.env.example` jako `.env.local` i wpisz te wartości, np.:
   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=studyflow-123.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=studyflow-123
   VITE_FIREBASE_STORAGE_BUCKET=studyflow-123.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
   VITE_FIREBASE_APP_ID=1:1234567890:web:abc123
   ```
   Plik `.env.local` nie trafia do gita (jest w `.gitignore`), dlatego te same wartości są też
   w pliku `.env.production`, który **jest** w repozytorium – z niego korzysta serwer budujący
   aplikację z GitHuba. To nie są sekrety (konfiguracja Firebase i tak trafia do przeglądarki).
   Klucz API Anthropic nigdy nie trafia do tych plików.
4. **Authentication → Rozpocznij → Sign-in method:** włącz **E-mail/hasło** oraz **Google**
   (dla Google wybierz adres e-mail pomocy technicznej).
5. **Firestore Database → Utwórz bazę danych:** lokalizacja np. `eur3 (Europa)` albo
   `europe-central2 (Warszawa)`, tryb produkcyjny. Potem w zakładce **Reguły** wklej zawartość pliku
   [`firestore.rules`](firestore.rules) i kliknij **Opublikuj** – dzięki temu każdy użytkownik
   widzi tylko własne dane.
6. Zatrzymaj serwer (Ctrl+C) i uruchom ponownie `npm run dev`.

Gdy aplikacja trafi do internetu (np. Firebase Hosting, Netlify), dodaj jej domenę w
**Authentication → Ustawienia → Autoryzowane domeny** (`localhost` jest tam domyślnie).

## Pomoc AI (asystent do zadań domowych)

Zakładka **Pomoc** rozmawia z modelem Claude przez funkcję Firebase `pomoc`
([functions/index.js](functions/index.js)). Klucz API Anthropic jest tylko w funkcji
(Secret Manager), nigdy w przeglądarce. Asystent działa jak korepetytor: tłumaczy i naprowadza,
a pełne rozwiązanie pokazuje na prośbę. Zachowanie zmienisz w [functions/prompt.js](functions/prompt.js).

Wdrożenie (jednorazowo):

1. **Klucz API:** na [console.anthropic.com](https://console.anthropic.com) → *API Keys* utwórz klucz
   i doładuj konto. Ustaw tam też miesięczny limit wydatków (*Limits*) – to najprostsza ochrona budżetu.
2. **Plan Blaze:** w konsoli Firebase → *Upgrade* → plan *Blaze* (płatność za użycie; darmowy limit
   Cloud Functions w zupełności wystarcza). Funkcje wymagają tego planu.
3. W terminalu w folderze projektu:
   ```bash
   cd functions && npm install && cd ..
   npx firebase-tools login
   npx firebase-tools functions:secrets:set ANTHROPIC_API_KEY   # wklej klucz z kroku 1
   npx firebase-tools deploy --only functions
   ```
   Projekt jest ustawiony w `.firebaserc`. Pierwsze wdrożenie trwa kilka minut.

Ochrona przed nabiciem rachunku: każdy użytkownik może wysłać **40 wiadomości dziennie**
(licznik w kolekcji `pomocUsage`, niedostępnej z przeglądarki). Zmiana: utwórz plik
`functions/.env` z linią `POMOC_DAILY_LIMIT=60` i wdróż ponownie. Pamiętaj, że konto w aplikacji
może założyć każdy, kto zna jej adres.

Model: `claude-opus-5-5` z `effort: "high"` (dokładność przy zadaniach ścisłych); przy odmowie
klasyfikatorów bezpieczeństwa API samo ponawia na zalecanym modelu (`fallbacks: "default"`).
Zużycie tokenów widać w logach funkcji (konsola Firebase → Functions → Logs).

### Dane sprzed logowania

Jeśli w przeglądarce są dane z wersji bez logowania, po pierwszym zalogowaniu aplikacja zaproponuje
przeniesienie ich na konto. Dane z wersji otwieranej przez dwuklik w `index.html` są przypisane do
adresu `file://`, więc nie będą widoczne pod `http://localhost`.

### Testy z emulatorami (opcjonalnie)

Zamiast prawdziwego projektu można użyć lokalnych emulatorów Firebase (wymagają Javy):

```bash
npx firebase-tools emulators:start --project demo-studyflow
```

i w `.env.local` ustawić dowolne wartości (np. `VITE_FIREBASE_PROJECT_ID=demo-studyflow`,
`VITE_FIREBASE_API_KEY=demo`) oraz `VITE_USE_FIREBASE_EMULATORS=true`.

## Struktura

```
src/
  main.jsx            punkt startowy
  App.jsx             ekran logowania / aplikacja: menu, nagłówek, widoki
  firebase.js         połączenie z Firebase (konfiguracja z .env.local)
  Auth.jsx            logowanie, rejestracja, Google, reset hasła, wylogowanie
  AppData.jsx         dane użytkownika (zadania, przedmioty, plan, oceny) zapisywane w Firestore
  Navigation.jsx      przełączanie widoków i przejścia między nimi (np. kalendarz → formularz zadania)
  styles.css          style
  lib/                logika bez Reacta: daty, CSV, plan zajęć, przedmioty, oceny, zadania
  hooks/              useCloudList (lista w Firestore), useNow, useDismiss
  components/         wspólne elementy: okno dialogowe, usuwanie z potwierdzeniem, menu konta…
  views/              widoki (logowanie, Dashboard, Moje zadania, Kalendarz, Plan zajęć, Przedmioty, Oceny, Pomoc)
functions/
  index.js            funkcja "pomoc": logowanie, limit dzienny, walidacja, strumień z Claude
  prompt.js           instrukcje korepetytora i kontekst (przedmiot, zadanie)
firestore.rules       reguły bezpieczeństwa bazy (każdy widzi tylko swoje dane)
```

Dane w Firestore: `users/{uid}/data/{tasks|subjects|schedule|grades}` = `{ items: [...] }`.
