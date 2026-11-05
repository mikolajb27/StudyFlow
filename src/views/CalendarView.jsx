// KALENDARZ ZADAŃ: siatka miesiąca i lista zadań wybranego dnia.

import { useAppData } from "../AppData.jsx";
import { useNavigation } from "../Navigation.jsx";
import { SubjectBadge } from "../components/SubjectBadge.jsx";
import { capitalize, formatDueDate, getTodayString, parseDateString, toDateString } from "../lib/dates.js";
import { getSubjectHue } from "../lib/schedule.js";
import { isOverdue } from "../lib/tasks.js";

// Ile zadań mieści się w jednym polu dnia, zanim pokażemy "+N więcej".
const MAX_CHIPS_PER_DAY = 3;

const WEEKDAYS = ["PN", "WT", "ŚR", "CZ", "PT", "SO", "ND"];

// Zadania z godziną najpierw (rosnąco), zadania bez godziny na końcu.
function compareByTime(a, b) {
    return (a.dueTime || "99:99").localeCompare(b.dueTime || "99:99");
}

// Grupujemy zadania według dnia: { "2026-11-05": [zadanie, ...] }.
function groupByDate(tasks) {
    const byDate = {};

    tasks.forEach(task => {
        if (task.dueDate) {
            (byDate[task.dueDate] ||= []).push(task);
        }
    });

    Object.values(byDate).forEach(list => list.sort(compareByTime));

    return byDate;
}

export function CalendarView() {
    const { tasks } = useAppData();
    const { selectedDate, setSelectedDate, calendarMonth, setCalendarMonth, openTaskForm } = useNavigation();

    const tasksByDate = groupByDate(tasks);
    const today = getTodayString();

    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Tydzień zaczyna się w poniedziałek (getDay(): 0 = niedziela).
    const offset = (calendarMonth.getDay() + 6) % 7;
    const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;

    const days = Array.from({ length: cellCount }, (_, i) => new Date(year, month, 1 - offset + i));

    function changeMonth(step) {
        setCalendarMonth(new Date(year, month + step, 1));
    }

    function goToToday() {
        const now = new Date();
        setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
        setSelectedDate(getTodayString());
    }

    function selectDay(date) {
        setSelectedDate(toDateString(date));

        // Kliknięcie dnia z sąsiedniego miesiąca przełącza miesiąc.
        setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }

    return (
        <div className="calendar-layout">
            <section className="calendar-section">
                <div className="calendar-header">
                    <div>
                        <p className="subtitle">MIESIĄC</p>
                        <h2>{capitalize(calendarMonth.toLocaleDateString("pl-PL", { month: "long", year: "numeric" }))}</h2>
                    </div>

                    <div className="calendar-nav">
                        <button type="button" id="prevMonth" aria-label="Poprzedni miesiąc" onClick={() => changeMonth(-1)}>
                            &lsaquo;
                        </button>
                        <button type="button" onClick={goToToday}>Dziś</button>
                        <button type="button" id="nextMonth" aria-label="Następny miesiąc" onClick={() => changeMonth(1)}>
                            &rsaquo;
                        </button>
                    </div>
                </div>

                <div className="calendar-weekdays" aria-hidden="true">
                    {WEEKDAYS.map(day => <div key={day}>{day}</div>)}
                </div>

                <div className="calendar-grid">
                    {days.map(date => {
                        const dateString = toDateString(date);
                        const dayTasks = tasksByDate[dateString] || [];

                        return (
                            <CalendarDay
                                key={dateString}
                                date={date}
                                tasks={dayTasks}
                                otherMonth={date.getMonth() !== month}
                                isToday={dateString === today}
                                isSelected={dateString === selectedDate}
                                onSelect={() => selectDay(date)}
                            />
                        );
                    })}
                </div>
            </section>

            <aside className="day-panel" aria-live="polite">
                <p className="subtitle">WYBRANY DZIEŃ</p>
                <h3>
                    {capitalize(parseDateString(selectedDate).toLocaleDateString("pl-PL", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric"
                    }))}
                </h3>

                <DayTaskList tasks={tasksByDate[selectedDate] || []} />

                <button
                    type="button"
                    className="day-panel-add"
                    onClick={() => openTaskForm({ dueDate: selectedDate })}
                >
                    + Dodaj zadanie na ten dzień
                </button>
            </aside>
        </div>
    );
}

function CalendarDay({ date, tasks, otherMonth, isToday, isSelected, onSelect }) {
    const { getSubject } = useAppData();
    const dateString = toDateString(date);

    const className = [
        "calendar-day",
        otherMonth && "other-month",
        isToday && "today",
        isSelected && "selected"
    ].filter(Boolean).join(" ");

    return (
        <button
            type="button"
            className={className}
            aria-pressed={isSelected}
            aria-label={`${formatDueDate(dateString)}, zadania: ${tasks.length}`}
            onClick={onSelect}
        >
            <div className="calendar-day-top">
                <span className="calendar-day-number">{date.getDate()}</span>

                {/* Na telefonie zamiast listy zadań pokazujemy tylko ich liczbę. */}
                <span className="calendar-count" hidden={tasks.length === 0}>{tasks.length}</span>
            </div>

            <div className="calendar-chips">
                {tasks.slice(0, MAX_CHIPS_PER_DAY).map(task => {
                    const subject = getSubject(task.subjectId);

                    const chipClass = [
                        "calendar-chip",
                        task.completed ? "completed" : isOverdue(task) && "overdue",
                        subject && "has-subject"
                    ].filter(Boolean).join(" ");

                    // Godzina i przedmiot tylko w podpowiedzi po najechaniu myszką.
                    const title = [
                        task.dueTime ? `${task.dueTime} – ${task.title}` : task.title,
                        subject && `Przedmiot: ${subject.name}`
                    ].filter(Boolean).join("\n");

                    return (
                        <span
                            key={task.id}
                            className={chipClass}
                            title={title}
                            style={subject ? { "--hue": getSubjectHue(subject.name) } : undefined}
                        >
                            {task.title}
                        </span>
                    );
                })}

                {tasks.length > MAX_CHIPS_PER_DAY && (
                    <span className="calendar-more">+{tasks.length - MAX_CHIPS_PER_DAY} więcej</span>
                )}
            </div>
        </button>
    );
}

function DayTaskList({ tasks }) {
    const { getSubject, updateTask } = useAppData();

    if (tasks.length === 0) {
        return (
            <div className="day-task-list">
                <p className="empty-message">Brak zadań na ten dzień.</p>
            </div>
        );
    }

    return (
        <div className="day-task-list">
            {tasks.map(task => {
                const subject = getSubject(task.subjectId);
                const overdue = !task.completed && isOverdue(task);

                return (
                    <label key={task.id} className={`day-task${task.completed ? " completed" : ""}`}>
                        <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={event => updateTask(task.id, { completed: event.target.checked })}
                        />

                        <div className="task-content">
                            <span className="task-title">{task.title}</span>

                            <div className="task-meta">
                                {subject && <SubjectBadge subject={subject} />}
                                <span className={`task-due${overdue ? " overdue" : ""}`}>
                                    {task.dueTime ? `godz. ${task.dueTime}` : "Cały dzień"}
                                    {overdue && " · po terminie"}
                                </span>
                            </div>

                            {task.description && <p className="task-description">{task.description}</p>}
                        </div>
                    </label>
                );
            })}
        </div>
    );
}
