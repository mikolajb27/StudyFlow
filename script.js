
const taskForm = document.querySelector("#taskForm");
const taskInput = document.querySelector("#taskInput");
const taskDescription = document.querySelector("#taskDescription");
const taskDueDate = document.querySelector("#taskDueDate");
const taskDueTime = document.querySelector("#taskDueTime");
const taskSubject = document.querySelector("#taskSubject");
const dueDateError = document.querySelector("#dueDateError");


function showDueDateError(message) {
    dueDateError.textContent = message;
    dueDateError.hidden = false;
    taskDueDate.classList.add("invalid");
}

function hideDueDateError() {
    dueDateError.hidden = true;
    taskDueDate.classList.remove("invalid");
}


taskDueDate.addEventListener("input", hideDueDateError);


const pickers = [taskDueDate, taskDueTime];

function updatePickerState() {
    pickers.forEach(picker => {
        picker.classList.toggle("is-empty", picker.value === "");
    });
}

pickers.forEach(picker => picker.addEventListener("input", updatePickerState));
updatePickerState();

const taskList = document.querySelector("#taskList");

const totalTasks = document.querySelector("#totalTasks");
const completedTasks = document.querySelector("#completedTasks");
const remainingTasks = document.querySelector("#remainingTasks");
const completedPercent = document.querySelector("#completedPercent");


let tasks = JSON.parse(localStorage.getItem("tasks")) || [];


function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
}


function updateStats() {
    const completed = tasks.filter(task => task.completed).length;

    totalTasks.textContent = tasks.length;
    completedTasks.textContent = completed;
    remainingTasks.textContent = tasks.length - completed;

    
    const percent = tasks.length === 0
        ? 0
        : Math.round((completed / tasks.length) * 100);

    completedPercent.textContent = `${percent}%`;
}


