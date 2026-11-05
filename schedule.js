// PLAN ZAJĘĆ
// Plan importowany z pliku CSV (jeden wiersz = jedne zajęcia w konkretnym dniu),
// wyświetlany tydzień po tygodniu i zapisywany w przeglądarce.
// Korzysta z funkcji z script.js: toDateString, getTodayString, formatDueDate,
// oraz z calendar.js: parseDateString.

const scheduleGrid = document.querySelector("#scheduleGrid");
const scheduleWrapper = document.querySelector("#scheduleWrapper");
const scheduleEmpty = document.querySelector("#scheduleEmpty");
const scheduleWeekTitle = document.querySelector("#scheduleWeekTitle");
const scheduleWeekNav = document.querySelector("#scheduleWeekNav");
const prevWeekButton = document.querySelector("#prevWeek");
const nextWeekButton = document.querySelector("#nextWeek");
const thisWeekButton = document.querySelector("#thisWeek");
const importStatus = document.querySelector("#importStatus");
const scheduleFile = document.querySelector("#scheduleFile");
const importScheduleButton = document.querySelector("#importScheduleButton");
const downloadTemplateButton = document.querySelector("#downloadTemplate");
const clearScheduleArea = document.querySelector("#clearScheduleArea");
const scheduleSettings = document.querySelector("#scheduleSettings");
const scheduleSettingsButton = document.querySelector("#scheduleSettingsButton");
const scheduleSettingsMenu = document.querySelector("#scheduleSettingsMenu");

// Komunikat "Brak zajęć w tym tygodniu" nad siatką.
const weekEmptyNote = document.createElement("p");
weekEmptyNote.className = "schedule-week-empty";
weekEmptyNote.textContent = "Brak zajęć w tym tygodniu.";
weekEmptyNote.hidden = true;
scheduleWrapper.before(weekEmptyNote);

const DAY_NAMES = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
const HOUR_HEIGHT = 56; // wysokość jednej godziny w siatce (px)

// Kolory przedmiotów (odcienie HSL dobrane do ciemnego tła).
const SUBJECT_HUES = [239, 199, 160, 38, 330, 270, 15, 180];

// Każde zajęcia: { id, date "RRRR-MM-DD", start "GG:MM", end "GG:MM", subject, type, room }
// (stare wpisy bez daty, z poprzedniej wersji planu, pomijamy).
let schedule = (JSON.parse(localStorage.getItem("schedule")) || []).filter(entry => entry.date);

// Poniedziałek wyświetlanego tygodnia.
let weekStart = getMonday(new Date());

function saveSchedule() {
    localStorage.setItem("schedule", JSON.stringify(schedule));
}

// ---------- Pomocnicze ----------

// "Nazwa_przedmiotu" -> "nazwa przedmiotu": małe litery, bez polskich znaków i podkreśleń.
function normalize(text) {
    return text
        .toLowerCase()
        .replace(/ł/g, "l")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[_.]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function toMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}

function getMonday(date) {
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return monday;
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// Ten sam przedmiot zawsze dostaje ten sam kolor.
function getSubjectHue(subject) {
    let hash = 0;

    for (const char of subject) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }

    return SUBJECT_HUES[hash % SUBJECT_HUES.length];
}

// "5–11 października 2026", "28 września – 4 października 2026", "28 grudnia 2026 – 3 stycznia 2027"
function formatWeekRange(monday) {
    const sunday = addDays(monday, 6);
    const end = sunday.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });

    if (monday.getMonth() === sunday.getMonth()) {
        return `${monday.getDate()}–${end}`;
    }

    const startOptions = monday.getFullYear() === sunday.getFullYear()
        ? { day: "numeric", month: "long" }
        : { day: "numeric", month: "long", year: "numeric" };

    return `${monday.toLocaleDateString("pl-PL", startOptions)} – ${end}`;
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

// Separator: średnik, przecinek albo tabulator.
function detectDelimiter(firstLine) {
    const candidates = [";", ",", "\t"];
    let best = ",";
    let bestCount = 0;

    candidates.forEach(candidate => {
        const count = firstLine.split(candidate).length - 1;

        if (count > bestCount) {
            best = candidate;
            bestCount = count;
        }
    });

    return best;
}

