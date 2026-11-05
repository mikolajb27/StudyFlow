// OCENY: oceny cząstkowe (z wagą) i końcowe, średnie przedmiotów, średnia ważona ECTS.

import { useState } from "react";
import { useAppData } from "../AppData.jsx";
import { useNavigation } from "../Navigation.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { formatDueDate } from "../lib/dates.js";
import {
    formatAverage,
    formatGrade,
    getGradeLevel,
    getOverallAverages,
    getSubjectGrades,
    getWeightedAverage
} from "../lib/grades.js";
import { getSubjectHue } from "../lib/schedule.js";
import { formatEcts, hasEcts, sortSubjects } from "../lib/subjects.js";
import { GradeDialog } from "./GradeDialog.jsx";

export function GradesView() {
    const { subjects, grades } = useAppData();
    const { navigate } = useNavigation();

    const [status, setStatus] = useState(null);

    // Okno oceny: null = zamknięte, { grade } = edycja, { subjectId } = nowa ocena.
    const [dialog, setDialog] = useState(null);

    const sorted = sortSubjects(subjects);
    const withGrades = sorted.filter(subject => grades.some(grade => grade.subjectId === subject.id));
    const withoutGrades = sorted.filter(subject => !withGrades.includes(subject));

    const openNew = subjectId => setDialog({ grade: null, subjectId });
    const openEdit = grade => setDialog({ grade, subjectId: grade.subjectId });

    return (
        <>
            <GradeSummary />

            <section className="subjects-section">
                <div className="schedule-header">
                    <div>
                        <p className="subtitle">WYNIKI</p>
                        <h2>Twoje oceny</h2>
                    </div>

                    <div className="schedule-actions">
                        <button type="button" disabled={subjects.length === 0} onClick={() => openNew(null)}>
                            + Dodaj ocenę
                        </button>
                    </div>
                </div>

                <StatusMessage status={status} />

                {subjects.length === 0 && (
                    <div className="schedule-empty">
                        <p>
                            Oceny przypisujesz do przedmiotów, a nie masz jeszcze żadnego.
                            Dodaj przedmioty ręcznie albo zaimportuj je z pliku CSV.
                        </p>
                        <button type="button" className="secondary-button" onClick={() => navigate("przedmioty")}>
                            Przejdź do przedmiotów
                        </button>
                    </div>
                )}

                {subjects.length > 0 && grades.length === 0 && (
                    <p className="schedule-hint grades-hint">
                        Nie masz jeszcze ocen. Dodaj ocenę cząstkową (np. z kolokwium, z wagą)
                        albo od razu ocenę końcową z przedmiotu – aplikacja policzy średnie,
                        także średnią ważoną punktami ECTS.
                    </p>
                )}

                <div className="grade-list">
                    {withGrades.map(subject => (
                        <GradeSubjectCard key={subject.id} subject={subject} onAdd={openNew} onEdit={openEdit} />
                    ))}

                    {/* Przedmioty bez ocen – krótka lista z szybkim dodawaniem. */}
                    {withoutGrades.length > 0 && (
                        <section className="grade-pending">
                            <h3 className="todo-group">
                                {withGrades.length > 0 ? "Przedmioty bez ocen" : "Twoje przedmioty"}
                            </h3>

                            <ul>
                                {withoutGrades.map(subject => (
                                    <li key={subject.id} style={{ "--hue": getSubjectHue(subject.name) }}>
                                        <span>{subject.name}</span>
                                        <AddGradeButton subject={subject} label="+ Ocena" onAdd={openNew} />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            </section>

            {dialog && (
                <GradeDialog
                    grade={dialog.grade}
                    subjectId={dialog.subjectId}
                    onClose={() => setDialog(null)}
                    onSaved={message => {
                        setDialog(null);
                        setStatus({ kind: "success", message });
                    }}
                />
            )}
        </>
    );
}

// ---------- Podsumowanie ----------

function GradeSummary() {
    const { subjects, grades } = useAppData();

    const partial = getWeightedAverage(grades);
    const { simple, ects, finalCount, ectsCount, ectsSum } = getOverallAverages(subjects, grades);

    return (
        <section className="stats">
            <SummaryCard
                label="Średnia ocen cząstkowych"
                value={partial === null ? "–" : formatAverage(partial)}
                hint={partial === null ? "Brak ocen cząstkowych" : "Ważona, ze wszystkich przedmiotów"}
            />
            <SummaryCard
                label="Średnia ocen końcowych"
                value={simple === null ? "–" : formatAverage(simple)}
                hint={finalCount === 0 ? "Brak ocen końcowych" : `Przedmioty z oceną końcową: ${finalCount}`}
            />
            <SummaryCard
                label="Średnia ważona ECTS"
                value={ects === null ? "–" : formatAverage(ects)}
                hint={ects === null
                    ? "Potrzebne oceny końcowe i ECTS przedmiotów"
                    : `Z ${ectsCount} przedm. (${formatEcts(ectsSum)})`}
            />
            <SummaryCard label="Liczba ocen" value={grades.length} />
        </section>
    );
}

function SummaryCard({ label, value, hint }) {
    return (
        <div className="stat-card">
            <p>{label}</p>
            <h2>{value}</h2>
            {hint && <span className="stat-hint">{hint}</span>}
        </div>
    );
}

// ---------- Karta przedmiotu ----------

function AddGradeButton({ subject, label = "+ Dodaj ocenę", onAdd }) {
    return (
        <button
            type="button"
            className="secondary-button grade-add"
            aria-label={`Dodaj ocenę z przedmiotu: ${subject.name}`}
            onClick={() => onAdd(subject.id)}
        >
            {label}
        </button>
    );
}

function GradeSubjectCard({ subject, onAdd, onEdit }) {
    const { grades } = useAppData();

    const list = getSubjectGrades(grades, subject.id);
    const partial = list.filter(grade => !grade.final);
    const final = list.find(grade => grade.final);
    const average = getWeightedAverage(list);
    const details = [hasEcts(subject) && formatEcts(subject.ects), subject.assessment].filter(Boolean);

    return (
        <article className="grade-subject" style={{ "--hue": getSubjectHue(subject.name) }}>
            {/* Nagłówek: nazwa + szczegóły, po prawej średnia i ocena końcowa. */}
            <div className="grade-subject-header">
                <div>
                    <h3>{subject.name}</h3>
                    {details.length > 0 && <p className="grade-subject-meta">{details.join(" · ")}</p>}
                </div>

                <div className="grade-results">
                    <div className="grade-result">
                        <span className="grade-result-label">Średnia</span>
                        <strong className={average === null ? undefined : `level-${getGradeLevel(average)}`}>
                            {average === null ? "–" : formatAverage(average)}
                        </strong>
                    </div>

                    {final ? (
                        <button
                            type="button"
                            className={`grade-result grade-final level-${getGradeLevel(final.value)}`}
                            title="Kliknij, aby edytować ocenę końcową"
                            aria-label={`Edytuj ocenę końcową: ${formatGrade(final.value)}`}
                            onClick={() => onEdit(final)}
                        >
                            <span className="grade-result-label">Końcowa</span>
                            <strong>{formatGrade(final.value)}</strong>
                        </button>
                    ) : (
                        <div className="grade-result grade-final">
                            <span className="grade-result-label">Końcowa</span>
                            <strong>–</strong>
                        </div>
                    )}
                </div>
            </div>

            {partial.length > 0 ? (
                <div className="grade-chips">
                    {partial.map(grade => <GradeChip key={grade.id} grade={grade} onEdit={onEdit} />)}
                </div>
            ) : (
                <p className="grade-none">Brak ocen cząstkowych.</p>
            )}

            <AddGradeButton subject={subject} onAdd={onAdd} />
        </article>
    );
}

function GradeChip({ grade, onEdit }) {
    const description = [
        `Ocena ${formatGrade(grade.value)}`,
        grade.label,
        grade.weight !== 1 && `waga ${formatGrade(grade.weight)}`,
        grade.date && formatDueDate(grade.date)
    ].filter(Boolean).join(", ");

    return (
        <button
            type="button"
            className={`grade-chip level-${getGradeLevel(grade.value)}`}
            title={`${description}\nKliknij, aby edytować`}
            aria-label={`Edytuj ocenę: ${description}`}
            onClick={() => onEdit(grade)}
        >
            <span className="grade-chip-value">{formatGrade(grade.value)}</span>
            {grade.label && <span className="grade-chip-label">{grade.label}</span>}
            {grade.weight !== 1 && <span className="grade-chip-weight">waga {formatGrade(grade.weight)}</span>}
        </button>
    );
}
