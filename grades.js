// OCENY
// Własne oceny z przedmiotów: cząstkowe (z wagą) i jedna ocena końcowa na przedmiot.
// Liczymy średnią ważoną każdego przedmiotu, średnią ocen końcowych i średnią ważoną ECTS.
// Korzysta z script.js: getTodayString, formatDueDate, navigateTo,
// z calendar.js: parseDateString,
// z schedule.js: getSubjectHue, showStatus,
// z schedule-form.js: makeDialogButton,
// oraz z subjects.js: subjects, getSubject, sortedSubjects, formatEcts.

const gradeSubjectList = document.querySelector("#gradeSubjectList");
const gradesEmpty = document.querySelector("#gradesEmpty");
const gradesNoSubjects = document.querySelector("#gradesNoSubjects");
const gradeStatus = document.querySelector("#gradeStatus");
const gradeSummary = document.querySelector("#gradeSummary");
const addGradeButton = document.querySelector("#addGradeButton");

const gradeDialog = document.querySelector("#gradeDialog");
const gradeForm = document.querySelector("#gradeForm");
const gradeDialogTitle = document.querySelector("#gradeDialogTitle");
const gradeSubject = document.querySelector("#gradeSubject");
const gradeValue = document.querySelector("#gradeValue");
const gradeLabel = document.querySelector("#gradeLabel");
const gradeWeight = document.querySelector("#gradeWeight");
const gradeDate = document.querySelector("#gradeDate");
const gradeFinal = document.querySelector("#gradeFinal");
const gradeFinalNote = document.querySelector("#gradeFinalNote");
const gradeFormError = document.querySelector("#gradeFormError");
const gradeDeleteArea = document.querySelector("#gradeDeleteArea");
const gradeCancelButton = document.querySelector("#gradeCancel");
const gradeSaveButton = document.querySelector("#gradeSave");

// Każda ocena: { id, subjectId, value, label, weight, date "RRRR-MM-DD", final }
let grades = JSON.parse(localStorage.getItem("grades")) || [];

let editingGrade = null; // ocena edytowana w oknie (null = dodawanie nowej)

function saveGrades() {
    localStorage.setItem("grades", JSON.stringify(grades));
}

// ---------- Pomocnicze ----------

// 3.5 -> "3,5", 4 -> "4"
function formatGrade(value) {
    return String(value).replace(".", ",");
}

// 4.1666 -> "4,17"
function formatAverage(value) {
    return value.toFixed(2).replace(".", ",");
}

// Poziom oceny – do kolorów (2 = niezaliczone, 3–3,5, 4, 4,5–5).
function getGradeLevel(value) {
    if (value < 3) return "fail";
    if (value < 4) return "ok";
    if (value < 4.5) return "good";
    return "great";
}