// Dzielimy tekst CSV na wiersze i komórki (obsługuje pola w cudzysłowach).
function parseCsv(text) {
    const delimiter = detectDelimiter(text.split(/\r?\n/)[0]);
    const rows = [];

    let row = [];
    let field = "";
    let inQuotes = false;
    let line = 1;
    let rowLine = 1;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (inQuotes) {
            if (char === '"' && text[i + 1] === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                if (char === "\n") line++;
                field += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === delimiter) {
            row.push(field);
            field = "";
        } else if (char === "\n" || char === "\r") {
            if (char === "\r" && text[i + 1] === "\n") i++;

            row.push(field);
            rows.push({ cells: row, line: rowLine });

            row = [];
            field = "";
            line++;
            rowLine = line;
        } else {
            field += char;
        }
    }

    if (field !== "" || row.length > 0) {
        row.push(field);
        rows.push({ cells: row, line: rowLine });
    }

    // Pomijamy puste wiersze.
    return rows.filter(r => r.cells.some(cell => cell.trim() !== ""));
}

// Zamieniamy tekst CSV na listę zajęć. Zwraca { entries, errors } albo { fatal }.
function readSchedule(text) {
    const rows = parseCsv(text.replace(/^﻿/, ""));

    if (rows.length < 2) {
        return { fatal: "Plik jest pusty albo zawiera tylko nagłówek." };
    }

    // Która kolumna jest którą?
    const header = rows[0].cells.map(normalize);
    const columns = {};

    Object.entries(COLUMN_ALIASES).forEach(([field, aliases]) => {
        const index = header.findIndex(name => aliases.includes(name));

        if (index !== -1) {
            columns[field] = index;
        }
    });

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
        const get = field =>
            columns[field] === undefined ? "" : (cells[columns[field]] || "").trim();

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

// Pliki z polskiego Excela bywają zapisane w Windows-1250 zamiast UTF-8.
async function readFileText(file) {
    const buffer = await file.arrayBuffer();

    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
        return new TextDecoder("windows-1250").decode(buffer);
    }
}

// ---------- Komunikaty ----------

// Komunikat w ramce (sukces / ostrzeżenie / błąd) z opcjonalną listą szczegółów.
// Używany też w widoku przedmiotów (subjects.js).
function showStatus(element, kind, message, details = []) {
    element.className = `import-status ${kind}`;
    element.replaceChildren();

    const text = document.createElement("p");
    text.textContent = message;
    element.appendChild(text);

    if (details.length > 0) {
        const list = document.createElement("ul");
        const MAX_DETAILS = 5;

        details.slice(0, MAX_DETAILS).forEach(detail => {
            const item = document.createElement("li");
            item.textContent = detail;
            list.appendChild(item);
        });

        if (details.length > MAX_DETAILS) {
            const item = document.createElement("li");
            item.textContent = `…i ${details.length - MAX_DETAILS} innych.`;
            list.appendChild(item);
        }

        element.appendChild(list);
    }

    element.hidden = false;
}

function showImportStatus(kind, message, details = []) {
    showStatus(importStatus, kind, message, details);
}

// ---------- Import / wzór / czyszczenie ----------

importScheduleButton.addEventListener("click", () => scheduleFile.click());

