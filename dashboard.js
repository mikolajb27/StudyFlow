// DASHBOARD
// Przegląd: najbliższe zajęcia, najbliższy termin zadania i lista rzeczy do zrobienia.
// Korzysta z script.js: tasks, saveTasks, renderTasks, getTodayString, getCurrentTimeString,
// isOverdue, getDueLabel, compareTasksByDue, navigateTo, taskInput,
// z calendar.js: parseDateString, capitalize,
// z schedule.js: schedule, weekStart, getMonday, getSubjectHue, renderSchedule,
// oraz z subjects.js: getSubject, findSubjectByName, createSubjectBadge, openTaskPreview.

const viewDashboardElement = document.querySelector("#viewDashboard");
const nextClassBody = document.querySelector("#nextClassBody");
const nextDueBody = document.querySelector("#nextDueBody");
const todoList = document.querySelector("#todoList");
const todoShowAll = document.querySelector("#todoShowAll");
const dashboardAddTaskButton = document.querySelector("#dashboardAddTask");

const MAX_TODO_ITEMS = 8;

// ---------- Czas względny ----------

// Data i godzina jako Date (czas lokalny).
function toDateTime(dateString, time) {
    const date = parseDateString(dateString);
    const [hours, minutes] = time.split(":").map(Number);
    date.setHours(hours, minutes);
    return date;
}

// Ile dni kalendarzowych od dziś (0 = dziś, 1 = jutro, -1 = wczoraj).
function daysFromToday(dateString) {
    const today = parseDateString(getTodayString());
    return Math.round((parseDateString(dateString) - today) / (24 * 60 * 60 * 1000));
}

function pluralDays(count) {
    return count === 1 ? "1 dzień" : `${count} dni`;
}

// "Dziś", "Jutro", "Czwartek" (w tym tygodniu), "Pon., 16 listopada" (później)
function formatRelativeDay(dateString) {
    const days = daysFromToday(dateString);
    const date = parseDateString(dateString);

    if (days === 0) return "Dziś";
    if (days === 1) return "Jutro";

    if (days > 1 && days < 7) {
        return capitalize(date.toLocaleDateString("pl-PL", { weekday: "long" }));
    }

    return capitalize(date.toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "long" }));
}

// Za ile minut / godzin / dni coś się zaczyna.
function formatCountdown(target) {
    const minutes = Math.round((target - new Date()) / 60000);

    if (minutes < 1) return "za chwilę";
    if (minutes < 60) return `za ${minutes} min`;

    if (minutes < 24 * 60) {
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        return rest === 0 ? `za ${hours} godz.` : `za ${hours} godz. ${rest} min`;
    }

    return `za ${pluralDays(Math.round(minutes / (24 * 60)))}`;
}

// ---------- Najbliższe zajęcia ----------