function toDateString(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${date.getFullYear()}-${month}-${day}`;
}

function getTodayString() {
    return toDateString(new Date());
}


function getCurrentTimeString() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    return `${hours}:${minutes}`;
}


function isOverdue(task) {
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
function getDueLabel(task) {
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
function compareTasksByDue(a, b) {
    const keyA = `${a.dueDate || "9999-99-99"} ${a.dueTime || "99:99"}`;
    const keyB = `${b.dueDate || "9999-99-99"} ${b.dueTime || "99:99"}`;

    return keyA.localeCompare(keyB);
}


// "2026-11-20" -> "20 listopada 2026"; brak albo błędna data -> "brak daty".
function formatDueDate(dateString) {
    const [year, month, day] = (dateString || "").split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())) {
        return "brak daty";
    }

    return date.toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}


function renderTasks() {
    taskList.innerHTML = "";

    if (tasks.length === 0) {
        taskList.innerHTML =
            '<p class="empty-message">Nie masz jeszcze żadnych zadań.</p>';
    }

    tasks.forEach(task => {
        const item = document.createElement("div");

        item.className = "task-item";

        if (task.completed) {
            item.classList.add("completed");
        }

        const left = document.createElement("div");
        left.className = "task-left";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;

        checkbox.addEventListener("change", () => {
            task.completed = checkbox.checked;
            saveTasks();
            renderTasks();
        });

        const content = document.createElement("div");
        content.className = "task-content";

        const title = document.createElement("span");
        title.className = "task-title";
        title.textContent = task.title;

        content.appendChild(title);

        if (task.description) {
            const description = document.createElement("p");
            description.className = "task-description";
            description.textContent = task.description;
            content.appendChild(description);
        }

        // Przedmiot i termin w jednej linii pod opisem.
        const meta = document.createElement("div");
        meta.className = "task-meta";

        const subject = getSubject(task.subjectId); // z subjects.js

        if (subject) {
            meta.appendChild(createSubjectBadge(subject));
        }

        if (task.dueDate) {
            const due = document.createElement("span");
            due.className = "task-due";

            const { label, overdue } = getDueLabel(task);
            due.textContent = `Termin: ${label}`;
            due.classList.toggle("overdue", overdue);

            meta.appendChild(due);
        }

        if (meta.childElementCount > 0) {
            content.appendChild(meta);
        }

        // Przyciski usuwania: najpierw "Usuń", potem potwierdzenie.
        const actions = document.createElement("div");
        actions.className = "task-actions";

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Usuń";

        const confirmButton = document.createElement("button");
        confirmButton.className = "delete-button confirm";
        confirmButton.textContent = "Czy na pewno chcesz usunąć?";

        const cancelButton = document.createElement("button");
        cancelButton.className = "cancel-button";
        cancelButton.textContent = "Anuluj";

        deleteButton.addEventListener("click", () => {
            actions.replaceChildren(confirmButton, cancelButton);
            confirmButton.focus();
        });

        cancelButton.addEventListener("click", () => {
            actions.replaceChildren(deleteButton);
            deleteButton.focus();
        });

        confirmButton.addEventListener("click", () => {
            tasks = tasks.filter(t => t.id !== task.id);
            saveTasks();
            renderTasks();
        });

        actions.appendChild(deleteButton);

        left.append(checkbox, content);
        item.append(left, actions);

        taskList.appendChild(item);
    });

    updateStats();
    renderCalendar(); // z calendar.js
    renderSubjects(); // z subjects.js (liczniki zadań i lista wyboru przedmiotu)
    renderDashboard(); // z dashboard.js
    renderGrades(); // z grades.js (nazwy i ECTS przedmiotów)
}

// Dodawanie nowych zadań.
taskForm.addEventListener("submit", event => {
    event.preventDefault();

    const title = taskInput.value.trim();

    if (title === "") {
        return;
    }

    // Termin jest obowiązkowy.
    if (taskDueDate.value === "") {
        showDueDateError("Dodaj termin zadania, zanim je zapiszesz.");
        taskDueDate.focus();
        return;
    }

    hideDueDateError();

    const newTask = {
        id: crypto.randomUUID(),
        title: title,
        description: taskDescription.value.trim(),
        dueDate: taskDueDate.value,
        dueTime: taskDueTime.value, // "" gdy nie wybrano godziny
        subjectId: taskSubject.value || null,
        completed: false
    };

    tasks.push(newTask);

    saveTasks();
    renderTasks();

    taskForm.reset();
    updatePickerState();
    taskInput.focus();
});

// NAWIGACJA MIĘDZY WIDOKAMI

const topbarSubtitle = document.querySelector("#topbarSubtitle");
const topbarTitle = document.querySelector("#topbarTitle");
const navLinks = document.querySelectorAll("nav a[data-view]");

const views = {
    dashboard: {
        element: document.querySelector("#viewDashboard"),
        subtitle: "TWÓJ PANEL",
        title: "Witaj w StudyFlow!"
    },
    zadania: {
        element: document.querySelector("#viewTasks"),
        subtitle: "ORGANIZACJA",
        title: "Moje zadania"
    },
    kalendarz: {
        element: document.querySelector("#viewCalendar"),
        subtitle: "PLANOWANIE",
        title: "Kalendarz zadań"
    },
    "plan-zajec": {
        element: document.querySelector("#viewSchedule"),
        subtitle: "PLANOWANIE",
        title: "Plan zajęć"
    },
    przedmioty: {
        element: document.querySelector("#viewSubjects"),
        subtitle: "STUDIA",
        title: "Przedmioty"
    },
    oceny: {
        element: document.querySelector("#viewGrades"),
        subtitle: "STUDIA",
        title: "Oceny"
    }
};

function showView(name) {
    if (!views[name]) {
        name = "dashboard";
    }

    Object.entries(views).forEach(([key, view]) => {
        view.element.hidden = key !== name;
    });

    navLinks.forEach(link => {
        const isActive = link.dataset.view === name;
        link.classList.toggle("active", isActive);

        if (isActive) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });

    topbarSubtitle.textContent = views[name].subtitle;
    topbarTitle.textContent = views[name].title;

    // Plan zajęć mógł się zmienić (najbliższe zajęcia, podpowiedź o brakujących przedmiotach).
    if (name === "przedmioty") {
        renderSubjects();
    }

    // Najbliższe zajęcia zależą od planu i od aktualnej godziny.
    if (name === "dashboard") {
        renderDashboard();
    }
}

function navigateTo(name) {
    location.hash = name;
    showView(name);
}

// Widok zależy od adresu, np. index.html#kalendarz.
window.addEventListener("hashchange", () => {
    showView(location.hash.slice(1));
});

// Pierwsze wyświetlenie aplikacji (po załadowaniu wszystkich skryptów).
document.addEventListener("DOMContentLoaded", () => {
    showView(location.hash.slice(1));
    renderTasks();
});