scheduleFile.addEventListener("change", async () => {
    const file = scheduleFile.files[0];
    scheduleFile.value = ""; // pozwala wczytać ten sam plik ponownie

    if (!file) {
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        showImportStatus("error", "Plik jest za duży (maks. 2 MB).");
        return;
    }

    const result = readSchedule(await readFileText(file));

    if (result.fatal) {
        showImportStatus("error", `Nie udało się wczytać pliku „${file.name}”. ${result.fatal}`);
        return;
    }

    if (result.entries.length === 0) {
        showImportStatus(
            "error",
            `W pliku „${file.name}” nie ma żadnych poprawnych zajęć.`,
            result.errors
        );
        return;
    }

    const replaced = schedule.some(entry => !entry.custom);
    const customEntries = schedule.filter(entry => entry.custom);

    // Nowy plan z pliku zastępuje stary, ale własne zajęcia użytkownika zostają.
    schedule = [...result.entries, ...customEntries];
    saveSchedule();

    // Pokazujemy bieżący tydzień, a jeśli plan go nie obejmuje – pierwszy tydzień planu.
    const dates = result.entries.map(entry => entry.date).sort();
    const first = dates[0];
    const last = dates[dates.length - 1];
    const today = getTodayString();

    weekStart = getMonday(today >= first && today <= last ? new Date() : parseDateString(first));
    renderSchedule();

    let message =
        `Zaimportowano plan z pliku „${file.name}”: liczba zajęć ${result.entries.length}, ` +
        `od ${formatDueDate(first)} do ${formatDueDate(last)}.`;

    if (replaced) {
        message += " Nowy plan zastąpił poprzedni.";
    }

    if (customEntries.length > 0) {
        message += " Twoje własne zajęcia zostały zachowane.";
    }

    if (result.errors.length > 0) {
        showImportStatus("warning", `${message} Pominięto wiersze z błędami:`, result.errors);
    } else {
        showImportStatus("success", message);
    }
});

downloadTemplateButton.addEventListener("click", () => {
    const lines = [
        '"data";"poczatek";"koniec";"nazwa_przedmiotu";"rodzaj_zajec";"nr_sali"',
        '"2026-10-05";"8:00";"9:30";"Analiza matematyczna";"wykład";"1.38"',
        '"2026-10-05";"9:45";"11:15";"Analiza matematyczna";"ćwiczenia audytoryjne";"3.27a"',
        '"2026-10-06";"13:15";"14:45";"Algebra";"wykład";"1.38"',
        '"2026-10-07";"15:00";"16:30";"Programowanie";"ćwiczenia laboratoryjne";"4.26B"',
        '"2026-10-09";"8:00";"9:30";"Systemy operacyjne";"wykład";"on-line"'
    ];

    // BOM, żeby Excel poprawnie pokazał polskie znaki.
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "plan-zajec-wzor.csv";
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// "Wyczyść plan" z potwierdzeniem, tak jak przy usuwaniu zadań.
function renderClearButton() {
    clearScheduleArea.replaceChildren();

    if (schedule.length === 0) {
        return;
    }

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "delete-button";
    clearButton.textContent = "Wyczyść plan";

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "delete-button confirm";
    confirmButton.textContent = "Czy na pewno chcesz usunąć plan?";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "cancel-button";
    cancelButton.textContent = "Anuluj";

    clearButton.addEventListener("click", () => {
        clearScheduleArea.replaceChildren(confirmButton, cancelButton);
        confirmButton.focus();
    });

    cancelButton.addEventListener("click", () => {
        clearScheduleArea.replaceChildren(clearButton);
        clearButton.focus();
    });

    confirmButton.addEventListener("click", () => {
        schedule = [];
        saveSchedule();
        closeSettingsMenu();
        renderSchedule();
        showImportStatus("success", "Plan zajęć został usunięty.");
    });

    clearScheduleArea.appendChild(clearButton);
}

// ---------- Menu ustawień (zębatka) ----------

function openSettingsMenu() {
    scheduleSettingsMenu.hidden = false;
    scheduleSettingsButton.setAttribute("aria-expanded", "true");
    scheduleSettingsMenu.querySelector("button")?.focus();
}

function closeSettingsMenu() {
    scheduleSettingsMenu.hidden = true;
    scheduleSettingsButton.setAttribute("aria-expanded", "false");
    renderClearButton(); // przy następnym otwarciu znów "Wyczyść plan", a nie potwierdzenie
}

scheduleSettingsButton.addEventListener("click", () => {
    if (scheduleSettingsMenu.hidden) {
        openSettingsMenu();
    } else {
        closeSettingsMenu();
    }
});

// Kliknięcie poza menu je zamyka. composedPath() pamięta, gdzie kliknięto,
// nawet jeśli kliknięty przycisk został już podmieniony (np. "Wyczyść plan" -> potwierdzenie).
document.addEventListener("click", event => {
    if (!scheduleSettingsMenu.hidden && !event.composedPath().includes(scheduleSettings)) {
        closeSettingsMenu();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !scheduleSettingsMenu.hidden) {
        closeSettingsMenu();
        scheduleSettingsButton.focus();
    }
});

// ---------- Nawigacja po tygodniach ----------

prevWeekButton.addEventListener("click", () => {
    weekStart = addDays(weekStart, -7);
    renderSchedule();
});

nextWeekButton.addEventListener("click", () => {
    weekStart = addDays(weekStart, 7);
    renderSchedule();
});

thisWeekButton.addEventListener("click", () => {
    weekStart = getMonday(new Date());
    renderSchedule();
});

// ---------- Siatka tygodnia ----------

// Zajęcia nachodzące na siebie dzielą kolumnę dnia na "tory" obok siebie.
function layoutDay(entries) {
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

function createClassBlock({ entry, lane, lanes }, firstHour) {
    const startMinutes = toMinutes(entry.start);
    const endMinutes = toMinutes(entry.end);

    const block = document.createElement("div");
    block.className = "class-block";

    if (lanes > 1) {
        block.classList.add("narrow");
    }

    block.style.top = `${((startMinutes - firstHour * 60) / 60) * HOUR_HEIGHT}px`;
    block.style.height = `${((endMinutes - startMinutes) / 60) * HOUR_HEIGHT - 2}px`;
    block.style.left = `calc(${(lane / lanes) * 100}% + 2px)`;
    block.style.width = `calc(${100 / lanes}% - 4px)`;
    block.style.setProperty("--hue", getSubjectHue(entry.subject));

    const subject = document.createElement("strong");
    subject.className = "class-subject";
    subject.textContent = entry.subject;

    // Godzina i sala w jednej linii – sala jest najważniejsza, więc nie może zniknąć.
    const when = document.createElement("div");
    when.className = "class-when";

    const time = document.createElement("span");
    time.className = "class-time";
    time.textContent = `${entry.start}–${entry.end}`;
    when.appendChild(time);

    if (entry.room) {
        const room = document.createElement("span");
        room.className = "class-room";
        room.textContent = entry.room;
        when.appendChild(room);
    }

    block.append(subject, when);

    if (entry.type) {
        const type = document.createElement("span");
        type.className = "class-meta";
        type.textContent = entry.type;
        block.appendChild(type);
    }

    // Pełne informacje po najechaniu myszką.
    block.title = [
        entry.subject,
        `${formatDueDate(entry.date)}, ${entry.start}–${entry.end}`,
        entry.type,
        entry.room && `Sala: ${entry.room}`,
        entry.custom && "Własne zajęcia – kliknij, aby edytować lub usunąć"
    ].filter(Boolean).join("\n");

    // Własne zajęcia można kliknąć, żeby je edytować (openClassDialog z schedule-form.js).
    if (entry.custom) {
        block.classList.add("custom");
        block.tabIndex = 0;
        block.setAttribute("role", "button");
        block.setAttribute("aria-label", `Edytuj: ${entry.subject}, ${entry.start}–${entry.end}`);

        block.addEventListener("click", () => openClassDialog(entry));
        block.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openClassDialog(entry);
            }
        });
    }

    return block;
}

