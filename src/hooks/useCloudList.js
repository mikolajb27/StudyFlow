import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../firebase.js";

// Lista zapisywana w Firestore: users/{uid}/data/{name} = { items: [...] }.
// Działa jak useState: [items, setItems], a do tego info { loaded, exists }.
// Zmiany widać od razu (także offline), zapis do chmury idzie w tle.
// onError – wywoływane, gdy odczyt albo zapis się nie uda.
export function useCloudList(uid, name, { sanitize, onError } = {}) {
    const [state, setState] = useState({ items: [], loaded: false, exists: false });

    // Najnowsza wartość – żeby kilka zmian pod rząd (setItems(fn)) liczyło się od aktualnej listy.
    const latest = useRef([]);
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    useEffect(() => {
        const ref = doc(db, "users", uid, "data", name);

        return onSnapshot(
            ref,
            snapshot => {
                const raw = snapshot.exists() ? snapshot.data().items ?? [] : [];
                const items = sanitize ? sanitize(raw) : raw;

                latest.current = items;
                setState({ items, loaded: true, exists: snapshot.exists() });
            },
            error => {
                setState(current => ({ ...current, loaded: true }));
                onErrorRef.current?.(error);
            }
        );
        // sanitize to stała funkcja z modułu – nie musi być zależnością.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid, name]);

    const setItems = useCallback(update => {
        const next = typeof update === "function" ? update(latest.current) : update;

        latest.current = next;
        setState(current => ({ ...current, items: next, exists: true }));

        setDoc(doc(db, "users", uid, "data", name), { items: next, updatedAt: serverTimestamp() })
            .catch(error => onErrorRef.current?.(error));
    }, [uid, name]);

    return [state.items, setItems, state];
}