function getSubjectGrades(subjectId) {
    return grades
        .filter(grade => grade.subjectId === subjectId)
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

function getFinalGrade(subjectId) {
    return grades.find(grade => grade.subjectId === subjectId && grade.final);
}

// Średnia ważona ocen cząstkowych (bez oceny końcowej). null, gdy brak ocen.
function getWeightedAverage(list) {
    const partial = list.filter(grade => !grade.final);
    const weightSum = partial.reduce((sum, grade) => sum + grade.weight, 0);

    if (weightSum === 0) {
        return null;
    }

    return partial.reduce((sum, grade) => sum + grade.value * grade.weight, 0) / weightSum;
}

// Średnia ocen końcowych i średnia ważona punktami ECTS.
function getOverallAverages() {
    const finals = subjects
        .map(subject => ({ subject, final: getFinalGrade(subject.id) }))
        .filter(item => item.final);

    const simple = finals.length === 0
        ? null
        : finals.reduce((sum, item) => sum + item.final.value, 0) / finals.length;

    const withEcts = finals.filter(item => item.subject.ects > 0);
    const ectsSum = withEcts.reduce((sum, item) => sum + item.subject.ects, 0);

    const ects = ectsSum === 0
        ? null
        : withEcts.reduce((sum, item) => sum + item.final.value * item.subject.ects, 0) / ectsSum;

    return { simple, ects, finalCount: finals.length, ectsCount: withEcts.length, ectsSum };
}

// Krótki opis do karty przedmiotu (subjects.js): "Średnia 4,17 · końcowa 4,5"
function getSubjectGradeSummary(subjectId) {
    const list = getSubjectGrades(subjectId);
    const average = getWeightedAverage(list);
    const final = getFinalGrade(subjectId);

    const parts = [];

    if (average !== null) parts.push(`średnia ${formatAverage(average)}`);
    if (final) parts.push(`końcowa ${formatGrade(final.value)}`);

    return parts.length === 0 ? "" : `Oceny: ${parts.join(" · ")}`;
}

// ---------- Podsumowanie ----------

function createSummaryCard(label, value, hint) {
    const card = document.createElement("div");
    card.className = "stat-card";

    const title = document.createElement("p");
    title.textContent = label;

    const number = document.createElement("h2");
    number.textContent = value;

    card.append(title, number);

    if (hint) {
        const small = document.createElement("span");
        small.className = "stat-hint";
        small.textContent = hint;
        card.appendChild(small);
    }

    return card;
}

function renderGradeSummary() {
    const partialGrades = grades.filter(grade => !grade.final);
    const all = getWeightedAverage(partialGrades);
    const { simple, ects, finalCount, ectsCount, ectsSum } = getOverallAverages();

    gradeSummary.replaceChildren(
        createSummaryCard(
            "Średnia ocen cząstkowych",
            all === null ? "–" : formatAverage(all),
            all === null ? "Brak ocen cząstkowych" : "Ważona, ze wszystkich przedmiotów"
        ),
        createSummaryCard(
            "Średnia ocen końcowych",
            simple === null ? "–" : formatAverage(simple),
            finalCount === 0 ? "Brak ocen końcowych" : `Przedmioty z oceną końcową: ${finalCount}`
        ),
        createSummaryCard(
            "Średnia ważona ECTS",
            ects === null ? "–" : formatAverage(ects),
            ects === null
                ? "Potrzebne oceny końcowe i ECTS przedmiotów"
                : `Z ${ectsCount} przedm. (${formatEcts(ectsSum)})`
        ),
        createSummaryCard("Liczba ocen", String(grades.length))
    );
}

// ---------- Lista przedmiotów z ocenami ----------

function createGradeChip(grade) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `grade-chip level-${getGradeLevel(grade.value)}`;

    const value = document.createElement("span");
    value.className = "grade-chip-value";
    value.textContent = formatGrade(grade.value);
    chip.appendChild(value);

    if (grade.label) {
        const label = document.createElement("span");
        label.className = "grade-chip-label";
        label.textContent = grade.label;
        chip.appendChild(label);
    }

    if (grade.weight !== 1) {
        const weight = document.createElement("span");
        weight.className = "grade-chip-weight";
        weight.textContent = `waga ${formatGrade(grade.weight)}`;
        chip.appendChild(weight);
    }

    const description = [
        `Ocena ${formatGrade(grade.value)}`,
        grade.label,
        grade.weight !== 1 && `waga ${formatGrade(grade.weight)}`,
        grade.date && formatDueDate(grade.date)
    ].filter(Boolean).join(", ");

    chip.title = `${description}\nKliknij, aby edytować`;
    chip.setAttribute("aria-label", `Edytuj ocenę: ${description}`);
    chip.addEventListener("click", () => openGradeDialog(grade));

    return chip;
}

function createAddGradeButton(subject, text = "+ Dodaj ocenę") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button grade-add";
    button.textContent = text;
    button.setAttribute("aria-label", `Dodaj ocenę z przedmiotu: ${subject.name}`);
    button.addEventListener("click", () => openGradeDialog(null, subject.id));
    return button;
}

