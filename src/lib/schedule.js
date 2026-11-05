// Plan zajęć: odczyt CSV, kolory przedmiotów, układ zajęć w siatce tygodnia.
// Zajęcia: { id, date "RRRR-MM-DD", start "GG:MM", end "GG:MM", subject, type, room, custom?, seriesId? }

import { findColumns, getCell, normalize, parseCsv } from "./csv.js";
import { getCurrentTimeString, getTodayString, toDateString, toMinutes } from "./dates.js";

// Kolory przedmiotów (odcienie HSL dobrane do ciemnego tła).
const SUBJECT_HUES = [239, 199, 160, 38, 330, 270, 15, 180];

// Ten sam przedmiot zawsze dostaje ten sam kolor.
export function getSubjectHue(subject) {
    let hash = 0;

    for (const char of subject) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }

    return SUBJECT_HUES[hash % SUBJECT_HUES.length];
}

// ---------- Odczyt CSV ----------

// Nazwy kolumn, które rozpoznajemy (po normalizacji). Inne kolumny są pomijane.
const COLUMN_ALIASES = {
    date: ["data", "data zajec", "date"],
    start: ["poczatek", "od", "godzina od", "start", "start time"],
    end: ["koniec", "do", "godzina do", "end", "end time"],
    subject: ["nazwa przedmiotu", "przedmiot", "nazwa", "subject", "course"],
    type: ["rodzaj zajec", "rodzaj", "typ", "forma zajec", "type"],
    room: ["nr sali", "numer sali", "sala", "room"]
};

const REQUIRED_COLUMNS = ["date", "start", "end", "subject"];
const COLUMN_LABELS = { date: "data", start: "poczatek", end: "koniec", subject: "nazwa_przedmiotu" };

// "2026-10-01" albo "01.10.2026" (tak zapisuje polski Excel) -> "2026-10-01"
function parseDate(value) {
    const text = value.trim();
    let year, month, day;

    let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

    if (match) {
        [, year, month, day] = match.map(Number);
    } else {
        match = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);

        if (!match) {
            return null;
        }

        [, day, month, year] = match.map(Number);
    }

    const date = new Date(year, month - 1, day);

    // Odrzucamy nieistniejące daty, np. 2026-02-31.
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
    }

    return toDateString(date);
}

// "8:00", "08.00", "08:00:00" -> "08:00"
function parseTime(value) {
    const match = value.trim().match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);

    if (!match) {
        return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours > 23 || minutes > 59) {
        return null;
    }

    return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

// Zamieniamy tekst CSV na listę zajęć. Zwraca { entries, errors } albo { fatal }.
export function readSchedule(text) {
    const rows = parseCsv(text);

    if (rows.length < 2) {
        return { fatal: "Plik jest pusty albo zawiera tylko nagłówek." };
    }

    const columns = findColumns(rows[0].cells, COLUMN_ALIASES);
    const missing = REQUIRED_COLUMNS.filter(field => columns[field] === undefined);

    if (missing.length > 0) {
        return {
            fatal: `Brakuje kolumn: ${missing.map(f => COLUMN_LABELS[f]).join(", ")}. ` +
                "Pierwszy wiersz pliku musi zawierać nagłówki (pobierz wzór CSV)."
        };
    }

    const entries = [];
    const errors = [];

    rows.slice(1).forEach(({ cells, line }) => {
        const get = field => getCell(cells, columns, field);

        const date = parseDate(get("date"));
        const start = parseTime(get("start"));
        const end = parseTime(get("end"));
        const subject = get("subject");

        if (!date) {
            errors.push(`Wiersz ${line}: nieprawidłowa data „${get("date")}”.`);
        } else if (!start || !end) {
            errors.push(`Wiersz ${line}: godzina musi mieć format GG:MM (np. 9:45).`);
        } else if (toMinutes(end) <= toMinutes(start)) {
            errors.push(`Wiersz ${line}: zajęcia kończą się przed rozpoczęciem.`);
        } else if (subject === "") {
            errors.push(`Wiersz ${line}: brak nazwy przedmiotu.`);
        } else {
            entries.push({
                id: crypto.randomUUID(),
                date,
                start,
                end,
                subject,
                type: get("type"),
                room: get("room")
            });
        }
    });

    return { entries, errors };
}

export const SCHEDULE_TEMPLATE = [
    '"data";"poczatek";"koniec";"nazwa_przedmiotu";"rodzaj_zajec";"nr_sali"',
    '"2026-10-05";"8:00";"9:30";"Analiza matematyczna";"wykład";"1.38"',
    '"2026-10-05";"9:45";"11:15";"Analiza matematyczna";"ćwiczenia audytoryjne";"3.27a"',
    '"2026-10-06";"13:15";"14:45";"Algebra";"wykład";"1.38"',
    '"2026-10-07";"15:00";"16:30";"Programowanie";"ćwiczenia laboratoryjne";"4.26B"',
    '"2026-10-09";"8:00";"9:30";"Systemy operacyjne";"wykład";"on-line"'
];

// ---------- Zapytania ----------

// Zajęcia, które trwają albo dopiero się zaczną, od najwcześniejszych.
export function getUpcomingClasses(schedule, now = new Date()) {
    const today = getTodayString();
    const nowTime = getCurrentTimeString(now);

    return schedule
        .filter(entry => entry.date > today || (entry.date === today && entry.end > nowTime))
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

// Najbliższe (albo trwające) zajęcia danego przedmiotu.
export function getNextClassOf(schedule, subjectName, now = new Date()) {
    const key = normalize(subjectName);
    return getUpcomingClasses(schedule, now).find(entry => normalize(entry.subject) === key);
}

// ---------- Siatka tygodnia ----------

// Zajęcia nachodzące na siebie dzielą kolumnę dnia na "tory" obok siebie.
// Zwraca [{ entry, lane, lanes }].
export function layoutDay(entries) {
    const sorted = [...entries].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    const placed = [];

    let group = [];
    let groupEnd = 0;

    function closeGroup() {
        const laneEnds = [];
        const lanesOfGroup = [];

        group.forEach(entry => {
            let lane = laneEnds.findIndex(end => end <= toMinutes(entry.start));

            if (lane === -1) {
                lane = laneEnds.length;
                laneEnds.push(0);
            }

            laneEnds[lane] = toMinutes(entry.end);
            lanesOfGroup.push({ entry, lane });
        });

        lanesOfGroup.forEach(item => placed.push({ ...item, lanes: laneEnds.length }));
        group = [];
    }

    sorted.forEach(entry => {
        if (group.length > 0 && toMinutes(entry.start) >= groupEnd) {
            closeGroup();
        }

        groupEnd = group.length === 0
            ? toMinutes(entry.end)
            : Math.max(groupEnd, toMinutes(entry.end));

        group.push(entry);
    });

    if (group.length > 0) {
        closeGroup();
    }

    return placed;
}
