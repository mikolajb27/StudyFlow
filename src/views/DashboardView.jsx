// DASHBOARD: najbliższe zajęcia, najbliższe zadanie i lista rzeczy do zrobienia.

import { Fragment, useEffect, useRef } from "react";
import { useAppData } from "../AppData.jsx";
import { useNavigation } from "../Navigation.jsx";
import { SubjectBadge, subjectHueStyle } from "../components/SubjectBadge.jsx";
import { useNow } from "../hooks/useNow.js";
import { capitalize, formatCountdown, formatRelativeDay, daysFromToday, getCurrentTimeString, toDateTime } from "../lib/dates.js";
import { getSubjectHue, getUpcomingClasses } from "../lib/schedule.js";
import { findSubjectByName } from "../lib/subjects.js";
import { compareTasksByDue, formatDueCountdown, getDueLabel, getTodoGroup, isOverdue } from "../lib/tasks.js";

const MAX_TODO_ITEMS = 8;

export function DashboardView() {
    // Odliczanie ("za 25 min", "Trwa teraz") odświeżamy co minutę.
    const now = useNow();

    return (
        <>
            <section className="dashboard-overview">
                <article className="overview-card">
                    <p className="subtitle">NAJBLIŻSZE ZAJĘCIA</p>
                    <div className="overview-body">
                        <NextClass now={now} />
                    </div>
                </article>

                <article className="overview-card">
                    <p className="subtitle">NAJBLIŻSZE ZADANIE</p>
                    <div className="overview-body">
                        <NextDue now={now} />
                    </div>
                </article>
            </section>

            <TodoSection />
        </>
    );
}

function EmptyState({ text, linkText, onClick }) {
    return (
        <div className="overview-empty">
            <p>{text}</p>
            {linkText && (
                <button type="button" className="link-button" onClick={onClick}>{linkText}</button>
            )}
        </div>
    );
}

// ---------- Najbliższe zajęcia ----------

function NextClass({ now }) {
    const { schedule, subjects, tasks } = useAppData();
    const { navigate, showInSchedule } = useNavigation();

    const upcoming = getUpcomingClasses(schedule, now);
    const next = upcoming[0];

    if (!next) {
        return schedule.length === 0
            ? <EmptyState text="Nie masz jeszcze planu zajęć." linkText="Zaimportuj plan zajęć" onClick={() => navigate("plan-zajec")} />
            : <EmptyState text="Brak nadchodzących zajęć w planie." linkText="Otwórz plan zajęć" onClick={() => navigate("plan-zajec")} />;
    }

    const isNow = daysFromToday(next.date) === 0 && next.start <= getCurrentTimeString(now);
    const details = [next.type, next.room && `sala ${next.room}`].filter(Boolean);
    const after = upcoming[1];

    // Otwarte zadania z tego przedmiotu – przypomnienie przed zajęciami.
    const subject = findSubjectByName(subjects, next.subject);
    const openCount = subject
        ? tasks.filter(task => task.subjectId === subject.id && !task.completed).length
        : 0;

    return (
        <>
            <div className="next-class" style={{ "--hue": getSubjectHue(next.subject) }}>
                <p className={`overview-status${isNow ? " live" : ""}`}>
                    {isNow
                        ? `Trwa teraz · do ${next.end}`
                        : capitalize(formatCountdown(toDateTime(next.date, next.start), now))}
                </p>

                <h3 className="overview-title">{next.subject}</h3>
                <p className="overview-when">{formatRelativeDay(next.date)}, {next.start}–{next.end}</p>

                {details.length > 0 && <p className="overview-meta">{details.join(" · ")}</p>}

                {openCount > 0 && (
                    <p className="overview-reminder">Zadania do zrobienia z tego przedmiotu: {openCount}</p>
                )}
            </div>

            <div className="overview-footer">
                {after && (
                    <p className="overview-after">
                        Potem: {after.subject} ·{" "}
                        {after.date === next.date ? after.start : `${formatRelativeDay(after.date)}, ${after.start}`}
                    </p>
                )}

                <button type="button" className="link-button" onClick={() => showInSchedule(next.date)}>
                    Plan zajęć →
                </button>
            </div>
        </>
    );
}

// ---------- Najbliższe zadanie ----------

