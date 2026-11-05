// Połączenie z Firebase (logowanie + baza danych Firestore).
// Konfiguracja pochodzi z pliku .env.local (zobacz .env.example i README).

import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from "firebase/auth";
import {
    connectFirestoreEmulator,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

const env = import.meta.env;

const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
};

// Bez konfiguracji aplikacja pokazuje instrukcję zamiast ekranu logowania.
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

export let auth = null;
export let db = null;
export let functions = null; // Firebase Functions – asystent AI w zakładce Pomoc
export const googleProvider = new GoogleAuthProvider();

if (isFirebaseConfigured) {
    const app = initializeApp(config);

    auth = getAuth(app);
    auth.languageCode = "pl"; // e-maile (np. reset hasła) i okno Google po polsku

    // Kopia danych w przeglądarce: aplikacja działa offline i szybciej się wczytuje.
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        ignoreUndefinedProperties: true
    });

    // Ten sam region co w functions/index.js (Warszawa).
    functions = getFunctions(app, "europe-central2");

    // Lokalne emulatory Firebase (do testów, bez prawdziwego projektu).
    if (env.VITE_USE_FIREBASE_EMULATORS === "true") {
        connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
        connectFirestoreEmulator(db, "127.0.0.1", 8080);
        connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    }
}