// Zajęcia, które trwają albo dopiero się zaczną, od najwcześniejszych.
function getUpcomingClasses() {
    const today = getTodayString();
    const nowTime = getCurrentTimeString();

    return schedule
        .filter(entry => entry.date > today || (entry.date === today && entry.end > nowTime))
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

function createEmptyState(text, linkText, onClick) {
    const wrapper = document.createElement("div");
    wrapper.className = "overview-empty";

    const message = document.createElement("p");
    message.textContent = text;
    wrapper.appendChild(message);

    if (linkText) {
        const link = document.createElement("button");
        link.type = "button";
        link.className = "link-button";
        link.textContent = linkText;
        link.addEventListener("click", onClick);
        wrapper.appendChild(link);
    }

    return wrapper;
}

// Przejście do planu zajęć na tydzień z danymi zajęciami.
function showClassInSchedule(entry) {
    weekStart = getMonday(parseDateString(entry.date)); // z schedule.js
    navigateTo("plan-zajec");
    renderSchedule();
}

function renderNextClass() {
    const upcoming = getUpcomingClasses();
    const next = upcoming[0];

    if (!next) {
        nextClassBody.replaceChildren(
            schedule.length === 0
                ? createEmptyState("Nie masz jeszcze planu zajęć.", "Zaimportuj plan zajęć", () => navigateTo("plan-zajec"))
                : createEmptyState("Brak nadchodzących zajęć w planie.", "Otwórz plan zajęć", () => navigateTo("plan-zajec"))
        );
        return;
    }

    const today = getTodayString();
    const isNow = next.date === today && next.start <= getCurrentTimeString();

    const block = document.createElement("div");
    block.className = "next-class";
    block.style.setProperty("--hue", getSubjectHue(next.subject));

    // Status: trwa / za ile się zaczyna
    const status = document.createElement("p");
    status.className = "overview-status";

    if (isNow) {
        status.classList.add("live");
        status.textContent = `Trwa teraz · do ${next.end}`;
    } else {
        status.textContent = capitalize(formatCountdown(toDateTime(next.date, next.start)));
    }

    const name = document.createElement("h3");
    name.className = "overview-title";
    name.textContent = next.subject;

    const when = document.createElement("p");
    when.className = "overview-when";
    when.textContent = `${formatRelativeDay(next.date)}, ${next.start}–${next.end}`;

    block.append(status, name, when);

    const details = [next.type, next.room && `sala ${next.room}`].filter(Boolean);

    if (details.length > 0) {
        const meta = document.createElement("p");
        meta.className = "overview-meta";
        meta.textContent = details.join(" · ");
        block.appendChild(meta);
    }

    // Otwarte zadania z tego przedmiotu – przypomnienie przed zajęciami.
    const subject = findSubjectByName(next.subject);
    const openCount = subject
        ? tasks.filter(task => task.subjectId === subject.id && !task.completed).length
        : 0;

    if (openCount > 0) {
        const reminder = document.createElement("p");
        reminder.className = "overview-reminder";
        reminder.textContent = `Zadania do zrobienia z tego przedmiotu: ${openCount}`;
        block.appendChild(reminder);
    }

    const footer = document.createElement("div");
    footer.className = "overview-footer";

    const after = upcoming[1];

    if (after) {
        const then = document.createElement("p");
        then.className = "overview-after";
        then.textContent = `Potem: ${after.subject} · ` +
            (after.date === next.date ? after.start : `${formatRelativeDay(after.date)}, ${after.start}`);
        footer.appendChild(then);
    }

    const link = document.createElement("button");
    link.type = "button";
    link.className = "link-button";
    link.textContent = "Plan zajęć →";
    link.addEventListener("click", () => showClassInSchedule(next));
    footer.appendChild(link);

    nextClassBody.replaceChildren(block, footer);
}

// ---------- Najbliższy termin ----------

// Moment terminu zadania; zadanie bez godziny liczymy do końca dnia.
function getDueMoment(task) {
    return toDateTime(task.dueDate, task.dueTime || "23:59");
}

function formatDueCountdown(task) {
    const days = daysFromToday(task.dueDate);

    if (task.dueTime && getDueMoment(task) - new Date() < 24 * 60 * 60 * 1000) {
        return formatCountdown(getDueMoment(task));
    }

    if (days === 0) return "dziś";
    if (days === 1) return "jutro";

    return `za ${pluralDays(days)}`;
}

function renderNextDue() {
    const openTasks = tasks.filter(task => !task.completed && task.dueDate).sort(compareTasksByDue);
    const overdue = openTasks.filter(isOverdue);
    const next = openTasks.find(task => !isOverdue(task));

    const children = [];

    if (next) {
        const block = document.createElement("div");
        block.className = "next-due";

        const subject = getSubject(next.subjectId);

        if (subject) {
            block.style.setProperty("--hue", getSubjectHue(subject.name));
        }

        const status = document.createElement("p");
        status.className = "overview-status";
        status.textContent = capitalize(formatDueCountdown(next));

        if (daysFromToday(next.dueDate) === 0) {
            status.classList.add("soon");
        }

        const title = document.createElement("button");
        title.type = "button";
        title.className = "overview-title overview-task preview-trigger";
        title.dataset.taskId = next.id;
        title.textContent = next.title;
        title.setAttribute("aria-label", `Podgląd zadania: ${next.title}`);
        title.addEventListener("click", () => openTaskPreview(next));

        const when = document.createElement("p");
        when.className = "overview-when";
        when.textContent = getDueLabel(next).label;

        block.append(status, title, when);

        if (subject) {
            const meta = document.createElement("div");
            meta.className = "overview-badges";
            meta.appendChild(createSubjectBadge(subject));
            block.appendChild(meta);
        }

        children.push(block);
    } else {
        children.push(createEmptyState(
            openTasks.length === 0 ? "Nie masz zadań z terminem do zrobienia." : "Brak nadchodzących terminów.",
            "Dodaj zadanie",
            goToTaskForm
        ));
    }

    if (overdue.length > 0) {
        const warning = document.createElement("p");
        warning.className = "overview-warning";
        warning.textContent = overdue.length === 1
            ? "1 zadanie jest po terminie"
            : `Zadania po terminie: ${overdue.length}`;
        children.push(warning);
    }

    nextDueBody.replaceChildren(...children);
}

// ---------- Do zrobienia ----------

// Grupa zadania na liście: po terminie / dziś / jutro / w tym tygodniu / później.
function getTodoGroup(task) {
    if (!task.dueDate) return "Bez terminu";
    if (isOverdue(task)) return "Po terminie";

    const days = daysFromToday(task.dueDate);

    if (days === 0) return "Dziś";
    if (days === 1) return "Jutro";
    if (days < 7) return "W ciągu tygodnia";

    return "Później";
}

function createTodoItem(task) {
    const item = document.createElement("li");
    item.className = "todo-item";

    const subject = getSubject(task.subjectId);

    if (subject) {
        item.style.setProperty("--hue", getSubjectHue(subject.name));
        item.classList.add("has-subject");
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.setAttribute("aria-label", `Oznacz jako ukończone: ${task.title}`);

    checkbox.addEventListener("change", () => {
        // Po ukończeniu zadanie znika z listy – fokus przechodzi na kolejne zadanie.
        const checkboxes = [...todoList.querySelectorAll(".todo-item input")];
        const index = checkboxes.indexOf(checkbox);

        task.completed = true;
        saveTasks();
        renderTasks();

        const remaining = todoList.querySelectorAll(".todo-item input");
        (remaining[index] || remaining[index - 1] || dashboardAddTaskButton).focus();
    });

    const body = document.createElement("button");
    body.type = "button";
    body.className = "todo-body preview-trigger";
    body.dataset.taskId = task.id;
    body.setAttribute("aria-label", `Podgląd zadania: ${task.title}`);
    body.addEventListener("click", () => openTaskPreview(task));

    const title = document.createElement("span");
    title.className = "todo-title";
    title.textContent = task.title;

    const meta = document.createElement("span");
    meta.className = "todo-meta";

    if (subject) {
        meta.appendChild(createSubjectBadge(subject));
    }

    const due = document.createElement("span");
    due.className = "todo-due";

    const { label, overdue } = getDueLabel(task);
    due.textContent = label;
    due.classList.toggle("overdue", overdue);
    meta.appendChild(due);

    body.append(title, meta);
    item.append(checkbox, body);

    return item;
}

function renderTodoList() {
    const openTasks = tasks.filter(task => !task.completed).sort(compareTasksByDue);
    const shown = openTasks.slice(0, MAX_TODO_ITEMS);

    todoList.replaceChildren();

    if (openTasks.length === 0) {
        todoList.appendChild(createEmptyState(
            tasks.length === 0
                ? "Nie masz jeszcze żadnych zadań."
                : "Wszystko zrobione! Nie masz zadań do zrobienia.",
            "Dodaj zadanie",
            goToTaskForm
        ));
    }

    let currentGroup = null;
    let list = null;

    shown.forEach(task => {
        const group = getTodoGroup(task);

        if (group !== currentGroup) {
            currentGroup = group;

            const heading = document.createElement("h3");
            heading.className = "todo-group";
            heading.textContent = group;

            if (group === "Po terminie") {
                heading.classList.add("overdue");
            }

            list = document.createElement("ul");
            list.className = "todo-items";

            todoList.append(heading, list);
        }

        list.appendChild(createTodoItem(task));
    });

    const hidden = openTasks.length - shown.length;
    todoShowAll.hidden = tasks.length === 0;
    todoShowAll.textContent = hidden > 0
        ? `Zobacz wszystkie zadania (jeszcze ${hidden} do zrobienia) →`
        : "Zobacz wszystkie zadania →";
}

// ---------- Całość ----------

function renderDashboard() {
    renderNextClass();
    renderNextDue();
    renderTodoList();
}

function goToTaskForm() {
    navigateTo("zadania");
    taskInput.focus();
}

dashboardAddTaskButton.addEventListener("click", goToTaskForm);

// Odliczanie ("za 25 min", "Trwa teraz") odświeżamy co minutę, gdy dashboard jest widoczny.
// Lista zadań zostaje bez zmian, a karty z fokusem nie przerysowujemy, żeby nie gubić
// miejsca, w którym jest użytkownik.
setInterval(() => {
    if (viewDashboardElement.hidden || document.hidden) {
        return;
    }

    if (!nextClassBody.contains(document.activeElement)) {
        renderNextClass();
    }

    if (!nextDueBody.contains(document.activeElement)) {
        renderNextDue();
    }
}, 60 * 1000);
