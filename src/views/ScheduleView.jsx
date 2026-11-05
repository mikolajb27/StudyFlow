// PLAN ZAJĘĆ: plan importowany z pliku CSV (jeden wiersz = jedne zajęcia w konkretnym dniu)
// plus własne zajęcia, wyświetlany tydzień po tygodniu.

import { useEffect, useRef, useState } from "react";
import { useAppData } from "../AppData.jsx";
import { useNavigation } from "../Navigation.jsx";
import { ConfirmDelete } from "../components/ConfirmDelete.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { useDismiss } from "../hooks/useDismiss.js";
import { useNow } from "../hooks/useNow.js";
import { downloadCsv, MAX_FILE_SIZE, readFileText } from "../lib/csv.js";
import {
    addDays,
    formatDueDate,
    formatWeekRange,
    getCurrentTimeString,
    getMonday,
    getTodayString,
    parseDateString,
    toDateString,
    toMinutes
} from "../lib/dates.js";
import { getSubjectHue, layoutDay, readSchedule, SCHEDULE_TEMPLATE } from "../lib/schedule.js";
import { ClassDialog } from "./ClassDialog.jsx";

const DAY_NAMES = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
const HOUR_HEIGHT = 56; // wysokość jednej godziny w siatce (px)

export function ScheduleView() {
    const { schedule, setSchedule } = useAppData();
    const { scheduleWeek, setScheduleWeek } = useNavigation();

    const [status, setStatus] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Okno własnych zajęć: undefined = zamknięte, null = nowe zajęcia, obiekt = edycja.
    const [editedClass, setEditedClass] = useState(undefined);

    const fileRef = useRef(null);
    const hasSchedule = schedule.length > 0;

    // ---------- Import ----------

    async function handleFile(event) {
        const file = event.target.files[0];
        event.target.value = ""; // pozwala wczytać ten sam plik ponownie

        if (!file) {
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setStatus({ kind: "error", message: "Plik jest za duży (maks. 2 MB)." });
            return;
        }

        const result = readSchedule(await readFileText(file));

        if (result.fatal) {
            setStatus({ kind: "error", message: `Nie udało się wczytać pliku „${file.name}”. ${result.fatal}` });
            return;
        }

        if (result.entries.length === 0) {
            setStatus({
                kind: "error",
                message: `W pliku „${file.name}” nie ma żadnych poprawnych zajęć.`,
                details: result.errors
            });
            return;
        }

        const replaced = schedule.some(entry => !entry.custom);
        const customEntries = schedule.filter(entry => entry.custom);

        // Nowy plan z pliku zastępuje stary, ale własne zajęcia użytkownika zostają.
        setSchedule([...result.entries, ...customEntries]);

        // Pokazujemy bieżący tydzień, a jeśli plan go nie obejmuje – pierwszy tydzień planu.
        const dates = result.entries.map(entry => entry.date).sort();
        const first = dates[0];
        const last = dates[dates.length - 1];
        const today = getTodayString();

        setScheduleWeek(getMonday(today >= first && today <= last ? new Date() : parseDateString(first)));

        let message =
            `Zaimportowano plan z pliku „${file.name}”: liczba zajęć ${result.entries.length}, ` +
            `od ${formatDueDate(first)} do ${formatDueDate(last)}.`;

        if (replaced) {
            message += " Nowy plan zastąpił poprzedni.";
        }

        if (customEntries.length > 0) {
            message += " Twoje własne zajęcia zostały zachowane.";
        }

        setStatus(result.errors.length > 0
            ? { kind: "warning", message: `${message} Pominięto wiersze z błędami:`, details: result.errors }
            : { kind: "success", message });
    }

    // Po zapisaniu zajęć: przejście do tygodnia z zajęciami i komunikat.
    function handleClassSaved(message, date) {
        if (date) {
            setScheduleWeek(getMonday(parseDateString(date)));
        }

        setEditedClass(undefined);
        setStatus({ kind: "success", message });
    }

    return (
        <section className="schedule-section">
            <div className="schedule-header">
                <div>
                    <p className="subtitle">TYDZIEŃ</p>
                    <h2>{hasSchedule ? formatWeekRange(scheduleWeek) : "Twoje zajęcia"}</h2>
                </div>

                {hasSchedule && (
                    <div className="calendar-nav">
                        <button type="button" id="prevWeek" aria-label="Poprzedni tydzień"
                            onClick={() => setScheduleWeek(addDays(scheduleWeek, -7))}>
                            &lsaquo;
                        </button>
                        <button type="button" onClick={() => setScheduleWeek(getMonday(new Date()))}>Dziś</button>
                        <button type="button" id="nextWeek" aria-label="Następny tydzień"
                            onClick={() => setScheduleWeek(addDays(scheduleWeek, 7))}>
                            &rsaquo;
                        </button>
                    </div>
                )}

                <div className="schedule-actions">
                    <button type="button" className="secondary-button"
                        onClick={() => downloadCsv("plan-zajec-wzor.csv", SCHEDULE_TEMPLATE)}>
                        Pobierz wzór CSV
                    </button>

                    <button type="button" onClick={() => fileRef.current.click()}>Importuj CSV</button>

                    <SettingsMenu
                        open={settingsOpen}
                        onOpenChange={setSettingsOpen}
                        hasSchedule={hasSchedule}
                        onAddClass={() => {
                            setSettingsOpen(false);
                            setEditedClass(null);
                        }}
                        onClear={() => {
                            setSchedule([]);
                            setSettingsOpen(false);
                            setStatus({ kind: "success", message: "Plan zajęć został usunięty." });
                        }}
                    />

                    <input type="file" ref={fileRef} accept=".csv,text/csv" hidden onChange={handleFile} />
                </div>
            </div>

            <StatusMessage status={status} />

            {hasSchedule
                ? <WeekGrid weekStart={scheduleWeek} onEditClass={setEditedClass} />
                : <ScheduleEmpty />}

            {editedClass !== undefined && (
                <ClassDialog
                    entry={editedClass}
                    weekStart={scheduleWeek}
                    onClose={() => setEditedClass(undefined)}
                    onSaved={handleClassSaved}
                />
            )}
        </section>
    );
}