function createGradeSubjectCard(subject) {
    const list = getSubjectGrades(subject.id);
    const partial = list.filter(grade => !grade.final);
    const final = list.find(grade => grade.final);
    const average = getWeightedAverage(list);

    const card = document.createElement("article");
    card.className = "grade-subject";
    card.style.setProperty("--hue", getSubjectHue(subject.name));

    // Nagłówek: nazwa + szczegóły, po prawej średnia i ocena końcowa.
    const header = document.createElement("div");
    header.className = "grade-subject-header";

    const titleBox = document.createElement("div");

    const name = document.createElement("h3");
    name.textContent = subject.name;
    titleBox.appendChild(name);

    const details = [
        subject.ects !== null && subject.ects !== undefined && formatEcts(subject.ects),
        subject.assessment
    ].filter(Boolean);

    if (details.length > 0) {
        const meta = document.createElement("p");
        meta.className = "grade-subject-meta";
        meta.textContent = details.join(" · ");
        titleBox.appendChild(meta);
    }

    const results = document.createElement("div");
    results.className = "grade-results";

    const averageBox = document.createElement("div");
    averageBox.className = "grade-result";
    averageBox.innerHTML = '<span class="grade-result-label">Średnia</span>';

    const averageValue = document.createElement("strong");
    averageValue.textContent = average === null ? "–" : formatAverage(average);

    if (average !== null) {
        averageValue.className = `level-${getGradeLevel(average)}`;
    }

    averageBox.appendChild(averageValue);
    results.appendChild(averageBox);

    const finalBox = document.createElement(final ? "button" : "div");
    finalBox.className = "grade-result grade-final";
    finalBox.innerHTML = '<span class="grade-result-label">Końcowa</span>';

    const finalValue = document.createElement("strong");
    finalValue.textContent = final ? formatGrade(final.value) : "–";

    if (final) {
        finalBox.type = "button";
        finalBox.classList.add(`level-${getGradeLevel(final.value)}`);
        finalBox.title = "Kliknij, aby edytować ocenę końcową";
        finalBox.setAttribute("aria-label", `Edytuj ocenę końcową: ${formatGrade(final.value)}`);
        finalBox.addEventListener("click", () => openGradeDialog(final));
    }

    finalBox.appendChild(finalValue);
    results.appendChild(finalBox);

    header.append(titleBox, results);
    card.appendChild(header);

    // Oceny cząstkowe
    if (partial.length > 0) {
        const chips = document.createElement("div");
        chips.className = "grade-chips";
        chips.append(...partial.map(createGradeChip));
        card.appendChild(chips);
    } else {
        const none = document.createElement("p");
        none.className = "grade-none";
        none.textContent = "Brak ocen cząstkowych.";
        card.appendChild(none);
    }

    card.appendChild(createAddGradeButton(subject));

    return card;
}

function renderGrades() {
    renderGradeSummary();

    const all = sortedSubjects();
    const withGrades = all.filter(subject => grades.some(grade => grade.subjectId === subject.id));
    const withoutGrades = all.filter(subject => !withGrades.includes(subject));

    gradesNoSubjects.hidden = all.length > 0;
    gradesEmpty.hidden = all.length === 0 || grades.length > 0;
    addGradeButton.disabled = all.length === 0;

    gradeSubjectList.replaceChildren(...withGrades.map(createGradeSubjectCard));

    // Przedmioty bez ocen – krótka lista z szybkim dodawaniem.
    if (withoutGrades.length > 0) {
        const section = document.createElement("section");
        section.className = "grade-pending";

        const heading = document.createElement("h3");
        heading.className = "todo-group";
        heading.textContent = withGrades.length > 0 ? "Przedmioty bez ocen" : "Twoje przedmioty";

        const list = document.createElement("ul");

        withoutGrades.forEach(subject => {
            const item = document.createElement("li");
            item.style.setProperty("--hue", getSubjectHue(subject.name));

            const name = document.createElement("span");
            name.textContent = subject.name;

            item.append(name, createAddGradeButton(subject, "+ Ocena"));
            list.appendChild(item);
        });

        section.append(heading, list);
        gradeSubjectList.appendChild(section);
    }
}

// ---------- Okno: dodawanie / edycja oceny ----------

function showGradeFormError(message, field) {
    gradeFormError.textContent = message;
    gradeFormError.hidden = false;
    field?.focus();
}

function hideGradeFormError() {
    gradeFormError.hidden = true;
}

function fillGradeSubjectOptions() {
    const options = sortedSubjects().map(subject => {
        const option = document.createElement("option");
        option.value = subject.id;
        option.textContent = subject.name;
        return option;
    });

    gradeSubject.replaceChildren(...options);
}

// Ocena końcowa nie ma wagi; ostrzegamy, jeśli zastąpi inną ocenę końcową przedmiotu.
function updateFinalState() {
    gradeWeight.disabled = gradeFinal.checked;

    const existing = getFinalGrade(gradeSubject.value);
    const replaces = gradeFinal.checked && existing && existing !== editingGrade;

    gradeFinalNote.hidden = !replaces;

    if (replaces) {
        gradeFinalNote.textContent =
            `Ten przedmiot ma już ocenę końcową (${formatGrade(existing.value)}) – nowa ją zastąpi.`;
    }
}

gradeFinal.addEventListener("change", updateFinalState);
gradeSubject.addEventListener("change", updateFinalState);

