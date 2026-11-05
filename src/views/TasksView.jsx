// MOJE ZADANIA: statystyki, formularz dodawania i pełna lista zadań.

import { useEffect, useRef, useState } from "react";
import { useAppData } from "../AppData.jsx";
import { useNavigation } from "../Navigation.jsx";
import { ConfirmDelete } from "../components/ConfirmDelete.jsx";
import { SubjectBadge } from "../components/SubjectBadge.jsx";
import { sortSubjects } from "../lib/subjects.js";
import { getDueLabel } from "../lib/tasks.js";

export function TasksView() {
    const { tasks } = useAppData();

    const completed = tasks.filter(task => task.completed).length;
    const percent = tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100);

    return (
        <>
            <section className="stats">
                <StatCard label="Wszystkie zadania" value={tasks.length} />
                <StatCard label="Ukończone" value={completed} />
                <StatCard label="Pozostałe" value={tasks.length - completed} />
                <StatCard label="Procent ukończonych" value={`${percent}%`} />
            </section>

            <section className="tasks-section">
                <div className="section-header">
                    <div>
                        <p className="subtitle">ORGANIZACJA</p>
                        <h2>Dodaj zadanie</h2>
                    </div>
                </div>

                <TaskForm />
                <TaskList />
            </section>
        </>
    );
}

function StatCard({ label, value }) {
    return (
        <div className="stat-card">
            <p>{label}</p>
            <h2>{value}</h2>
        </div>
    );
}

const EMPTY_FORM = { title: "", description: "", subjectId: "", dueDate: "", dueTime: "" };

function TaskForm() {
    const { subjects, getSubject, setTasks } = useAppData();
    const { taskFormRequest } = useNavigation();

    const [form, setForm] = useState(EMPTY_FORM);
    const [dueDateError, setDueDateError] = useState("");
    const titleRef = useRef(null);
    const dueDateRef = useRef(null);

    const sorted = sortSubjects(subjects);

    // Przejście z kalendarza / karty przedmiotu: wpisujemy datę albo przedmiot i ustawiamy fokus.
    useEffect(() => {
        if (!taskFormRequest) {
            return;
        }

        setForm(current => ({
            ...current,
            dueDate: taskFormRequest.dueDate ?? current.dueDate,
            subjectId: taskFormRequest.subjectId ?? current.subjectId
        }));

        if (taskFormRequest.dueDate) {
            setDueDateError("");
        }

        titleRef.current?.focus();
    }, [taskFormRequest]);

    // Usunięty przedmiot nie może zostać wybrany.
    const subjectId = getSubject(form.subjectId) ? form.subjectId : "";

    function update(field, value) {
        setForm(current => ({ ...current, [field]: value }));
    }

    function handleSubmit(event) {
        event.preventDefault();

        const title = form.title.trim();

        if (title === "") {
            return;
        }

        // Termin jest obowiązkowy.
        if (form.dueDate === "") {
            setDueDateError("Dodaj termin zadania, zanim je zapiszesz.");
            dueDateRef.current?.focus();
            return;
        }

        setTasks(list => [...list, {
            id: crypto.randomUUID(),
            title,
            description: form.description.trim(),
            dueDate: form.dueDate,
            dueTime: form.dueTime, // "" gdy nie wybrano godziny
            subjectId: subjectId || null,
            completed: false
        }]);

        setForm(EMPTY_FORM);
        setDueDateError("");
        titleRef.current?.focus();
    }

    return (
        <form id="taskForm" onSubmit={handleSubmit}>
            <input
                type="text"
                id="taskInput"
                ref={titleRef}
                className="form-field"
                placeholder="Co masz dzisiaj do zrobienia?"
                required
                value={form.title}
                onChange={event => update("title", event.target.value)}
            />

            <textarea
                id="taskDescription"
                className="form-field"
                rows="3"
                placeholder="Opis (opcjonalnie)"
                value={form.description}
                onChange={event => update("description", event.target.value)}
            />

            <div className="form-row">
                <label htmlFor="taskSubject">Przedmiot</label>
                <select
                    id="taskSubject"
                    className="form-field"
                    value={subjectId}
                    disabled={sorted.length === 0}
                    title={sorted.length === 0 ? "Dodaj przedmioty w zakładce Przedmioty" : undefined}
                    onChange={event => update("subjectId", event.target.value)}
                >
                    <option value="">{sorted.length === 0 ? "Brak przedmiotów" : "Bez przedmiotu"}</option>
                    {sorted.map(subject => (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                </select>

                <label htmlFor="taskDueDate">Termin <span className="required-mark">*</span></label>
                <input
                    type="date"
                    id="taskDueDate"
                    ref={dueDateRef}
                    className={[
                        "form-field",
                        form.dueDate === "" && "is-empty",
                        dueDateError && "invalid"
                    ].filter(Boolean).join(" ")}
                    aria-required="true"
                    aria-describedby="dueDateError"
                    value={form.dueDate}
                    onChange={event => {
                        update("dueDate", event.target.value);
                        setDueDateError("");
                    }}
                />

                <label htmlFor="taskDueTime">Godzina</label>
                <input
                    type="time"
                    id="taskDueTime"
                    className={`form-field${form.dueTime === "" ? " is-empty" : ""}`}
                    title="Opcjonalnie"
                    value={form.dueTime}
                    onChange={event => update("dueTime", event.target.value)}
                />

                <span id="dueDateError" className="field-error" role="alert" hidden={!dueDateError}>
                    {dueDateError}
                </span>

                <button type="submit">+ Dodaj zadanie</button>
            </div>
        </form>
    );
}

function TaskList() {
    const { tasks, setTasks, updateTask, getSubject } = useAppData();

    if (tasks.length === 0) {
        return (
            <div className="task-list">
                <p className="empty-message">Nie masz jeszcze żadnych zadań.</p>
            </div>
        );
    }

    return (
        <div className="task-list">
            {tasks.map(task => {
                const subject = getSubject(task.subjectId);
                const due = task.dueDate ? getDueLabel(task) : null;

                return (
                    <div key={task.id} className={`task-item${task.completed ? " completed" : ""}`}>
                        <div className="task-left">
                            <input
                                type="checkbox"
                                checked={task.completed}
                                onChange={event => updateTask(task.id, { completed: event.target.checked })}
                            />

                            <div className="task-content">
                                <span className="task-title">{task.title}</span>

                                {task.description && <p className="task-description">{task.description}</p>}

                                {(subject || due) && (
                                    <div className="task-meta">
                                        {subject && <SubjectBadge subject={subject} />}
                                        {due && (
                                            <span className={`task-due${due.overdue ? " overdue" : ""}`}>
                                                Termin: {due.label}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <ConfirmDelete
                            className="task-actions"
                            actions={[{
                                label: "Czy na pewno chcesz usunąć?",
                                onConfirm: () => setTasks(list => list.filter(other => other.id !== task.id))
                            }]}
                        />
                    </div>
                );
            })}
        </div>
    );
}
