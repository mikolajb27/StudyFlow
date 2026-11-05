// Zadania: terminy, sortowanie, grupowanie.
// Zadanie: { id, title, description, dueDate "RRRR-MM-DD", dueTime "GG:MM" | "", subjectId | null, completed }

import {
    daysFromToday,
    formatCountdown,
    formatDueDate,
    getCurrentTimeString,
    getTodayString,
    pluralDays,
    toDateTime
} from "./dates.js";

export function isOverdue(task) {
    // Zadanie bez daty nigdy nie jest po terminie.
    if (!task.dueDate) {
        return false;
    }

    const today = getTodayString();

    if (task.dueDate !== today) {
        return task.dueDate < today;
    }

    return Boolean(task.dueTime) && task.dueTime < getCurrentTimeString();
}

// "20 listopada 2026, godz. 10:00 (dziś)" + czy zadanie jest po terminie.
export function getDueLabel(task) {
    if (!task.dueDate) {
        return { label: "brak daty", overdue: false };
    }

    let label = formatDueDate(task.dueDate);

    if (task.dueTime) {
        label += `, godz. ${task.dueTime}`;
    }

    if (!task.completed && isOverdue(task)) {
        return { label: `${label} (po terminie)`, overdue: true };
    }

    if (task.dueDate === getTodayString()) {
        label += " (dziś)";
    }

    return { label, overdue: false };
}

// Najpierw najwcześniejszy termin; zadania bez godziny na końcu danego dnia.
export function compareTasksByDue(a, b) {
    const keyA = `${a.dueDate || "9999-99-99"} ${a.dueTime || "99:99"}`;
    const keyB = `${b.dueDate || "9999-99-99"} ${b.dueTime || "99:99"}`;

    return keyA.localeCompare(keyB);
}

// Moment terminu zadania; zadanie bez godziny liczymy do końca dnia.
export function getDueMoment(task) {
    return toDateTime(task.dueDate, task.dueTime || "23:59");
}

// "za 3 godz. 10 min", "dziś", "jutro", "za 4 dni"
export function formatDueCountdown(task, now = new Date()) {
    const days = daysFromToday(task.dueDate);

    if (task.dueTime && getDueMoment(task) - now < 24 * 60 * 60 * 1000) {
        return formatCountdown(getDueMoment(task), now);
    }

    if (days === 0) return "dziś";
    if (days === 1) return "jutro";

    return `za ${pluralDays(days)}`;
}

// Grupa zadania na liście "Do zrobienia".
export function getTodoGroup(task) {
    if (!task.dueDate) return "Bez terminu";
    if (isOverdue(task)) return "Po terminie";

    const days = daysFromToday(task.dueDate);

    if (days === 0) return "Dziś";
    if (days === 1) return "Jutro";
    if (days < 7) return "W ciągu tygodnia";

    return "Później";
}
