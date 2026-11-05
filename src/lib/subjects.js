// Przedmioty: { id, name, lecturer, ects (liczba albo null), assessment }

import { findColumns, getCell, normalize, parseCsv } from "./csv.js";

export function createSubject({ name, lecturer = "", ects = null, assessment = "" }) {
    return { id: crypto.randomUUID(), name, lecturer, ects, assessment };
}

export function findSubjectByName(subjects, name) {
    const key = normalize(name);
    return subjects.find(subject => normalize(subject.name) === key);
}

export function sortSubjects(subjects) {
    return [...subjects].sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

// "5", "5,5", "5.5" -> 5.5; puste -> null; błędne -> undefined
export function parseEcts(value) {
    const text = String(value ?? "").trim().replace(",", ".");

    if (text === "") {
        return null;
    }

    const number = Number(text);
    return Number.isFinite(number) && number >= 0 && number <= 60 ? number : undefined;
}

export function hasEcts(subject) {
    return subject.ects !== null && subject.ects !== undefined;
}

export function formatEcts(ects) {
    return `${String(ects).replace(".", ",")} ECTS`;
}

// Nazwy przedmiotów z planu zajęć, których nie ma jeszcze na liście.
export function getMissingScheduleSubjects(schedule, subjects) {
    const seen = new Map();

    schedule.forEach(entry => {
        const key = normalize(entry.subject);

        if (key && !seen.has(key) && !findSubjectByName(subjects, entry.subject)) {
            seen.set(key, entry.subject.trim());
        }
    });

    return [...seen.values()];
}

// ---------- Import CSV ----------

const SUBJECT_COLUMN_ALIASES = {
    name: ["nazwa przedmiotu", "przedmiot", "nazwa", "subject", "course", "name"],
    lecturer: ["prowadzacy", "prowadzaca", "prowadzacy zajecia", "wykladowca", "nauczyciel",
        "koordynator", "lecturer", "teacher"],
    ects: ["ects", "punkty ects", "pkt ects", "punkty", "credits"],
    assessment: ["forma zaliczenia", "zaliczenie", "forma weryfikacji", "assessment"]
};

// Zwraca { items, errors } albo { fatal }. Ten sam przedmiot może wystąpić w pliku
// wiele razy (np. plik z planem zajęć) – wtedy łączymy wiersze.
export function readSubjects(text) {
    const rows = parseCsv(text);

    if (rows.length < 2) {
        return { fatal: "Plik jest pusty albo zawiera tylko nagłówek." };
    }

    const columns = findColumns(rows[0].cells, SUBJECT_COLUMN_ALIASES);

    if (columns.name === undefined) {
        return {
            fatal: "Brakuje kolumny nazwa_przedmiotu. " +
                "Pierwszy wiersz pliku musi zawierać nagłówki (pobierz wzór CSV)."
        };
    }

    const byName = new Map();
    const errors = [];

    rows.slice(1).forEach(({ cells, line }) => {
        const get = field => getCell(cells, columns, field);
        const name = get("name");

        if (name === "") {
            errors.push(`Wiersz ${line}: brak nazwy przedmiotu.`);
            return;
        }

        let ects = parseEcts(get("ects"));

        if (ects === undefined) {
            errors.push(`Wiersz ${line}: nieprawidłowa liczba ECTS „${get("ects")}” – pominięto ją.`);
            ects = null;
        }

        const item = { name, lecturer: get("lecturer"), ects, assessment: get("assessment") };
        const key = normalize(name);
        const existing = byName.get(key);

        if (existing) {
            // Uzupełniamy tylko brakujące pola.
            existing.lecturer ||= item.lecturer;
            existing.ects ??= item.ects;
            existing.assessment ||= item.assessment;
        } else {
            byName.set(key, item);
        }
    });

    return { items: [...byName.values()], errors };
}

// Import nie usuwa przedmiotów (zadania i oceny mogą być do nich przypisane):
// nowe dodaje, a istniejące (ta sama nazwa) uzupełnia danymi z pliku.
export function mergeSubjects(subjects, items) {
    const result = subjects.map(subject => ({ ...subject }));
    let added = 0;
    let updated = 0;

    items.forEach(item => {
        const existing = findSubjectByName(result, item.name);

        if (!existing) {
            result.push(createSubject(item));
            added++;
            return;
        }

        const before = JSON.stringify(existing);

        if (item.lecturer) existing.lecturer = item.lecturer;
        if (item.ects !== null) existing.ects = item.ects;
        if (item.assessment) existing.assessment = item.assessment;

        if (JSON.stringify(existing) !== before) {
            updated++;
        }
    });

    return { subjects: result, added, updated, unchanged: items.length - added - updated };
}

export const SUBJECT_TEMPLATE = [
    '"nazwa_przedmiotu";"prowadzacy";"ects";"forma_zaliczenia"',
    '"Analiza matematyczna";"dr Anna Kowalska";"6";"egzamin"',
    '"Algebra";"prof. Jan Nowak";"5";"egzamin"',
    '"Programowanie";"mgr Piotr Wiśniewski";"5";"zaliczenie na ocenę"',
    '"Higiena cyfrowa";"";"1";"zaliczenie"'
];