function renderSchedule() {
    renderClearButton();

    const hasSchedule = schedule.length > 0;
    scheduleEmpty.hidden = hasSchedule;
    scheduleWrapper.hidden = !hasSchedule;
    scheduleWeekNav.hidden = !hasSchedule;

    // Linia "teraz" powstaje na nowo tylko w kolumnie dzisiejszego dnia.
    nowLine = null;

    if (!hasSchedule) {
        scheduleWeekTitle.textContent = "Twoje zajęcia";
        weekEmptyNote.hidden = true;
        scheduleGrid.replaceChildren();
        return;
    }

    scheduleWeekTitle.textContent = formatWeekRange(weekStart);

    // Pon–Pt zawsze, weekend tylko jeśli plan ma zajęcia w weekendy (np. studia zaoczne).
    const hasWeekend = schedule.some(entry => parseDateString(entry.date).getDay() % 6 === 0);
    const dayCount = hasWeekend ? 7 : 5;
    const weekDates = Array.from({ length: dayCount }, (_, i) => toDateString(addDays(weekStart, i)));

    const weekEntries = schedule.filter(entry => weekDates.includes(entry.date));
    weekEmptyNote.hidden = weekEntries.length > 0;

    // Zakres godzin liczymy z całego planu, żeby siatka nie "skakała" między tygodniami.
    const earliest = Math.min(...schedule.map(entry => toMinutes(entry.start)));
    const latest = Math.max(...schedule.map(entry => toMinutes(entry.end)));
    const firstHour = Math.min(8, Math.floor(earliest / 60));
    const lastHour = Math.max(18, Math.ceil(latest / 60));
    const bodyHeight = (lastHour - firstHour) * HOUR_HEIGHT;

    gridFirstHour = firstHour;
    gridLastHour = lastHour;

    const today = getTodayString();

    scheduleGrid.replaceChildren();
    scheduleGrid.style.gridTemplateColumns = `56px repeat(${dayCount}, minmax(110px, 1fr))`;
    scheduleGrid.style.setProperty("--hour-height", `${HOUR_HEIGHT}px`);

    // Wiersz nagłówków: pusty róg + nazwy dni z datą.
    scheduleGrid.appendChild(document.createElement("div"));

    weekDates.forEach((dateString, i) => {
        const date = parseDateString(dateString);

        const header = document.createElement("div");
        header.className = "schedule-day-header";

        const name = document.createElement("span");
        name.textContent = DAY_NAMES[i];

        const dayDate = document.createElement("span");
        dayDate.className = "schedule-day-date";
        dayDate.textContent = `${date.getDate()}.${String(date.getMonth() + 1).padStart(2, "0")}`;

        header.append(name, dayDate);

        if (dateString === today) {
            header.classList.add("today");
        }

        scheduleGrid.appendChild(header);
    });

    // Kolumna z godzinami.
    const hours = document.createElement("div");
    hours.className = "schedule-hours";
    hours.style.height = `${bodyHeight}px`;

    for (let hour = firstHour; hour < lastHour; hour++) {
        const label = document.createElement("span");
        label.textContent = `${hour}:00`;
        label.style.top = `${(hour - firstHour) * HOUR_HEIGHT}px`;
        hours.appendChild(label);
    }

    scheduleGrid.appendChild(hours);

    // Kolumny dni z zajęciami.
    weekDates.forEach(dateString => {
        const column = document.createElement("div");
        column.className = "schedule-day-column";
        column.style.height = `${bodyHeight}px`;

        if (dateString === today) {
            column.classList.add("today");

            nowLine = document.createElement("div");
            nowLine.className = "now-line";
            nowLine.setAttribute("aria-hidden", "true");

            const nowLabel = document.createElement("span");
            nowLabel.className = "now-label";
            nowLine.appendChild(nowLabel);

            column.appendChild(nowLine);
        }

        const dayEntries = weekEntries.filter(entry => entry.date === dateString);

        layoutDay(dayEntries).forEach(placed => {
            column.appendChild(createClassBlock(placed, firstHour));
        });

        scheduleGrid.appendChild(column);
    });

    renderedForDate = today;
    updateNowLine();
}

// ---------- Linia aktualnej godziny ----------

let nowLine = null;        // element linii w kolumnie dzisiejszego dnia (albo null)
let gridFirstHour = 8;     // zakres godzin aktualnie narysowanej siatki
let gridLastHour = 18;
let renderedForDate = "";  // dla którego dnia narysowano siatkę

function updateNowLine() {
    // Po północy przerysowujemy siatkę, żeby linia przeszła do nowego dnia.
    if (schedule.length > 0 && renderedForDate !== getTodayString()) {
        renderSchedule();
        return;
    }

    if (!nowLine) {
        return;
    }

    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const inRange = minutes >= gridFirstHour * 60 && minutes <= gridLastHour * 60;

    nowLine.hidden = !inRange;

    if (inRange) {
        nowLine.style.top = `${((minutes - gridFirstHour * 60) / 60) * HOUR_HEIGHT}px`;
        nowLine.firstChild.textContent = getCurrentTimeString();
    }
}

// Co 30 s przesuwamy linię; po powrocie do karty od razu, bo przeglądarka
// spowalnia liczniki w kartach w tle.
setInterval(updateNowLine, 30 * 1000);

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        updateNowLine();
    }
});

renderSchedule();
