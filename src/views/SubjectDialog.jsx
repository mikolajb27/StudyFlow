// Okno dodawania / edycji przedmiotu.

import { useRef, useState } from "react";
import { useAppData } from "../AppData.jsx";
import { ConfirmDelete } from "../components/ConfirmDelete.jsx";
import { Dialog } from "../components/Dialog.jsx";
import { createSubject, findSubjectByName, parseEcts } from "../lib/subjects.js";

// subject – edytowany przedmiot albo null (nowy).
export function SubjectDialog({ subject, onClose, onSaved }) {
    const { subjects, setSubjects, tasks, grades, deleteSubject } = useAppData();
    const isEdit = subject !== null;

    const [form, setForm] = useState({
        name: subject?.name ?? "",
        lecturer: subject?.lecturer ?? "",
        ects: subject?.ects ?? "",
        assessment: subject?.assessment ?? ""
    });

    const [error, setError] = useState("");

    const nameRef = useRef(null);
    const ectsRef = useRef(null);

    function update(field, value) {
        setForm(current => ({ ...current, [field]: value }));
    }

    function showError(message, ref) {
        setError(message);
        ref.current?.focus();
    }

    function handleSubmit(event) {
        event.preventDefault();

        const name = form.name.trim();
        const lecturer = form.lecturer.trim();
        const assessment = form.assessment.trim();
        const ects = parseEcts(form.ects);

        if (name === "") {
            return showError("Podaj nazwę przedmiotu.", nameRef);
        }

        const duplicate = findSubjectByName(subjects, name);

        if (duplicate && duplicate.id !== subject?.id) {
            return showError(`Przedmiot „${duplicate.name}” jest już na liście.`, nameRef);
        }

        // Pole liczbowe zwraca "" także dla tekstu, którego nie da się odczytać.
        if (ects === undefined || ectsRef.current.validity.badInput) {
            return showError("Liczba ECTS musi być liczbą od 0 do 60.", ectsRef);
        }

        if (isEdit) {
            setSubjects(list => list.map(item => (
                item.id === subject.id ? { ...item, name, lecturer, ects, assessment } : item
            )));
            onSaved(`Zapisano zmiany: „${name}”.`);
        } else {
            setSubjects(list => [...list, createSubject({ name, lecturer, ects, assessment })]);
            onSaved(`Dodano przedmiot „${name}”.`);
        }
    }

    // Usuwanie: zadania zostają bez przedmiotu, oceny są usuwane.
    const taskCount = isEdit ? tasks.filter(task => task.subjectId === subject.id).length : 0;
    const gradeCount = isEdit ? grades.filter(grade => grade.subjectId === subject.id).length : 0;

    // "Usuń (zadania: 2 zostaną bez przedmiotu, oceny: 3 zostaną usunięte)"
    const consequences = [
        taskCount > 0 && `zadania: ${taskCount} zostaną bez przedmiotu`,
        gradeCount > 0 && `oceny: ${gradeCount} zostaną usunięte`
    ].filter(Boolean);

    return (
        <Dialog labelledBy="subjectDialogTitle" onClose={onClose} initialFocusRef={nameRef}>
            <form className="dialog-body" noValidate onSubmit={handleSubmit}>
                <h3 id="subjectDialogTitle">{isEdit ? "Edytuj przedmiot" : "Dodaj przedmiot"}</h3>

                <label className="field">
                    <span>Nazwa przedmiotu <span className="required-mark">*</span></span>
                    <input type="text" ref={nameRef} className="form-field" maxLength={100}
                        placeholder="np. Analiza matematyczna"
                        value={form.name} onChange={event => update("name", event.target.value)} />
                </label>

                <label className="field">
                    <span>Prowadzący</span>
                    <input type="text" className="form-field" maxLength={100} placeholder="np. dr Anna Kowalska"
                        value={form.lecturer} onChange={event => update("lecturer", event.target.value)} />
                </label>

                <div className="field-row">
                    <label className="field">
                        <span>Forma zaliczenia</span>
                        <input type="text" className="form-field" maxLength={60} list="subjectAssessmentOptions"
                            placeholder="np. egzamin"
                            value={form.assessment} onChange={event => update("assessment", event.target.value)} />
                    </label>

                    <label className="field field-small">
                        <span>ECTS</span>
                        <input type="number" ref={ectsRef} className="form-field" min="0" max="60" step="0.5"
                            inputMode="decimal" placeholder="np. 5"
                            value={form.ects} onChange={event => update("ects", event.target.value)} />
                    </label>
                </div>

                <datalist id="subjectAssessmentOptions">
                    <option value="egzamin" />
                    <option value="zaliczenie na ocenę" />
                    <option value="zaliczenie" />
                    <option value="projekt" />
                </datalist>

                {error && <p className="field-error" role="alert">{error}</p>}

                <div className="dialog-actions">
                    {isEdit && (
                        <ConfirmDelete
                            className="dialog-delete"
                            cancelLabel="Nie usuwaj"
                            actions={[{
                                label: consequences.length > 0
                                    ? `Usuń (${consequences.join(", ")})`
                                    : "Czy na pewno chcesz usunąć?",
                                onConfirm: () => {
                                    deleteSubject(subject.id);
                                    onSaved(`Usunięto przedmiot „${subject.name}”.`);
                                }
                            }]}
                        />
                    )}

                    <button type="button" className="cancel-button" onClick={onClose}>Anuluj</button>
                    <button type="submit">{isEdit ? "Zapisz zmiany" : "Dodaj przedmiot"}</button>
                </div>
            </form>
        </Dialog>
    );
}
