// PRZEDMIOTY: lista przedmiotów z importem CSV, dodawaniem i edycją.
// Karta przedmiotu pokazuje najbliższe zajęcia z planu, oceny i zadania z tego przedmiotu.

import { useRef, useState } from "react";
import { useAppData } from "../AppData.jsx";
import { useNavigation } from "../Navigation.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { useNow } from "../hooks/useNow.js";
import { downloadCsv, MAX_FILE_SIZE, readFileText } from "../lib/csv.js";
import { capitalize, formatDueDate, parseDateString } from "../lib/dates.js";
import { getSubjectGradeSummary } from "../lib/grades.js";
import { getNextClassOf, getSubjectHue } from "../lib/schedule.js";
import {
    createSubject,
    formatEcts,
    getMissingScheduleSubjects,
    hasEcts,
    mergeSubjects,
    readSubjects,
    sortSubjects,
    SUBJECT_TEMPLATE
} from "../lib/subjects.js";
import { compareTasksByDue, isOverdue } from "../lib/tasks.js";
import { SubjectDialog } from "./SubjectDialog.jsx";

const MAX_TASKS_ON_CARD = 3;

export function SubjectsView() {
    const { subjects, setSubjects, schedule } = useAppData();

    const [status, setStatus] = useState(null);

    // Okno przedmiotu: undefined = zamknięte, null = nowy przedmiot, obiekt = edycja.
    const [editedSubject, setEditedSubject] = useState(undefined);

    // Przedmioty z rozwiniętą listą zadań.
    const [expanded, setExpanded] = useState(() => new Set());

    const fileRef = useRef(null);
    const missing = getMissingScheduleSubjects(schedule, subjects);

    function toggleExpanded(id) {
        setExpanded(current => {
            const next = new Set(current);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    }

    // ---------- Import CSV ----------

    async function handleFile(event) {
        const file = event.target.files[0];
        event.target.value = "";

        if (!file) {
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setStatus({ kind: "error", message: "Plik jest za duży (maks. 2 MB)." });
            return;
        }

        const result = readSubjects(await readFileText(file));

        if (result.fatal) {
            setStatus({ kind: "error", message: `Nie udało się wczytać pliku „${file.name}”. ${result.fatal}` });
            return;
        }

        if (result.items.length === 0) {
            setStatus({ kind: "error", message: `W pliku „${file.name}” nie ma żadnych przedmiotów.`, details: result.errors });
            return;
        }

        const merged = mergeSubjects(subjects, result.items);
        setSubjects(merged.subjects);

        const parts = [`nowe: ${merged.added}`];

        if (merged.updated > 0) parts.push(`zaktualizowane: ${merged.updated}`);
        if (merged.unchanged > 0) parts.push(`bez zmian: ${merged.unchanged}`);

        const message = `Zaimportowano przedmioty z pliku „${file.name}” (${parts.join(", ")}).`;

        setStatus(result.errors.length > 0
            ? { kind: "warning", message: `${message} Uwagi:`, details: result.errors }
            : { kind: "success", message });
    }

    function addMissingFromSchedule() {
        setSubjects(list => [...list, ...missing.map(name => createSubject({ name }))]);
        setStatus({
            kind: "success",
            message: `Dodano przedmioty z planu zajęć (${missing.length}). ` +
                "Możesz je teraz uzupełnić o prowadzącego i punkty ECTS."
        });
    }

    return (
        <section className="subjects-section">
            <div className="schedule-header">
                <div>
                    <p className="subtitle">TWOJE STUDIA</p>
                    <h2>Przedmioty</h2>
                </div>

                <div className="schedule-actions">
                    <button type="button" className="secondary-button"
                        onClick={() => downloadCsv("przedmioty-wzor.csv", SUBJECT_TEMPLATE)}>
                        Pobierz wzór CSV
                    </button>

                    <button type="button" className="secondary-button" onClick={() => fileRef.current.click()}>
                        Importuj CSV
                    </button>

                    <button type="button" onClick={() => setEditedSubject(null)}>+ Dodaj przedmiot</button>

                    <input type="file" ref={fileRef} accept=".csv,text/csv" hidden onChange={handleFile} />
                </div>
            </div>

            <StatusMessage status={status} />

            {missing.length > 0 && (
                <div className="subjects-hint">
                    <p>
                        {missing.length === 1
                            ? `W planie zajęć jest przedmiot, którego nie ma na liście: ${missing[0]}.`
                            : `W planie zajęć są przedmioty, których nie ma na liście (${missing.length}): ` +
                              `${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}.`}
                    </p>

                    <button type="button" className="secondary-button" onClick={addMissingFromSchedule}>
                        {missing.length === 1 ? "Dodaj go" : "Dodaj wszystkie"}
                    </button>
                </div>
            )}

            {subjects.length === 0 ? (
                <SubjectsEmpty />
            ) : (
                <div className="subject-grid">
                    {sortSubjects(subjects).map(subject => (
                        <SubjectCard
                            key={subject.id}
                            subject={subject}
                            expanded={expanded.has(subject.id)}
                            onToggleExpanded={() => toggleExpanded(subject.id)}
                            onEdit={() => setEditedSubject(subject)}
                        />
                    ))}
                </div>
            )}

            {editedSubject !== undefined && (
                <SubjectDialog
                    subject={editedSubject}
                    onClose={() => setEditedSubject(undefined)}
                    onSaved={message => {
                        setEditedSubject(undefined);
                        setStatus({ kind: "success", message });
                    }}
                />
            )}
        </section>
    );
}

function SubjectsEmpty() {
    return (
        <div className="schedule-empty">
            <p>
                Nie masz jeszcze przedmiotów. Dodaj je ręcznie albo zaimportuj plik CSV.
                Aplikacja odczyta kolumny:
            </p>

            <ul>
                <li><strong>nazwa_przedmiotu</strong> – wymagana</li>
                <li><strong>prowadzacy, ects, forma_zaliczenia</strong> – opcjonalne</li>
            </ul>

            <pre>{'"nazwa_przedmiotu";"prowadzacy";"ects";"forma_zaliczenia"\n' +
                '"Analiza matematyczna";"dr Anna Kowalska";"6";"egzamin"'}</pre>

            <p className="schedule-hint">
                Możesz też zaimportować plik z planem zajęć – każdy przedmiot zostanie dodany raz.
                Ponowny import nie usuwa przedmiotów, tylko dodaje nowe i uzupełnia istniejące.
            </p>
        </div>
    );
}

// "Wt., 10 listopada, 08:00–09:30 · wykład · sala 1.38"
function formatClass(entry) {
    const date = capitalize(
        parseDateString(entry.date).toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "long" })
    );

    return [`${date}, ${entry.start}–${entry.end}`, entry.type, entry.room && `sala ${entry.room}`]
        .filter(Boolean)
        .join(" · ");
}

