// Dane zapisane w tej przeglądarce przed wprowadzeniem logowania (localStorage).
// Po zalogowaniu proponujemy przeniesienie ich na konto – jeden raz na przeglądarkę.

const KEYS = ["tasks", "subjects", "schedule", "grades"];
const HANDLED_KEY = "studyflow-local-data-handled";

function readList(key) {
    try {
        const parsed = JSON.parse(localStorage.getItem(key));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// { tasks: [...], subjects: [...], schedule: [...], grades: [...] } albo null, gdy nie ma czego przenosić.
export function readLocalData() {
    try {
        if (localStorage.getItem(HANDLED_KEY)) {
            return null;
        }
    } catch {
        return null;
    }

    const data = Object.fromEntries(KEYS.map(key => [key, readList(key)]));
    data.schedule = data.schedule.filter(entry => entry.date);

    return KEYS.some(key => data[key].length > 0) ? data : null;
}

// Zapamiętujemy decyzję (przeniesiono albo pominięto). Same dane zostają w przeglądarce.
export function markLocalDataHandled() {
    try {
        localStorage.setItem(HANDLED_KEY, new Date().toISOString());
    } catch {
        // Zablokowany localStorage – zapytamy ponownie następnym razem.
    }
}

// Dokładamy wpisy, których jeszcze nie ma na koncie (po id), więc nic się nie dubluje.
export function mergeById(current, incoming) {
    const ids = new Set(current.map(item => item.id));
    return [...current, ...incoming.filter(item => !ids.has(item.id))];
}
