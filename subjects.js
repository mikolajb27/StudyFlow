// PRZEDMIOTY
// Lista przedmiotów: import z pliku CSV, dodawanie / edycja / usuwanie ręcznie.
// Zadania mogą być przypisane do przedmiotu (task.subjectId).
// Korzysta z script.js: tasks, saveTasks, renderTasks, getTodayString, formatDueDate,
// isOverdue, compareTasksByDue, navigateTo, taskInput, taskSubject,
// z calendar.js: parseDateString, capitalize,
// oraz z schedule.js: schedule, normalize, parseCsv, readFileText, getSubjectHue, showStatus.

const subjectGrid = document.querySelector("#subjectGrid");
const subjectsEmpty = document.querySelector("#subjectsEmpty");
const subjectStatus = document.querySelector("#subjectStatus");
const subjectsFromSchedule = document.querySelector("#subjectsFromSchedule");
const subjectFile = document.querySelector("#subjectFile");
const importSubjectsButton = document.querySelector("#importSubjectsButton");
const downloadSubjectTemplateButton = document.querySelector("#downloadSubjectTemplate");
const addSubjectButton = document.querySelector("#addSubjectButton");

const subjectDialog = document.querySelector("#subjectDialog");
const subjectForm = document.querySelector("#subjectForm");
const subjectDialogTitle = document.querySelector("#subjectDialogTitle");
const subjectName = document.querySelector("#subjectName");
const subjectLecturer = document.querySelector("#subjectLecturer");
const subjectEcts = document.querySelector("#subjectEcts");
const subjectAssessment = document.querySelector("#subjectAssessment");
const subjectFormError = document.querySelector("#subjectFormError");
const subjectDeleteArea = document.querySelector("#subjectDeleteArea");
const subjectCancelButton = document.querySelector("#subjectCancel");
const subjectSaveButton = document.querySelector("#subjectSave");

const MAX_TASKS_ON_CARD = 3;

// Każdy przedmiot: { id, name, lecturer, ects (liczba albo null), assessment }
let subjects = JSON.parse(localStorage.getItem("subjects")) || [];

let editingSubject = null; // przedmiot edytowany w oknie (null = dodawanie nowego)

// Przedmioty z rozwiniętą listą zadań (zostają rozwinięte po odświeżeniu widoku).
const expandedSubjects = new Set();

function saveSubjects() {
    localStorage.setItem("subjects", JSON.stringify(subjects));
}

function getSubject(id) {
    return id ? subjects.find(subject => subject.id === id) : undefined;
}

function findSubjectByName(name) {
    const key = normalize(name);
    return subjects.find(subject => normalize(subject.name) === key);
}

