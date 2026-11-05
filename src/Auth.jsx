// Logowanie: aktualny użytkownik i akcje (logowanie, rejestracja, Google, reset hasła, wylogowanie).

import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile
} from "firebase/auth";
import { clearIndexedDbPersistence, terminate } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, db, googleProvider } from "./firebase.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    // undefined = jeszcze sprawdzamy, null = niezalogowany, obiekt = zalogowany użytkownik
    const [user, setUser] = useState(undefined);

    // Podczas wylogowania (aż do przeładowania strony) nie pokazujemy na chwilę ekranu logowania.
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => onAuthStateChanged(auth, current => setUser(current ?? null)), []);

    const value = useMemo(() => ({
        user,
        loggingOut,

        signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),

        async register(email, password, name) {
            const { user: created } = await createUserWithEmailAndPassword(auth, email, password);

            if (name) {
                await updateProfile(created, { displayName: name });
                setUser({ ...created, displayName: name }); // od razu widać imię w nagłówku
            }
        },

        signInWithGoogle: () => signInWithPopup(auth, googleProvider),

        resetPassword: email => sendPasswordResetEmail(auth, email),

        // Po wylogowaniu czyścimy kopię danych w przeglądarce (komputer może być wspólny)
        // i wczytujemy stronę od nowa.
        async logOut() {
            setLoggingOut(true);
            await signOut(auth);

            try {
                await terminate(db);
                await clearIndexedDbPersistence(db);
            } finally {
                window.location.reload();
            }
        }
    }), [user, loggingOut]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}

// Komunikaty błędów Firebase po polsku. null = nic nie pokazujemy (np. zamknięte okno Google).
export function getAuthErrorMessage(error) {
    switch (error?.code) {
        case "auth/invalid-email":
            return "Nieprawidłowy adres e-mail.";
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "Nieprawidłowy e-mail lub hasło.";
        case "auth/email-already-in-use":
            return "Konto z tym adresem e-mail już istnieje. Zaloguj się.";
        case "auth/weak-password":
            return "Hasło musi mieć co najmniej 6 znaków.";
        case "auth/missing-password":
            return "Podaj hasło.";
        case "auth/too-many-requests":
            return "Zbyt wiele prób. Spróbuj ponownie za chwilę.";
        case "auth/network-request-failed":
            return "Brak połączenia z internetem.";
        case "auth/popup-blocked":
            return "Przeglądarka zablokowała okno logowania Google. Zezwól na wyskakujące okna i spróbuj ponownie.";
        case "auth/account-exists-with-different-credential":
            return "To konto jest już powiązane z innym sposobem logowania.";
        case "auth/operation-not-allowed":
            return "Ten sposób logowania nie jest włączony w projekcie Firebase.";
        case "auth/popup-closed-by-user":
        case "auth/cancelled-popup-request":
            return null;
        default:
            return "Coś poszło nie tak. Spróbuj ponownie.";
    }
}
