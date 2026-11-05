// KALENDARZ
// Korzysta z danych i funkcji z script.js: tasks, saveTasks, renderTasks,
// toDateString, getTodayString, formatDueDate, isOverdue, navigateTo.

const calendarTitle = document.querySelector("#calendarTitle");
const calendarGrid = document.querySelector("#calendarGrid");
const prevMonthButton = document.querySelector("#prevMonth");
const nextMonthButton = document.querySelector("#nextMonth");
const todayButton = document.querySelector("#todayButton");

const dayPanelTitle = document.querySelector("#dayPanelTitle");
const dayPanelList = document.querySelector("#dayPanelList");
const addTaskForDayButton = document.querySelector("#addTaskForDay");

// Ile zadań mieści się w jednym polu dnia, zanim pokażemy "+N więcej".
const MAX_CHIPS_PER_DAY = 3;

const now = new Date();
let viewYear = now.getFullYear();
let viewMonth = now.getMonth(); // 0 = styczeń
let selectedDate = getTodayString();

// "RRRR-MM-DD" -> Date (czas lokalny).
function parseDateString(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

// Zadania z godziną najpierw (rosnąco), zadania bez godziny na końcu.
function compareByTime(a, b) {
    return (a.dueTime || "99:99").localeCompare(b.dueTime || "99:99");
}

// Grupujemy zadania według dnia: { "2026-11-05": [zadanie, ...] }.
function getTasksByDate() {
    const tasksByDate = {};

    tasks.forEach(task => {
        if (!task.dueDate) {
            return;
        }

        if (!tasksByDate[task.dueDate]) {
            tasksByDate[task.dueDate] = [];
        }

        tasksByDate[task.dueDate].push(task);
    });

    Object.values(tasksByDate).forEach(list => list.sort(compareByTime));

    return tasksByDate;
}

// Rysujemy siatkę miesiąca i panel wybranego dnia.
function renderCalendar() {
    const tasksByDate = getTasksByDate();
    const today = getTodayString();

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // Tydzień zaczyna się w poniedziałek (getDay(): 0 = niedziela).
    const offset = (firstOfMonth.getDay() + 6) % 7;
    const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;

    calendarTitle.textContent = capitalize(
        firstOfMonth.toLocaleDateString("pl-PL", { month: "long", year: "numeric" })
    );

    calendarGrid.replaceChildren();

    for (let i = 0; i < cellCount; i++) {
        const date = new Date(viewYear, viewMonth, 1 - offset + i);
        const dateString = toDateString(date);
        const dayTasks = tasksByDate[dateString] || [];

        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "calendar-day";

        if (date.getMonth() !== viewMonth) {
            cell.classList.add("other-month");
        }

        if (dateString === today) {
            cell.classList.add("today");
        }

        if (dateString === selectedDate) {
            cell.classList.add("selected");
        }

        cell.setAttribute("aria-pressed", String(dateString === selectedDate));
        cell.setAttribute(
            "aria-label",
            `${formatDueDate(dateString)}, zadania: ${dayTasks.length}`
        );

        const number = document.createElement("span");
        number.className = "calendar-day-number";
        number.textContent = date.getDate();

        // Na telefonie zamiast listy zadań pokazujemy tylko ich liczbę.
        const count = document.createElement("span");
        count.className = "calendar-count";
        count.textContent = dayTasks.length;
        count.hidden = dayTasks.length === 0;

        const top = document.createElement("div");
        top.className = "calendar-day-top";
        top.append(number, count);

        const chips = document.createElement("div");
        chips.className = "calendar-chips";

        dayTasks.slice(0, MAX_CHIPS_PER_DAY).forEach(task => {
            const chip = document.createElement("span");
            chip.className = "calendar-chip";
            chip.textContent = task.title;

            // Godzina i przedmiot tylko w podpowiedzi po najechaniu myszką.
            const subject = getSubject(task.subjectId); // z subjects.js

            chip.title = [
                task.dueTime ? `${task.dueTime} – ${task.title}` : task.title,
                subject && `Przedmiot: ${subject.name}`
            ].filter(Boolean).join("\n");

            // Kolor przedmiotu jako pasek z lewej strony.
            if (subject) {
                chip.classList.add("has-subject");
                chip.style.setProperty("--hue", getSubjectHue(subject.name));
            }

            if (task.completed) {
                chip.classList.add("completed");
            } else if (isOverdue(task)) {
                chip.classList.add("overdue");
            }

            chips.appendChild(chip);
        });

        if (dayTasks.length > MAX_CHIPS_PER_DAY) {
            const more = document.createElement("span");
            more.className = "calendar-more";
            more.textContent = `+${dayTasks.length - MAX_CHIPS_PER_DAY} więcej`;
            chips.appendChild(more);
        }

        cell.append(top, chips);

        cell.addEventListener("click", () => {
            selectedDate = dateString;

            // Kliknięcie dnia z sąsiedniego miesiąca przełącza miesiąc.
            viewYear = date.getFullYear();
            viewMonth = date.getMonth();

            renderCalendar();
        });

        calendarGrid.appendChild(cell);
    }

    renderDayPanel(tasksByDate[selectedDate] || []);
}

// Lista zadań wybranego dnia.
function renderDayPanel(dayTasks) {
    dayPanelTitle.textContent = capitalize(
        parseDateString(selectedDate).toLocaleDateString("pl-PL", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        })
    );

    dayPanelList.replaceChildren();

    if (dayTasks.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-message";
        empty.textContent = "Brak zadań na ten dzień.";
        dayPanelList.appendChild(empty);
        return;
    }

    dayTasks.forEach(task => {
        const item = document.createElement("label");
        item.className = "day-task";

        if (task.completed) {
            item.classList.add("completed");
        }

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;

        checkbox.addEventListener("change", () => {
            task.completed = checkbox.checked;
            saveTasks();
            renderTasks(); // odświeża też kalendarz
        });

        const content = document.createElement("div");
        content.className = "task-content";

        const title = document.createElement("span");
        title.className = "task-title";
        title.textContent = task.title;

        const meta = document.createElement("span");
        meta.className = "task-due";
        meta.textContent = task.dueTime ? `godz. ${task.dueTime}` : "Cały dzień";

        if (!task.completed && isOverdue(task)) {
            meta.textContent += " · po terminie";
            meta.classList.add("overdue");
        }

        const metaRow = document.createElement("div");
        metaRow.className = "task-meta";

        const subject = getSubject(task.subjectId);

        if (subject) {
            metaRow.appendChild(createSubjectBadge(subject));
        }

        metaRow.appendChild(meta);
        content.append(title, metaRow);

        if (task.description) {
            const description = document.createElement("p");
            description.className = "task-description";
            description.textContent = task.description;
            content.appendChild(description);
        }

        item.append(checkbox, content);
        dayPanelList.appendChild(item);
    });
}

// Przełączanie miesięcy.
function changeMonth(step) {
    const date = new Date(viewYear, viewMonth + step, 1);
    viewYear = date.getFullYear();
    viewMonth = date.getMonth();
    renderCalendar();
}

prevMonthButton.addEventListener("click", () => changeMonth(-1));
nextMonthButton.addEventListener("click", () => changeMonth(1));

todayButton.addEventListener("click", () => {
    const today = new Date();
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
    selectedDate = getTodayString();
    renderCalendar();
});

// Przechodzimy do formularza z już wpisaną datą wybranego dnia.
addTaskForDayButton.addEventListener("click", () => {
    taskDueDate.value = selectedDate;
    updatePickerState();
    hideDueDateError();

    navigateTo("zadania");
    taskInput.focus();
});