function sortedSubjects() {
    return [...subjects].sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

// "5", "5,5", "5.5" -> 5.5; puste albo błędne -> null
function parseEcts(value) {
    const text = String(value ?? "").trim().replace(",", ".");

    if (text === "") {
        return null;
    }

    const number = Number(text);
    return Number.isFinite(number) && number >= 0 && number <= 60 ? number : undefined;
}

function formatEcts(ects) {
    return `${String(ects).replace(".", ",")} ECTS`;
}

// Kolorowa etykieta przedmiotu (w liście zadań i w kalendarzu).
function createSubjectBadge(subject) {
    const badge = document.createElement("span");
    badge.className = "subject-badge";
    badge.style.setProperty("--hue", getSubjectHue(subject.name));
    badge.textContent = subject.name;
    return badge;
}

// ---------- Lista wyboru w formularzu zadania ----------

function renderSubjectOptions() {
    const current = taskSubject.value;
    const list = sortedSubjects();

    const none = document.createElement("option");
    none.value = "";
    none.textContent = list.length === 0 ? "Brak przedmiotów" : "Bez przedmiotu";

    const options = list.map(subject => {
        const option = document.createElement("option");
        option.value = subject.id;
        option.textContent = subject.name;
        return option;
    });

    taskSubject.replaceChildren(none, ...options);
    taskSubject.disabled = list.length === 0;
    taskSubject.title = list.length === 0 ? "Dodaj przedmioty w zakładce Przedmioty" : "";

    // Zachowujemy wybór, jeśli przedmiot nadal istnieje.
    taskSubject.value = getSubject(current) ? current : "";
}

// ---------- Widok przedmiotów ----------

// Najbliższe (albo trwające) zajęcia z planu dla danego przedmiotu.
function getNextClass(subject) {
    const key = normalize(subject.name);
    const today = getTodayString();
    const nowTime = getCurrentTimeString();

    return schedule
        .filter(entry => normalize(entry.subject) === key)
        .filter(entry => entry.date > today || (entry.date === today && entry.end > nowTime))
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
}

function formatClass(entry) {
    const date = capitalize(
        parseDateString(entry.date).toLocaleDateString("pl-PL", {
            weekday: "short",
            day: "numeric",
            month: "long"
        })
    );

    return [`${date}, ${entry.start}–${entry.end}`, entry.type, entry.room && `sala ${entry.room}`]
        .filter(Boolean)
        .join(" · ");
}

// Nazwy przedmiotów z planu zajęć, których nie ma jeszcze na liście.
function getMissingScheduleSubjects() {
    const seen = new Map();

    schedule.forEach(entry => {
        const key = normalize(entry.subject);

        if (key && !seen.has(key) && !findSubjectByName(entry.subject)) {
            seen.set(key, entry.subject.trim());
        }
    });

    return [...seen.values()];
}

function renderScheduleHint() {
    const missing = getMissingScheduleSubjects();
    subjectsFromSchedule.replaceChildren();
    subjectsFromSchedule.hidden = missing.length === 0;

    if (missing.length === 0) {
        return;
    }

    const text = document.createElement("p");
    text.textContent = missing.length === 1
        ? `W planie zajęć jest przedmiot, którego nie ma na liście: ${missing[0]}.`
        : `W planie zajęć są przedmioty, których nie ma na liście (${missing.length}): ` +
          `${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}.`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button";
    button.textContent = missing.length === 1 ? "Dodaj go" : "Dodaj wszystkie";

    button.addEventListener("click", () => {
        missing.forEach(name => subjects.push(createSubject({ name })));
        saveSubjects();
        renderTasks(); // odświeża też przedmioty
        showStatus(
            subjectStatus,
            "success",
            `Dodano przedmioty z planu zajęć (${missing.length}). ` +
            "Możesz je teraz uzupełnić o prowadzącego i punkty ECTS."
        );
    });

    subjectsFromSchedule.append(text, button);
}

// Wiersz zadania na karcie przedmiotu (tytuł + termin), otwiera podgląd.
function createSubjectTaskButton(task) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "subject-task preview-trigger";
    button.dataset.taskId = task.id;

    if (task.completed) {
        button.classList.add("completed");
    }

    const title = document.createElement("span");
    title.className = "subject-task-title";
    title.textContent = task.title;

    const due = document.createElement("span");
    due.className = "subject-task-due";

    if (task.dueDate) {
        due.textContent = formatDueDate(task.dueDate);
    }

    if (!task.completed && isOverdue(task)) {
        due.classList.add("overdue");
        due.textContent += " (po terminie)";
    }

    button.append(title, due);
    button.setAttribute("aria-label", `Podgląd zadania: ${task.title}`);
    button.addEventListener("click", () => openTaskPreview(task));

    return button;
}

function findSubjectCard(subjectId) {
    return subjectGrid.querySelector(`[data-subject-id="${subjectId}"]`);
}