// grade – ocena do edycji (null = nowa), subjectId – przedmiot wybrany od razu.
function openGradeDialog(grade = null, subjectId = null) {
    if (subjects.length === 0) {
        return;
    }

    editingGrade = grade;
    const isEdit = grade !== null;

    gradeForm.reset();
    hideGradeFormError();
    fillGradeSubjectOptions();

    gradeDialogTitle.textContent = isEdit ? "Edytuj ocenę" : "Dodaj ocenę";
    gradeSaveButton.textContent = isEdit ? "Zapisz zmiany" : "Dodaj ocenę";

    if (isEdit) {
        gradeSubject.value = grade.subjectId;
        gradeValue.value = String(grade.value);
        gradeWeight.value = grade.weight;
        gradeLabel.value = grade.label;
        gradeDate.value = grade.date;
        gradeFinal.checked = grade.final;
    } else {
        if (subjectId) {
            gradeSubject.value = subjectId;
        }

        gradeWeight.value = 1;
        gradeDate.value = getTodayString();
    }

    updateFinalState();
    renderGradeDeleteArea();

    gradeDialog.showModal();

    // Gdy przedmiot jest już wybrany, zaczynamy od oceny.
    if (isEdit || subjectId) {
        gradeValue.focus();
    } else {
        gradeSubject.focus();
    }
}

addGradeButton.addEventListener("click", () => openGradeDialog());
gradeCancelButton.addEventListener("click", () => gradeDialog.close());

// Kliknięcie w tło (poza formularzem) zamyka okno.
gradeDialog.addEventListener("click", event => {
    if (event.target === gradeDialog) {
        gradeDialog.close();
    }
});

gradeDialog.addEventListener("close", () => {
    editingGrade = null;
});

// ---------- Zapisywanie ----------

gradeForm.addEventListener("submit", event => {
    event.preventDefault();

    const subjectId = gradeSubject.value;
    const value = Number(gradeValue.value);
    const final = gradeFinal.checked;
    const weight = final ? 1 : Number(gradeWeight.value);
    const label = gradeLabel.value.trim();
    const date = gradeDate.value;

    if (!getSubject(subjectId)) {
        return showGradeFormError("Wybierz przedmiot.", gradeSubject);
    }

    if (gradeValue.value === "") {
        return showGradeFormError("Wybierz ocenę.", gradeValue);
    }

    // Pole liczbowe zwraca "" dla pustej albo nieczytelnej wartości.
    if (!final && (gradeWeight.value === "" || weight <= 0 || weight > 100)) {
        return showGradeFormError("Waga musi być liczbą większą od 0 (np. 1 albo 2).", gradeWeight);
    }

    // Jedna ocena końcowa na przedmiot – poprzednia zostaje zastąpiona.
    const previousFinal = final ? getFinalGrade(subjectId) : null;

    if (previousFinal && previousFinal !== editingGrade) {
        grades = grades.filter(grade => grade !== previousFinal);
    }

    const subjectName = getSubject(subjectId).name;
    let message;

    if (editingGrade) {
        Object.assign(editingGrade, { subjectId, value, weight, label, date, final });
        message = `Zapisano zmiany oceny z przedmiotu „${subjectName}”.`;
    } else {
        grades.push({ id: crypto.randomUUID(), subjectId, value, weight, label, date, final });

        message = final
            ? `Dodano ocenę końcową ${formatGrade(value)} z przedmiotu „${subjectName}”.`
            : `Dodano ocenę ${formatGrade(value)} z przedmiotu „${subjectName}”.`;
    }

    finishGradeSaving(message);
});

// Zapis, odświeżenie widoków i komunikat.
function finishGradeSaving(message) {
    saveGrades();
    gradeDialog.close();
    renderGrades();
    renderSubjects(); // karty przedmiotów pokazują średnią
    showStatus(gradeStatus, "success", message);
}

// ---------- Usuwanie (tylko w trybie edycji) ----------

function renderGradeDeleteArea() {
    gradeDeleteArea.replaceChildren();

    if (!editingGrade) {
        return;
    }

    const grade = editingGrade;

    const deleteButton = makeDialogButton("Usuń", "delete-button", () => {
        const confirm = makeDialogButton("Czy na pewno chcesz usunąć?", "delete-button confirm", () => {
            grades = grades.filter(other => other.id !== grade.id);
            finishGradeSaving(`Usunięto ocenę ${formatGrade(grade.value)}.`);
        });

        const cancel = makeDialogButton("Nie usuwaj", "cancel-button", () => {
            renderGradeDeleteArea();
            gradeDeleteArea.querySelector("button")?.focus();
        });

        gradeDeleteArea.replaceChildren(confirm, cancel);
        confirm.focus();
    });

    gradeDeleteArea.appendChild(deleteButton);
}

document.querySelector("#gradesGoToSubjects").addEventListener("click", () => navigateTo("przedmioty"));
