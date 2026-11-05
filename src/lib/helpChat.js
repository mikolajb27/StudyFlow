// Rozmowa z asystentem AI: kontekst z aplikacji, historia dla API, komunikaty błędów.

// Kontekst rozmowy (wysyłany do funkcji): przedmiot i zadanie, z którym student prosi o pomoc.
// Zapamiętujemy go przy pierwszej wiadomości – potem się nie zmienia (każde zapytanie musi
// zaczynać się tak samo).
export function buildHelpContext({ task, subject, subjects }) {
    return {
        subject: subject
            ? { name: subject.name, lecturer: subject.lecturer, ects: subject.ects, assessment: subject.assessment }
            : null,
        task: task
            ? { title: task.title, description: task.description, dueDate: task.dueDate, dueTime: task.dueTime }
            : null,
        subjects: subjects.map(item => item.name)
    };
}

// Tura rozmowy: { id, user: { text, attachments, content }, assistant: { status, content } }
// status: "streaming" | "done" | "stopped" | "truncated" | "refused"
// Do API idą tylko tury z odpowiedzią (odmowy pomijamy), w dokładnie tej samej postaci.
export function toApiMessages(turns) {
    return turns
        .filter(turn => ["done", "stopped", "truncated"].includes(turn.assistant.status))
        .flatMap(turn => [
            { role: "user", content: turn.user.content },
            { role: "assistant", content: turn.assistant.content }
        ]);
}

// Tekst odpowiedzi do wyświetlenia (bloki "thinking" pomijamy).
export function assistantText(content) {
    return (content || [])
        .filter(block => block.type === "text")
        .map(block => block.text)
        .join("");
}

// Błąd z httpsCallable -> komunikat po polsku. Funkcja zwraca już polskie komunikaty
// (HttpsError), więc pokazujemy je, a dla błędów sieci/konfiguracji mamy własne.
export function getHelpErrorMessage(error) {
    const code = String(error?.code || "").replace("functions/", "");

    // Przy strumieniowaniu SDK Firebase dokleja do komunikatu techniczny dopisek, np. " [0]".
    const message = String(error?.message || "").replace(/\s*\[\d+\]\s*$/, "");

    switch (code) {
        case "not-found":
            return "Asystent nie jest jeszcze uruchomiony – wdróż funkcję „pomoc” (README → Pomoc AI).";
        case "unauthenticated":
            return "Sesja wygasła. Zaloguj się ponownie.";
        case "deadline-exceeded":
            return "Odpowiedź trwała zbyt długo. Spróbuj ponownie albo podziel pytanie na mniejsze części.";
        case "resource-exhausted":
        case "invalid-argument":
        case "failed-precondition":
        case "unavailable":
            return message;
        case "internal":
            // Nieobsłużony błąd w funkcji ma komunikat "internal" – wtedy własny tekst.
            return message && message.toLowerCase() !== "internal"
                ? message
                : "Coś poszło nie tak po stronie asystenta. Spróbuj ponownie.";
        default:
            return navigator.onLine === false
                ? "Brak połączenia z internetem."
                : "Nie udało się połączyć z asystentem. Spróbuj ponownie.";
    }
}

export const SUGGESTIONS = [
    "Pomóż mi zacząć to zadanie – od czego mam zacząć?",
    "Sprawdź moje rozwiązanie: gdzie jest błąd?",
    "Wytłumacz mi to pojęcie na prostym przykładzie: ",
    "Przygotuj mnie do kolokwium z tego przedmiotu."
];