function ScheduleEmpty() {
    return (
        <div className="schedule-empty">
            <p>
                Nie masz jeszcze planu zajęć. Zaimportuj plik CSV z planem
                (np. eksport z systemu uczelni). Aplikacja odczyta kolumny:
            </p>

            <ul>
                <li><strong>data, poczatek, koniec, nazwa_przedmiotu</strong> – wymagane</li>
                <li><strong>rodzaj_zajec, nr_sali</strong> – opcjonalne</li>
            </ul>

            <pre>{'"data";"poczatek";"koniec";"nazwa_przedmiotu";"rodzaj_zajec";"nr_sali"\n' +
                '"2026-10-01";"9:45";"11:15";"Higiena cyfrowa";"wykład";"1.38"'}</pre>

            <p className="schedule-hint">
                Pozostałe kolumny (np. prowadzący, budynek, grupa) są pomijane.
                Data może mieć format 2026-10-01 albo 01.10.2026.
                Możesz też dodać własne zajęcia w ustawieniach planu (ikona zębatki).
            </p>
        </div>
    );
}

// ---------- Menu ustawień (zębatka) ----------

function SettingsMenu({ open, onOpenChange, hasSchedule, onAddClass, onClear }) {
    const wrapperRef = useRef(null);
    const buttonRef = useRef(null);
    const firstItemRef = useRef(null);

    // Kliknięcie poza menu albo Esc je zamyka.
    useDismiss(open, () => onOpenChange(false), wrapperRef, buttonRef);

    // Po otwarciu fokus na pierwszej opcji.
    useEffect(() => {
        if (open) {
            firstItemRef.current?.focus();
        }
    }, [open]);

    return (
        <div className="settings" ref={wrapperRef}>
            <button
                type="button"
                ref={buttonRef}
                className="icon-button"
                aria-label="Ustawienia planu"
                aria-haspopup="true"
                aria-expanded={open}
                title="Ustawienia planu"
                onClick={() => onOpenChange(!open)}
            >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
            </button>

            {open && (
                <div className="settings-menu">
                    <p className="settings-menu-title">Ustawienia planu</p>

                    <button type="button" ref={firstItemRef} className="secondary-button settings-menu-item" onClick={onAddClass}>
                        + Dodaj własne zajęcia
                    </button>

                    {/* "Wyczyść plan" z potwierdzeniem; po zamknięciu menu wraca do pierwszego kroku. */}
                    {hasSchedule && (
                        <ConfirmDelete
                            className="clear-schedule-area"
                            label="Wyczyść plan"
                            actions={[{ label: "Czy na pewno chcesz usunąć plan?", onConfirm: onClear }]}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

// ---------- Siatka tygodnia ----------

function WeekGrid({ weekStart, onEditClass }) {
    const { schedule } = useAppData();

    // Linia aktualnej godziny przesuwa się co 30 s (i przechodzi na nowy dzień po północy).
    const now = useNow(30 * 1000);
    const today = getTodayString();

    // Pon–Pt zawsze, weekend tylko jeśli plan ma zajęcia w weekendy (np. studia zaoczne).
    const hasWeekend = schedule.some(entry => parseDateString(entry.date).getDay() % 6 === 0);
    const dayCount = hasWeekend ? 7 : 5;
    const weekDates = Array.from({ length: dayCount }, (_, i) => toDateString(addDays(weekStart, i)));
    const weekEntries = schedule.filter(entry => weekDates.includes(entry.date));

    // Zakres godzin liczymy z całego planu, żeby siatka nie "skakała" między tygodniami.
    const earliest = Math.min(...schedule.map(entry => toMinutes(entry.start)));
    const latest = Math.max(...schedule.map(entry => toMinutes(entry.end)));
    const firstHour = Math.min(8, Math.floor(earliest / 60));
    const lastHour = Math.max(18, Math.ceil(latest / 60));
    const bodyHeight = (lastHour - firstHour) * HOUR_HEIGHT;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const nowInRange = nowMinutes >= firstHour * 60 && nowMinutes <= lastHour * 60;

    const hours = [];

    for (let hour = firstHour; hour < lastHour; hour++) {
        hours.push(hour);
    }

    return (
        <>
            {weekEntries.length === 0 && <p className="schedule-week-empty">Brak zajęć w tym tygodniu.</p>}

            <div className="schedule-scroll">
                <div
                    className="schedule-grid"
                    style={{
                        gridTemplateColumns: `56px repeat(${dayCount}, minmax(110px, 1fr))`,
                        "--hour-height": `${HOUR_HEIGHT}px`
                    }}
                >
                    {/* Wiersz nagłówków: pusty róg + nazwy dni z datą. */}
                    <div />

                    {weekDates.map((dateString, i) => {
                        const date = parseDateString(dateString);

                        return (
                            <div key={dateString} className={`schedule-day-header${dateString === today ? " today" : ""}`}>
                                <span>{DAY_NAMES[i]}</span>
                                <span className="schedule-day-date">
                                    {date.getDate()}.{String(date.getMonth() + 1).padStart(2, "0")}
                                </span>
                            </div>
                        );
                    })}

                    {/* Kolumna z godzinami. */}
                    <div className="schedule-hours" style={{ height: bodyHeight }}>
                        {hours.map(hour => (
                            <span key={hour} style={{ top: (hour - firstHour) * HOUR_HEIGHT }}>{hour}:00</span>
                        ))}
                    </div>

                    {/* Kolumny dni z zajęciami. */}
                    {weekDates.map(dateString => (
                        <div
                            key={dateString}
                            className={`schedule-day-column${dateString === today ? " today" : ""}`}
                            style={{ height: bodyHeight }}
                        >
                            {dateString === today && (
                                <div
                                    className="now-line"
                                    aria-hidden="true"
                                    hidden={!nowInRange}
                                    style={{ top: ((nowMinutes - firstHour * 60) / 60) * HOUR_HEIGHT }}
                                >
                                    <span className="now-label">{getCurrentTimeString(now)}</span>
                                </div>
                            )}

                            {layoutDay(weekEntries.filter(entry => entry.date === dateString)).map(placed => (
                                <ClassBlock key={placed.entry.id} {...placed} firstHour={firstHour} onEdit={onEditClass} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}

function ClassBlock({ entry, lane, lanes, firstHour, onEdit }) {
    const startMinutes = toMinutes(entry.start);
    const endMinutes = toMinutes(entry.end);

    const style = {
        top: ((startMinutes - firstHour * 60) / 60) * HOUR_HEIGHT,
        height: ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT - 2,
        left: `calc(${(lane / lanes) * 100}% + 2px)`,
        width: `calc(${100 / lanes}% - 4px)`,
        "--hue": getSubjectHue(entry.subject)
    };

    // Pełne informacje po najechaniu myszką.
    const title = [
        entry.subject,
        `${formatDueDate(entry.date)}, ${entry.start}–${entry.end}`,
        entry.type,
        entry.room && `Sala: ${entry.room}`,
        entry.custom && "Własne zajęcia – kliknij, aby edytować lub usunąć"
    ].filter(Boolean).join("\n");

    // Własne zajęcia można kliknąć, żeby je edytować.
    const editProps = entry.custom
        ? {
            tabIndex: 0,
            role: "button",
            "aria-label": `Edytuj: ${entry.subject}, ${entry.start}–${entry.end}`,
            onClick: () => onEdit(entry),
            onKeyDown: event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onEdit(entry);
                }
            }
        }
        : {};

    const className = ["class-block", lanes > 1 && "narrow", entry.custom && "custom"].filter(Boolean).join(" ");

    return (
        <div className={className} style={style} title={title} {...editProps}>
            <strong className="class-subject">{entry.subject}</strong>

            {/* Godzina i sala w jednej linii – sala jest najważniejsza, więc nie może zniknąć. */}
            <div className="class-when">
                <span className="class-time">{entry.start}–{entry.end}</span>
                {entry.room && <span className="class-room">{entry.room}</span>}
            </div>

            {entry.type && <span className="class-meta">{entry.type}</span>}
        </div>
    );
}