function createSubjectCard(subject) {
    const card = document.createElement("article");
    card.className = "subject-card";
    card.dataset.subjectId = subject.id;
    card.style.setProperty("--hue", getSubjectHue(subject.name));

    // Nagłówek: nazwa + edycja
    const header = document.createElement("div");
    header.className = "subject-card-header";

    const name = document.createElement("h3");
    name.textContent = subject.name;

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "secondary-button subject-edit";
    editButton.textContent = "Edytuj";
    editButton.setAttribute("aria-label", `Edytuj przedmiot: ${subject.name}`);
    editButton.addEventListener("click", () => openSubjectDialog(subject));

    header.append(name, editButton);
    card.appendChild(header);

    // Prowadzący · ECTS · forma zaliczenia
    const details = [
        subject.lecturer,
        subject.ects !== null && subject.ects !== undefined && formatEcts(subject.ects),
        subject.assessment
    ].filter(Boolean);

    if (details.length > 0) {
        const meta = document.createElement("p");
        meta.className = "subject-meta";
        meta.textContent = details.join(" · ");
        card.appendChild(meta);
    }

    // Najbliższe zajęcia z planu
    const nextClass = getNextClass(subject);

    if (nextClass) {
        const next = document.createElement("p");
        next.className = "subject-next";

        const label = document.createElement("span");
        label.textContent = "Najbliższe zajęcia";

        next.append(label, document.createTextNode(formatClass(nextClass)));
        card.appendChild(next);
    }

    // Oceny (z grades.js): "Oceny: średnia 4,17 · końcowa 4,5"
    const gradeSummaryText = getSubjectGradeSummary(subject.id);

    if (gradeSummaryText) {
        const gradeLine = document.createElement("p");
        gradeLine.className = "subject-grades";
        gradeLine.textContent = gradeSummaryText;
        card.appendChild(gradeLine);
    }

    // Postęp zadań
    const subjectTasks = tasks.filter(task => task.subjectId === subject.id);
    const done = subjectTasks.filter(task => task.completed).length;

    const progress = document.createElement("div");
    progress.className = "subject-progress";

    const progressText = document.createElement("span");
    progressText.textContent = subjectTasks.length === 0
        ? "Brak zadań"
        : `Zadania: ${done} z ${subjectTasks.length} ukończone`;

    const bar = document.createElement("div");
    bar.className = "subject-bar";
    bar.setAttribute("aria-hidden", "true");

    const fill = document.createElement("div");
    fill.style.width = subjectTasks.length === 0 ? "0%" : `${(done / subjectTasks.length) * 100}%`;
    bar.appendChild(fill);

    progress.append(progressText, bar);
    card.appendChild(progress);

    // Zadania przedmiotu: zwinięte – najbliższe nieukończone, rozwinięte – wszystkie
    // (nieukończone według terminu, potem ukończone). Kliknięcie otwiera podgląd zadania.
    if (subjectTasks.length > 0) {
        const openTasks = subjectTasks.filter(task => !task.completed).sort(compareTasksByDue);
        const doneTasks = subjectTasks.filter(task => task.completed).sort(compareTasksByDue);
        const expanded = expandedSubjects.has(subject.id);

        const shown = expanded ? [...openTasks, ...doneTasks] : openTasks.slice(0, MAX_TASKS_ON_CARD);
        const hiddenCount = subjectTasks.length - shown.length;

        const list = document.createElement("ul");
        list.className = "subject-tasks";

        shown.forEach(task => {
            const item = document.createElement("li");
            item.appendChild(createSubjectTaskButton(task));
            list.appendChild(item);
        });

        if (shown.length > 0) {
            card.appendChild(list);
        }

        if (expanded || hiddenCount > 0) {
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "subject-tasks-toggle";
            toggle.setAttribute("aria-expanded", String(expanded));
            toggle.textContent = expanded
                ? "Zwiń listę"
                : openTasks.length === 0
                    ? `Pokaż ukończone (${hiddenCount})`
                    : `Pokaż wszystkie (${subjectTasks.length})`;

            toggle.addEventListener("click", () => {
                if (expanded) {
                    expandedSubjects.delete(subject.id);
                } else {
                    expandedSubjects.add(subject.id);
                }

                renderSubjects();
                findSubjectCard(subject.id)?.querySelector(".subject-tasks-toggle")?.focus();
            });

            card.appendChild(toggle);
        }
    }

    // Szybkie dodanie zadania do tego przedmiotu
    const addTask = document.createElement("button");
    addTask.type = "button";
    addTask.className = "secondary-button subject-add-task";
    addTask.textContent = "+ Dodaj zadanie";
    addTask.setAttribute("aria-label", `Dodaj zadanie z przedmiotu: ${subject.name}`);

    addTask.addEventListener("click", () => {
        taskSubject.value = subject.id;
        navigateTo("zadania");
        taskInput.focus();
    });

    card.appendChild(addTask);

    return card;
}

function renderSubjects() {
    renderSubjectOptions();
    renderScheduleHint();

    subjectsEmpty.hidden = subjects.length > 0;
    subjectGrid.hidden = subjects.length === 0;
    subjectGrid.replaceChildren(...sortedSubjects().map(createSubjectCard));
}

// ---------- Import CSV ----------

const SUBJECT_COLUMN_ALIASES = {
    name: ["nazwa przedmiotu", "przedmiot", "nazwa", "subject", "course", "name"],
    lecturer: ["prowadzacy", "prowadzaca", "prowadzacy zajecia", "wykladowca", "nauczyciel",
        "koordynator", "lecturer", "teacher"],
    ects: ["ects", "punkty ects", "pkt ects", "punkty", "credits"],
    assessment: ["forma zaliczenia", "zaliczenie", "forma weryfikacji", "assessment"]
};

