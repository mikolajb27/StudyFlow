// Pokazywany, gdy brakuje konfiguracji Firebase (pliku .env.local) – zamiast ekranu logowania.

export function SetupScreen() {
    return (
        <div className="auth-page">
            <div className="auth-card auth-card-wide">
                <h2 className="logo">Study<span>Flow</span></h2>
                <h3 className="auth-title">Połącz aplikację z Firebase</h3>

                <p className="auth-text">
                    Logowanie i zapisywanie danych na koncie działa przez Firebase (darmowy plan wystarczy).
                    Brakuje konfiguracji – wykonaj te kroki raz:
                </p>

                <ol className="setup-steps">
                    <li>
                        Wejdź na <strong>console.firebase.google.com</strong> i utwórz projekt.
                    </li>
                    <li>
                        W ustawieniach projektu dodaj <strong>aplikację internetową</strong> (ikona <code>&lt;/&gt;</code>)
                        i skopiuj wartości z <code>firebaseConfig</code>.
                    </li>
                    <li>
                        W folderze aplikacji skopiuj plik <code>.env.example</code> jako <code>.env.local</code>
                        i wpisz do niego te wartości.
                    </li>
                    <li>
                        <strong>Authentication → Sign-in method:</strong> włącz „E-mail/hasło” i „Google”.
                    </li>
                    <li>
                        <strong>Firestore Database:</strong> utwórz bazę, a w zakładce „Reguły” wklej zawartość
                        pliku <code>firestore.rules</code>.
                    </li>
                    <li>
                        Zatrzymaj (Ctrl+C) i uruchom ponownie <code>npm run dev</code>.
                    </li>
                </ol>

                <p className="schedule-hint">Szczegóły znajdziesz w pliku README.md.</p>
            </div>
        </div>
    );
}
