// Ekran logowania: logowanie, rejestracja, reset hasła i logowanie przez Google.

import { useEffect, useRef, useState } from "react";
import { getAuthErrorMessage, useAuth } from "../Auth.jsx";

const MODES = {
    login: { title: "Zaloguj się", submit: "Zaloguj się" },
    register: { title: "Załóż konto", submit: "Załóż konto" },
    reset: { title: "Nie pamiętasz hasła?", submit: "Wyślij link do zmiany hasła" }
};

export function LoginView() {
    const { signIn, register, signInWithGoogle, resetPassword } = useAuth();

    const [mode, setMode] = useState("login");
    const [form, setForm] = useState({ name: "", email: "", password: "", repeat: "" });
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const [busy, setBusy] = useState(false);

    const firstFieldRef = useRef(null);
    const emailRef = useRef(null);
    const passwordRef = useRef(null);
    const repeatRef = useRef(null);

    // Po zmianie trybu: fokus na pierwszym polu, bez starych komunikatów.
    useEffect(() => {
        firstFieldRef.current?.focus();
    }, [mode]);

    function changeMode(next) {
        setMode(next);
        setError("");
        setInfo("");
    }

    function update(field, value) {
        setForm(current => ({ ...current, [field]: value }));
    }

    function showError(message, ref) {
        setError(message);
        setInfo("");
        ref?.current?.focus();
    }

    async function run(action) {
        setBusy(true);
        setError("");

        try {
            await action();
        } catch (caught) {
            const message = getAuthErrorMessage(caught);

            if (message) {
                showError(message);
            }
        } finally {
            setBusy(false);
        }
    }

    function handleSubmit(event) {
        event.preventDefault();

        const email = form.email.trim();

        if (email === "") {
            return showError("Podaj adres e-mail.", emailRef);
        }

        if (mode === "reset") {
            return run(async () => {
                await resetPassword(email);
                // Ten sam komunikat niezależnie od tego, czy konto istnieje (prywatność).
                setInfo(`Jeśli konto ${email} istnieje, wysłaliśmy na nie link do zmiany hasła. Sprawdź skrzynkę (także spam).`);
            });
        }

        if (form.password === "") {
            return showError("Podaj hasło.", passwordRef);
        }

        if (mode === "login") {
            return run(() => signIn(email, form.password));
        }

        if (form.password.length < 6) {
            return showError("Hasło musi mieć co najmniej 6 znaków.", passwordRef);
        }

        if (form.password !== form.repeat) {
            return showError("Hasła nie są takie same.", repeatRef);
        }

        return run(() => register(email, form.password, form.name.trim()));
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h2 className="logo">Study<span>Flow</span></h2>
                <p className="auth-tagline">Twój organizer nauki – zadania, plan zajęć i oceny w jednym miejscu.</p>

                {mode !== "reset" && (
                    <div className="auth-tabs" role="tablist" aria-label="Logowanie albo rejestracja">
                        {["login", "register"].map(name => (
                            <button
                                key={name}
                                type="button"
                                role="tab"
                                aria-selected={mode === name}
                                className={mode === name ? "active" : undefined}
                                onClick={() => changeMode(name)}
                            >
                                {name === "login" ? "Logowanie" : "Rejestracja"}
                            </button>
                        ))}
                    </div>
                )}

                {mode === "reset" && (
                    <>
                        <h3 className="auth-title">{MODES.reset.title}</h3>
                        <p className="auth-text">Podaj e-mail konta – wyślemy link do ustawienia nowego hasła.</p>
                    </>
                )}

                <form className="auth-form" noValidate onSubmit={handleSubmit}>
                    {mode === "register" && (
                        <label className="field">
                            <span>Imię</span>
                            <input type="text" ref={firstFieldRef} className="form-field" autoComplete="given-name"
                                maxLength={60} placeholder="np. Mikołaj (opcjonalnie)"
                                value={form.name} onChange={event => update("name", event.target.value)} />
                        </label>
                    )}

                    <label className="field">
                        <span>E-mail</span>
                        <input
                            type="email"
                            ref={element => {
                                emailRef.current = element;
                                if (mode !== "register") firstFieldRef.current = element;
                            }}
                            className="form-field"
                            autoComplete="email"
                            placeholder="np. jan.kowalski@student.pl"
                            value={form.email}
                            onChange={event => update("email", event.target.value)}
                        />
                    </label>

                    {mode !== "reset" && (
                        <label className="field">
                            <span>Hasło</span>
                            <input type="password" ref={passwordRef} className="form-field"
                                autoComplete={mode === "login" ? "current-password" : "new-password"}
                                placeholder={mode === "register" ? "Co najmniej 6 znaków" : undefined}
                                value={form.password} onChange={event => update("password", event.target.value)} />
                        </label>
                    )}

                    {mode === "register" && (
                        <label className="field">
                            <span>Powtórz hasło</span>
                            <input type="password" ref={repeatRef} className="form-field" autoComplete="new-password"
                                value={form.repeat} onChange={event => update("repeat", event.target.value)} />
                        </label>
                    )}

                    {error && <p className="field-error" role="alert">{error}</p>}
                    {info && <p className="auth-info" role="status">{info}</p>}

                    <button type="submit" className="auth-submit" disabled={busy}>
                        {busy ? "Chwileczkę…" : MODES[mode].submit}
                    </button>
                </form>

                {mode === "login" && (
                    <button type="button" className="link-button auth-forgot" onClick={() => changeMode("reset")}>
                        Nie pamiętasz hasła?
                    </button>
                )}

                {mode === "reset" ? (
                    <button type="button" className="link-button auth-forgot" onClick={() => changeMode("login")}>
                        ← Wróć do logowania
                    </button>
                ) : (
                    <>
                        <div className="auth-divider"><span>lub</span></div>

                        <button
                            type="button"
                            className="secondary-button auth-google"
                            disabled={busy}
                            onClick={() => run(signInWithGoogle)}
                        >
                            <GoogleIcon />
                            Kontynuuj z Google
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

function GoogleIcon() {
    return (
        <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
    );
}