function createSubject({ name, lecturer = "", ects = null, assessment = "" }) {
    return { id: crypto.randomUUID(), name, lecturer, ects, assessment };
}

// Zwraca { items, errors } albo { fatal }. Ten sam przedmiot może wystąpić w pliku
// wiele razy (np. plik z planem zajęć) – wtedy łączymy wiersze.
function readSubjects(text) {
    const rows = parseCsv(text.replace(/^﻿/, ""));

    if (rows.length < 2) {
        return { fatal: "Plik jest pusty albo zawiera tylko nagłówek." };
    }

    const header = rows[0].cells.map(normalize);
    const columns = {};

    Object.entries(SUBJECT_COLUMN_ALIASES).forEach(([field, aliases]) => {
        const index = header.findIndex(name => aliases.includes(name));

        if (index !== -1) {
            columns[field] = index;
        }
    });

    if (columns.name === undefined) {
        return {
            fatal: "Brakuje kolumny nazwa_przedmiotu. " +
                "Pierwszy wiersz pliku musi zawierać nagłówki (pobierz wzór CSV)."
        };
    }

    const byName = new Map();
    const errors = [];

    rows.slice(1).forEach(({ cells, line }) => {
        const get = field =>
            columns[field] === undefined ? "" : (cells[columns[field]] || "").trim();

        const name = get("name");

        if (name === "") {
            errors.push(`Wiersz ${line}: brak nazwy przedmiotu.`);
            return;
        }

        let ects = parseEcts(get("ects"));

        if (ects === undefined) {
            errors.push(`Wiersz ${line}: nieprawidłowa liczba ECTS „${get("ects")}” – pominięto ją.`);
            ects = null;
        }

        const item = { name, lecturer: get("lecturer"), ects, assessment: get("assessment") };
        const key = normalize(name);
        const existing = byName.get(key);

        if (existing) {
            // Uzupełniamy tylko brakujące pola.
            existing.lecturer ||= item.lecturer;
            existing.ects ??= item.ects;
            existing.assessment ||= item.assessment;
        } else {
            byName.set(key, item);
        }
    });

    return { items: [...byName.values()], errors };
}

importSubjectsButton.addEventListener("click", () => subjectFile.click());

subjectFile.addEventListener("change", async () => {
    const file = subjectFile.files[0];
    subjectFile.value = "";

    if (!file) {
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        showStatus(subjectStatus, "error", "Plik jest za duży (maks. 2 MB).");
        return;
    }

    const result = readSubjects(await readFileText(file));

    if (result.fatal) {
        showStatus(subjectStatus, "error", `Nie udało się wczytać pliku „${file.name}”. ${result.fatal}`);
        return;
    }

    if (result.items.length === 0) {
        showStatus(subjectStatus, "error", `W pliku „${file.name}” nie ma żadnych przedmiotów.`, result.errors);
        return;
    }

    // Import nie usuwa przedmiotów (zadania mogą być do nich przypisane):
    // nowe dodaje, a istniejące (ta sama nazwa) uzupełnia danymi z pliku.
    let added = 0;
    let updated = 0;

    result.items.forEach(item => {
        const existing = findSubjectByName(item.name);

        if (!existing) {
            subjects.push(createSubject(item));
            added++;
            return;
        }

        const before = JSON.stringify(existing);

        if (item.lecturer) existing.lecturer = item.lecturer;
        if (item.ects !== null) existing.ects = item.ects;
        if (item.assessment) existing.assessment = item.assessment;

        if (JSON.stringify(existing) !== before) {
            updated++;
        }
    });

    saveSubjects();
    renderTasks(); // odświeża listę zadań, kalendarz i przedmioty

    const parts = [`nowe: ${added}`];

    if (updated > 0) parts.push(`zaktualizowane: ${updated}`);

    const unchanged = result.items.length - added - updated;

    if (unchanged > 0) parts.push(`bez zmian: ${unchanged}`);

    const message = `Zaimportowano przedmioty z pliku „${file.name}” (${parts.join(", ")}).`;

    if (result.errors.length > 0) {
        showStatus(subjectStatus, "warning", `${message} Uwagi:`, result.errors);
    } else {
        showStatus(subjectStatus, "success", message);
    }
});