function NextDue({ now }) {
    const { tasks, getSubject } = useAppData();
    const { openTaskForm, openTaskPreview } = useNavigation();

    const openTasks = tasks.filter(task => !task.completed && task.dueDate).sort(compareTasksByDue);
    const overdue = openTasks.filter(isOverdue);
    const next = openTasks.find(task => !isOverdue(task));
    const subject = next && getSubject(next.subjectId);

    return (
        <>
            {next ? (
                <div className="next-due" style={subjectHueStyle(subject)}>
                    <p className={`overview-status${daysFromToday(next.dueDate) === 0 ? " soon" : ""}`}>
                        {capitalize(formatDueCountdown(next, now))}
                    </p>

                    <button
                        type="button"
                        className="overview-title overview-task preview-trigger"
                        data-task-id={next.id}
                        aria-label={`Podgląd zadania: ${next.title}`}
                        onClick={() => openTaskPreview(next.id)}
                    >
                        {next.title}
                    </button>

                    <p className="overview-when">{getDueLabel(next).label}</p>

                    {subject && (
                        <div className="overview-badges">
                            <SubjectBadge subject={subject} />
                        </div>
                    )}
                </div>
            ) : (
                <EmptyState
                    text={openTasks.length === 0 ? "Nie masz zadań z terminem do zrobienia." : "Brak nadchodzących terminów."}
                    linkText="Dodaj zadanie"
                    onClick={() => openTaskForm()}
                />
            )}

            {overdue.length > 0 && (
                <p className="overview-warning">
                    {overdue.length === 1 ? "1 zadanie jest po terminie" : `Zadania po terminie: ${overdue.length}`}
                </p>
            )}
        </>
    );
}

// ---------- Do zrobienia ----------

function TodoSection() {
    const { tasks, updateTask } = useAppData();
    const { openTaskForm } = useNavigation();

    const listRef = useRef(null);
    const addButtonRef = useRef(null);
    const focusIndexAfterUpdate = useRef(null);

    const openTasks = tasks.filter(task => !task.completed).sort(compareTasksByDue);
    const shown = openTasks.slice(0, MAX_TODO_ITEMS);
    const hidden = openTasks.length - shown.length;

    // Zadania pogrupowane: [{ name, tasks }], w kolejności terminów.
    const groups = [];

    shown.forEach(task => {
        const name = getTodoGroup(task);
        const last = groups[groups.length - 1];

        if (last && last.name === name) {
            last.tasks.push(task);
        } else {
            groups.push({ name, tasks: [task] });
        }
    });

    // Po ukończeniu zadanie znika z listy – fokus przechodzi na kolejne zadanie.
    useEffect(() => {
        if (focusIndexAfterUpdate.current === null) {
            return;
        }

        const index = focusIndexAfterUpdate.current;
        const checkboxes = listRef.current.querySelectorAll(".todo-item input");
        focusIndexAfterUpdate.current = null;

        (checkboxes[index] || checkboxes[index - 1] || addButtonRef.current)?.focus();
    }, [tasks]);

    function complete(task) {
        focusIndexAfterUpdate.current = shown.indexOf(task);
        updateTask(task.id, { completed: true });
    }

    return (
        <section className="tasks-section todo-section">
            <div className="section-header todo-header">
                <div>
                    <p className="subtitle">DO ZROBIENIA</p>
                    <h2>Zadania do zrobienia</h2>
                </div>

                <button type="button" ref={addButtonRef} onClick={() => openTaskForm()}>+ Dodaj zadanie</button>
            </div>

            <div className="todo-list" ref={listRef}>
                {openTasks.length === 0 && (
                    <EmptyState
                        text={tasks.length === 0
                            ? "Nie masz jeszcze żadnych zadań."
                            : "Wszystko zrobione! Nie masz zadań do zrobienia."}
                        linkText="Dodaj zadanie"
                        onClick={() => openTaskForm()}
                    />
                )}

                {groups.map(group => (
                    <Fragment key={group.name}>
                        <h3 className={`todo-group${group.name === "Po terminie" ? " overdue" : ""}`}>{group.name}</h3>

                        <ul className="todo-items">
                            {group.tasks.map(task => (
                                <TodoItem key={task.id} task={task} onComplete={() => complete(task)} />
                            ))}
                        </ul>
                    </Fragment>
                ))}
            </div>

            {tasks.length > 0 && (
                <a href="#zadania" className="todo-show-all">
                    {hidden > 0
                        ? `Zobacz wszystkie zadania (jeszcze ${hidden} do zrobienia) →`
                        : "Zobacz wszystkie zadania →"}
                </a>
            )}
        </section>
    );
}

function TodoItem({ task, onComplete }) {
    const { getSubject } = useAppData();
    const { openTaskPreview } = useNavigation();

    const subject = getSubject(task.subjectId);
    const due = getDueLabel(task);

    return (
        <li className={`todo-item${subject ? " has-subject" : ""}`} style={subjectHueStyle(subject)}>
            <input
                type="checkbox"
                checked={false}
                aria-label={`Oznacz jako ukończone: ${task.title}`}
                onChange={onComplete}
            />

            <button
                type="button"
                className="todo-body preview-trigger"
                data-task-id={task.id}
                aria-label={`Podgląd zadania: ${task.title}`}
                onClick={() => openTaskPreview(task.id)}
            >
                <span className="todo-title">{task.title}</span>

                <span className="todo-meta">
                    {subject && <SubjectBadge subject={subject} />}
                    <span className={`todo-due${due.overdue ? " overdue" : ""}`}>{due.label}</span>
                </span>
            </button>
        </li>
    );
}