function SubjectCard({ subject, expanded, onToggleExpanded, onEdit }) {
    const { tasks, grades, schedule } = useAppData();
    const { openTaskForm } = useNavigation();
    const now = useNow();

    const details = [subject.lecturer, hasEcts(subject) && formatEcts(subject.ects), subject.assessment].filter(Boolean);
    const nextClass = getNextClassOf(schedule, subject.name, now);
    const gradeSummary = getSubjectGradeSummary(grades, subject.id);

    const subjectTasks = tasks.filter(task => task.subjectId === subject.id);
    const done = subjectTasks.filter(task => task.completed).length;

    // Zwinięte – najbliższe nieukończone, rozwinięte – wszystkie (nieukończone według terminu, potem ukończone).
    const openTasks = subjectTasks.filter(task => !task.completed).sort(compareTasksByDue);
    const doneTasks = subjectTasks.filter(task => task.completed).sort(compareTasksByDue);
    const shown = expanded ? [...openTasks, ...doneTasks] : openTasks.slice(0, MAX_TASKS_ON_CARD);
    const hiddenCount = subjectTasks.length - shown.length;

    let toggleLabel = null;

    if (expanded) {
        toggleLabel = "Zwiń listę";
    } else if (hiddenCount > 0) {
        toggleLabel = openTasks.length === 0
            ? `Pokaż ukończone (${hiddenCount})`
            : `Pokaż wszystkie (${subjectTasks.length})`;
    }

    return (
        <article className="subject-card" style={{ "--hue": getSubjectHue(subject.name) }}>
            <div className="subject-card-header">
                <h3>{subject.name}</h3>

                <button type="button" className="secondary-button subject-edit"
                    aria-label={`Edytuj przedmiot: ${subject.name}`} onClick={onEdit}>
                    Edytuj
                </button>
            </div>

            {details.length > 0 && <p className="subject-meta">{details.join(" · ")}</p>}

            {nextClass && (
                <p className="subject-next">
                    <span>Najbliższe zajęcia</span>
                    {formatClass(nextClass)}
                </p>
            )}

            {gradeSummary && <p className="subject-grades">{gradeSummary}</p>}

            <div className="subject-progress">
                <span>
                    {subjectTasks.length === 0 ? "Brak zadań" : `Zadania: ${done} z ${subjectTasks.length} ukończone`}
                </span>

                <div className="subject-bar" aria-hidden="true">
                    <div style={{ width: subjectTasks.length === 0 ? "0%" : `${(done / subjectTasks.length) * 100}%` }} />
                </div>
            </div>

            {shown.length > 0 && (
                <ul className="subject-tasks">
                    {shown.map(task => (
                        <li key={task.id}>
                            <SubjectTaskButton task={task} />
                        </li>
                    ))}
                </ul>
            )}

            {toggleLabel && (
                <button type="button" className="subject-tasks-toggle" aria-expanded={expanded} onClick={onToggleExpanded}>
                    {toggleLabel}
                </button>
            )}

            <button
                type="button"
                className="secondary-button subject-add-task"
                aria-label={`Dodaj zadanie z przedmiotu: ${subject.name}`}
                onClick={() => openTaskForm({ subjectId: subject.id })}
            >
                + Dodaj zadanie
            </button>
        </article>
    );
}

// Wiersz zadania na karcie przedmiotu (tytuł + termin), otwiera podgląd.
function SubjectTaskButton({ task }) {
    const { openTaskPreview } = useNavigation();
    const overdue = !task.completed && isOverdue(task);

    return (
        <button
            type="button"
            className={`subject-task preview-trigger${task.completed ? " completed" : ""}`}
            data-task-id={task.id}
            aria-label={`Podgląd zadania: ${task.title}`}
            onClick={() => openTaskPreview(task.id)}
        >
            <span className="subject-task-title">{task.title}</span>
            <span className={`subject-task-due${overdue ? " overdue" : ""}`}>
                {formatDueDate(task.dueDate)}
                {overdue && " (po terminie)"}
            </span>
        </button>
    );
}