downloadSubjectTemplateButton.addEventListener("click", () => {
    const lines = [
        '"nazwa_przedmiotu";"prowadzacy";"ects";"forma_zaliczenia"',
        '"Analiza matematyczna";"dr Anna Kowalska";"6";"egzamin"',
        '"Algebra";"prof. Jan Nowak";"5";"egzamin"',
        '"Programowanie";"mgr Piotr Wiśniewski";"5";"zaliczenie na ocenę"',
        '"Higiena cyfrowa";"";"1";"zaliczenie"'
    ];

    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "przedmioty-wzor.csv";
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// ---------- Okno: dodawanie / edycja ----------

function showSubjectFormError(message, field) {
    subjectFormError.textContent = message;
    subjectFormError.hidden = false;
    field?.focus();
}

function openSubjectDialog(subject = null) {
    editingSubject = subject;
    const isEdit = subject !== null;

    subjectForm.reset();
    subjectFormError.hidden = true;

    subjectDialogTitle.textContent = isEdit ? "Edytuj przedmiot" : "Dodaj przedmiot";
    subjectSaveButton.textContent = isEdit ? "Zapisz zmiany" : "Dodaj przedmiot";

    if (isEdit) {
        subjectName.value = subject.name;
        subjectLecturer.value = subject.lecturer;
        subjectEcts.value = subject.ects ?? "";
        subjectAssessment.value = subject.assessment;
    }

    renderSubjectDeleteArea();
    subjectDialog.showModal();
    subjectName.focus();
}

addSubjectButton.addEventListener("click", () => openSubjectDialog());
subjectCancelButton.addEventListener("click", () => subjectDialog.close());

subjectDialog.addEventListener("click", event => {
    if (event.target === subjectDialog) {
        subjectDialog.close();
    }
});

subjectDialog.addEventListener("close", () => {
    editingSubject = null;
});

subjectForm.addEventListener("submit", event => {
    event.preventDefault();

    const name = subjectName.value.trim();
    const lecturer = subjectLecturer.value.trim();
    const assessment = subjectAssessment.value.trim();
    const ects = parseEcts(subjectEcts.value);

    if (name === "") {
        return showSubjectFormError("Podaj nazwę przedmiotu.", subjectName);
    }

    const duplicate = findSubjectByName(name);

    if (duplicate && duplicate !== editingSubject) {
        return showSubjectFormError(`Przedmiot „${duplicate.name}” jest już na liście.`, subjectName);
    }

    // Pole liczbowe zwraca "" także dla tekstu, którego nie da się odczytać.
    if (ects === undefined || subjectEcts.validity.badInput) {
        return showSubjectFormError("Liczba ECTS musi być liczbą od 0 do 60.", subjectEcts);
    }

    let message;

    if (editingSubject) {
        Object.assign(editingSubject, { name, lecturer, ects, assessment });
        message = `Zapisano zmiany: „${name}”.`;
    } else {
        subjects.push(createSubject({ name, lecturer, ects, assessment }));
        message = `Dodano przedmiot „${name}”.`;
    }

    saveSubjects();
    renderTasks();
    subjectDialog.close();
    showStatus(subjectStatus, "success", message);
});

// Usuwanie z potwierdzeniem; zadania przedmiotu zostają, tylko bez przypisania.
function renderSubjectDeleteArea() {
    subjectDeleteArea.replaceChildren();

    if (!editingSubject) {
        return;
    }

    const subject = editingSubject;
    const taskCount = tasks.filter(task => task.subjectId === subject.id).length;
    const gradeCount = grades.filter(grade => grade.subjectId === subject.id).length; // z grades.js

    // "Usuń (zadania: 2 zostaną bez przedmiotu, oceny: 3 zostaną usunięte)"
    const consequences = [
        taskCount > 0 && `zadania: ${taskCount} zostaną bez przedmiotu`,
        gradeCount > 0 && `oceny: ${gradeCount} zostaną usunięte`
    ].filter(Boolean);

    const deleteButton = makeDialogButton("Usuń", "delete-button", () => {
        const confirm = makeDialogButton(
            consequences.length > 0
                ? `Usuń (${consequences.join(", ")})`
                : "Czy na pewno chcesz usunąć?",
            "delete-button confirm",
            () => {
                subjects = subjects.filter(other => other.id !== subject.id);

                // Oceny bez przedmiotu nie mają sensu – usuwamy je razem z nim.
                grades = grades.filter(grade => grade.subjectId !== subject.id);
                saveGrades();

                tasks.forEach(task => {
                    if (task.subjectId === subject.id) {
                        task.subjectId = null;
                    }
                });

                saveSubjects();
                saveTasks();
                renderTasks();
                subjectDialog.close();
                showStatus(subjectStatus, "success", `Usunięto przedmiot „${subject.name}”.`);
            }
        );

        const cancel = makeDialogButton("Nie usuwaj", "cancel-button", () => {
            renderSubjectDeleteArea();
            subjectDeleteArea.querySelector("button")?.focus();
        });

        subjectDeleteArea.replaceChildren(confirm, cancel);
        confirm.focus();
    });

    subjectDeleteArea.appendChild(deleteButton);
}

// ---------- Podgląd zadania ----------
// Otwierany z karty przedmiotu i z dashboardu (dashboard.js). Elementy, które go otwierają,
// mają klasę "preview-trigger" i atrybut data-task-id – po zamknięciu wraca na nie fokus.

const taskPreviewDialog = document.querySelector("#taskPreviewDialog");
const taskPreviewSubject = document.querySelector("#taskPreviewSubject");
const taskPreviewTitle = document.querySelector("#taskPreviewTitle");
const taskPreviewDue = document.querySelector("#taskPreviewDue");
const taskPreviewDescription = document.querySelector("#taskPreviewDescription");
const taskPreviewDone = document.querySelector("#taskPreviewDone");
const taskPreviewCalendarButton = document.querySelector("#taskPreviewCalendar");
const taskPreviewCloseButton = document.querySelector("#taskPreviewClose");

let previewTask = null; // zadanie pokazane w podglądzie

function fillTaskPreview() {
    const task = previewTask;
    const subject = getSubject(task.subjectId);

    taskPreviewSubject.replaceChildren(...(subject ? [createSubjectBadge(subject)] : []));
    taskPreviewTitle.textContent = task.title;
    taskPreviewTitle.classList.toggle("completed", task.completed);

    if (task.dueDate) {
        const { label, overdue } = getDueLabel(task);
        taskPreviewDue.textContent = label;
        taskPreviewDue.classList.toggle("overdue", overdue);
    } else {
        taskPreviewDue.textContent = "brak daty";
        taskPreviewDue.classList.remove("overdue");
    }

    taskPreviewDescription.textContent = task.description || "Brak opisu.";
    taskPreviewDescription.classList.toggle("empty", !task.description);

    taskPreviewDone.checked = task.completed;
    taskPreviewCalendarButton.hidden = !task.dueDate;
}

function openTaskPreview(task) {
    previewTask = task;
    fillTaskPreview();
    taskPreviewDialog.showModal();
    taskPreviewCloseButton.focus();
}

taskPreviewDone.addEventListener("change", () => {
    previewTask.completed = taskPreviewDone.checked;
    saveTasks();
    renderTasks(); // odświeża listę zadań, kalendarz i karty przedmiotów
    fillTaskPreview();
});

// Przejście do kalendarza na dzień terminu zadania.
taskPreviewCalendarButton.addEventListener("click", () => {
    const date = parseDateString(previewTask.dueDate);

    selectedDate = previewTask.dueDate; // z calendar.js
    viewYear = date.getFullYear();
    viewMonth = date.getMonth();

    taskPreviewDialog.close();
    navigateTo("kalendarz");
    renderCalendar();
});

taskPreviewCloseButton.addEventListener("click", () => taskPreviewDialog.close());

taskPreviewDialog.addEventListener("click", event => {
    if (event.target === taskPreviewDialog) {
        taskPreviewDialog.close();
    }
});

// Po zamknięciu wracamy fokusem do zadania, z którego otwarto podgląd (jeśli nadal tam jest).
// Widok mógł zostać narysowany na nowo (np. po zaznaczeniu "Ukończone"), więc szukamy
// elementu od nowa – i dopiero po tym, jak przeglądarka sama przywróci fokus po zamknięciu okna.
taskPreviewDialog.addEventListener("close", () => {
    const id = previewTask?.id;
    previewTask = null;

    setTimeout(() => {
        document.querySelector(`.view:not([hidden]) .preview-trigger[data-task-id="${id}"]`)?.focus();
    });
});
