// Okno dodawania / edycji oceny.

import { useRef, useState } from "react";
import { useAppData } from "../AppData.jsx";
import { ConfirmDelete } from "../components/ConfirmDelete.jsx";
import { Dialog } from "../components/Dialog.jsx";
import { getTodayString } from "../lib/dates.js";
import { formatGrade, getFinalGrade, GRADE_OPTIONS } from "../lib/grades.js";
import { sortSubjects } from "../lib/subjects.js";

// grade – ocena do edycji (null = nowa), subjectId – przedmiot wybrany od razu (albo null).
export function GradeDialog({ grade, subjectId, onClose, onSaved }) {
    const { subjects, grades, setGrades, getSubject } = useAppData();
    const isEdit = grade !== null;
    const sorted = sortSubjects(subjects);

    const [form, setForm] = useState(() => ({
        subjectId: grade?.subjectId ?? subjectId ?? sorted[0]?.id ?? "",
        value: grade ? String(grade.value) : "",
        weight: grade ? String(grade.weight) : "1",
        label: grade?.label ?? "",
        date: grade ? grade.date : getTodayString(),
        final: grade?.final ?? false
    }));

    const [error, setError] = useState("");

    const subjectRef = useRef(null);
    const valueRef = useRef(null);
    const weightRef = useRef(null);

    function update(field, value) {
        setForm(current => ({ ...current, [field]: value }));
    }

    function showError(message, ref) {
        setError(message);
        ref.current?.focus();
    }

    // Ocena końcowa nie ma wagi; ostrzegamy, jeśli zastąpi inną ocenę końcową przedmiotu.
    const existingFinal = getFinalGrade(grades, form.subjectId);
    const replacesFinal = form.final && existingFinal && existingFinal.id !== grade?.id;

    function handleSubmit(event) {
        event.preventDefault();

        const subject = getSubject(form.subjectId);
        const value = Number(form.value);
        const weight = form.final ? 1 : Number(form.weight);
        const label = form.label.trim();

        if (!subject) {
            return showError("Wybierz przedmiot.", subjectRef);
        }

        if (form.value === "") {
            return showError("Wybierz ocenę.", valueRef);
        }

        // Pole liczbowe zwraca "" dla pustej albo nieczytelnej wartości.
        if (!form.final && (form.weight === "" || weight <= 0 || weight > 100)) {
            return showError("Waga musi być liczbą większą od 0 (np. 1 albo 2).", weightRef);
        }

        const data = { subjectId: subject.id, value, weight, label, date: form.date, final: form.final };

        setGrades(list => {
            // Jedna ocena końcowa na przedmiot – poprzednia zostaje zastąpiona.
            const kept = replacesFinal ? list.filter(item => item.id !== existingFinal.id) : list;

            return isEdit
                ? kept.map(item => (item.id === grade.id ? { ...item, ...data } : item))
                : [...kept, { id: crypto.randomUUID(), ...data }];
        });

        if (isEdit) {
            onSaved(`Zapisano zmiany oceny z przedmiotu „${subject.name}”.`);
        } else if (form.final) {
            onSaved(`Dodano ocenę końcową ${formatGrade(value)} z przedmiotu „${subject.name}”.`);
        } else {
            onSaved(`Dodano ocenę ${formatGrade(value)} z przedmiotu „${subject.name}”.`);
        }
    }

    return (
        // Gdy przedmiot jest już wybrany, zaczynamy od oceny.
        <Dialog labelledBy="gradeDialogTitle" onClose={onClose} initialFocusRef={isEdit || subjectId ? valueRef : subjectRef}>
            <form className="dialog-body" noValidate onSubmit={handleSubmit}>
                <h3 id="gradeDialogTitle">{isEdit ? "Edytuj ocenę" : "Dodaj ocenę"}</h3>

                <label className="field">
                    <span>Przedmiot <span className="required-mark">*</span></span>
                    <select ref={subjectRef} className="form-field" value={form.subjectId}
                        onChange={event => update("subjectId", event.target.value)}>
                        {sorted.map(subject => (
                            <option key={subject.id} value={subject.id}>{subject.name}</option>
                        ))}
                    </select>
                </label>

                <div className="field-row">
                    <label className="field">
                        <span>Ocena <span className="required-mark">*</span></span>
                        <select ref={valueRef} className="form-field" value={form.value}
                            onChange={event => update("value", event.target.value)}>
                            <option value="">Wybierz ocenę</option>
                            {GRADE_OPTIONS.map(option => (
                                <option key={option.value} value={String(option.value)}>{option.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="field field-small">
                        <span>Waga</span>
                        <input type="number" ref={weightRef} className="form-field" min="0.5" max="100" step="0.5"
                            inputMode="decimal" disabled={form.final}
                            value={form.weight} onChange={event => update("weight", event.target.value)} />
                    </label>
                </div>

                <div className="field-row">
                    <label className="field">
                        <span>Za co</span>
                        <input type="text" className="form-field" maxLength={80} list="gradeLabelOptions"
                            placeholder="np. Kolokwium 1"
                            value={form.label} onChange={event => update("label", event.target.value)} />
                    </label>

                    <label className="field field-date">
                        <span>Data</span>
                        <input type="date" className="form-field"
                            value={form.date} onChange={event => update("date", event.target.value)} />
                    </label>
                </div>

                <datalist id="gradeLabelOptions">
                    {["Kolokwium", "Egzamin", "Projekt", "Sprawozdanie", "Kartkówka", "Aktywność", "Prezentacja"]
                        .map(option => <option key={option} value={option} />)}
                </datalist>

                <div className="repeat-row">
                    <label className="checkbox-label">
                        <input type="checkbox" checked={form.final}
                            onChange={event => update("final", event.target.checked)} />
                        Ocena końcowa z przedmiotu
                    </label>
                </div>

                {replacesFinal && (
                    <p className="field-note">
                        Ten przedmiot ma już ocenę końcową ({formatGrade(existingFinal.value)}) – nowa ją zastąpi.
                    </p>
                )}

                {error && <p className="field-error" role="alert">{error}</p>}

                <div className="dialog-actions">
                    {isEdit && (
                        <ConfirmDelete
                            className="dialog-delete"
                            cancelLabel="Nie usuwaj"
                            actions={[{
                                label: "Czy na pewno chcesz usunąć?",
                                onConfirm: () => {
                                    setGrades(list => list.filter(item => item.id !== grade.id));
                                    onSaved(`Usunięto ocenę ${formatGrade(grade.value)}.`);
                                }
                            }]}
                        />
                    )}

                    <button type="button" className="cancel-button" onClick={onClose}>Anuluj</button>
                    <button type="submit">{isEdit ? "Zapisz zmiany" : "Dodaj ocenę"}</button>
                </div>
            </form>
        </Dialog>
    );
}
