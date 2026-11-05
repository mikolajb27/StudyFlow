// WŁASNE ZAJĘCIA
// Okno do dodawania, edycji i usuwania zajęć dodanych ręcznie (poza importem CSV).
// Korzysta z schedule.js: schedule, saveSchedule, renderSchedule, weekStart, getMonday,
// addDays, toMinutes, closeSettingsMenu, showImportStatus
// oraz z script.js / calendar.js: toDateString, getTodayString, formatDueDate, parseDateString.

const classDialog = document.querySelector("#classDialog");
const classForm = document.querySelector("#classForm");
const classDialogTitle = document.querySelector("#classDialogTitle");
const classSubject = document.querySelector("#classSubject");
const classType = document.querySelector("#classType");
const classRoom = document.querySelector("#classRoom");
const classDate = document.querySelector("#classDate");
const classStart = document.querySelector("#classStart");
const classEnd = document.querySelector("#classEnd");
const classRepeatRow = document.querySelector("#classRepeatRow");
const classRepeat = document.querySelector("#classRepeat");
const classRepeatUntilField = document.querySelector("#classRepeatUntilField");
const classRepeatUntil = document.querySelector("#classRepeatUntil");
const classFormError = document.querySelector("#classFormError");
const classDeleteArea = document.querySelector("#classDeleteArea");
const classCancelButton = document.querySelector("#classCancel");
const classSaveButton = document.querySelector("#classSave");
const addCustomClassButton = document.querySelector("#addCustomClass");

const MAX_REPEATS = 52; // maks. liczba terminów przy powtarzaniu (rok)

let editingEntry = null; // zajęcia edytowane w oknie (null = dodawanie nowych)

// "08:00" + 90 min -> "09:30" (najpóźniej 23:59)
function addMinutesToTime(time, minutes) {
    const total = Math.min(toMinutes(time) + minutes, 23 * 60 + 59);
    const hours = String(Math.floor(total / 60)).padStart(2, "0");
    const mins = String(total % 60).padStart(2, "0");

    return `${hours}:${mins}`;
}

function showClassFormError(message, field) {
    classFormError.textContent = message;
    classFormError.hidden = false;
    field?.focus();
}

function hideClassFormError() {
    classFormError.hidden = true;
}

// ---------- Otwieranie okna ----------

function openClassDialog(entry = null) {
    editingEntry = entry;
    const isEdit = entry !== null;

    classForm.reset();
    hideClassFormError();

    classDialogTitle.textContent = isEdit ? "Edytuj zajęcia" : "Dodaj własne zajęcia";
    classSaveButton.textContent = isEdit ? "Zapisz zmiany" : "Dodaj zajęcia";

    // Powtarzanie ma sens tylko przy dodawaniu nowych zajęć.
    classRepeatRow.hidden = isEdit;
    classRepeatUntilField.hidden = true;

    if (isEdit) {
        classSubject.value = entry.subject;
        classType.value = entry.type;
        classRoom.value = entry.room;
        classDate.value = entry.date;
        classStart.value = entry.start;
        classEnd.value = entry.end;
    } else {
        // Domyślnie dziś, jeśli dzisiejszy dzień jest w oglądanym tygodniu, inaczej poniedziałek tego tygodnia.
        const today = getTodayString();
        const monday = toDateString(weekStart);
        const sunday = toDateString(addDays(weekStart, 6));

        classDate.value = today >= monday && today <= sunday ? today : monday;
        classStart.value = "08:00";
        classEnd.value = "09:30";
    }

    renderClassDeleteArea();
    closeSettingsMenu();

    classDialog.showModal();
    classSubject.focus();
}

addCustomClassButton.addEventListener("click", () => openClassDialog());

// ---------- Zachowanie pól ----------

// Po zmianie początku podpowiadamy koniec (+90 min), jeśli koniec byłby wcześniejszy.
classStart.addEventListener("change", () => {
    if (classStart.value && (!classEnd.value || classEnd.value <= classStart.value)) {
        classEnd.value = addMinutesToTime(classStart.value, 90);
    }
});

classRepeat.addEventListener("change", () => {
    classRepeatUntilField.hidden = !classRepeat.checked;

    // Domyślny koniec powtarzania: ostatni dzień planu albo 12 tygodni od daty zajęć.
    if (classRepeat.checked && !classRepeatUntil.value && classDate.value) {
        const lastPlanDate = schedule.map(entry => entry.date).sort().pop();
        const inTwelveWeeks = toDateString(addDays(parseDateString(classDate.value), 7 * 12));

        classRepeatUntil.value = lastPlanDate && lastPlanDate > classDate.value
            ? lastPlanDate
            : inTwelveWeeks;
    }
});

classCancelButton.addEventListener("click", () => classDialog.close());

// Kliknięcie w tło (poza formularzem) zamyka okno.
classDialog.addEventListener("click", event => {
    if (event.target === classDialog) {
        classDialog.close();
    }
});

classDialog.addEventListener("close", () => {
    editingEntry = null;
});

// ---------- Zapisywanie ----------

classForm.addEventListener("submit", event => {
    event.preventDefault();

    const subject = classSubject.value.trim();
    const type = classType.value.trim();
    const room = classRoom.value.trim();
    const date = classDate.value;
    const start = classStart.value;
    const end = classEnd.value;

    if (subject === "") {
        return showClassFormError("Podaj nazwę zajęć.", classSubject);
    }

    if (date === "") {
        return showClassFormError("Wybierz datę zajęć.", classDate);
    }

    if (start === "" || end === "") {
        return showClassFormError("Podaj godzinę rozpoczęcia i zakończenia.", start ? classEnd : classStart);
    }

    if (end <= start) {
        return showClassFormError("Zajęcia muszą kończyć się później, niż się zaczynają.", classEnd);
    }

    if (editingEntry) {
        Object.assign(editingEntry, { subject, type, room, date, start, end });

        finishSaving(date, `Zapisano zmiany: „${subject}”.`);
        return;
    }

    // Terminy: jeden albo co tydzień aż do wybranej daty.
    const dates = [date];

    if (classRepeat.checked) {
        const until = classRepeatUntil.value;

        if (until === "" || until <= date) {
            return showClassFormError("Data końca powtarzania musi być późniejsza niż data zajęć.", classRepeatUntil);
        }

        let next = addDays(parseDateString(date), 7);

        while (toDateString(next) <= until) {
            dates.push(toDateString(next));
            next = addDays(next, 7);
        }

        if (dates.length > MAX_REPEATS) {
            return showClassFormError(
                `Za dużo terminów (${dates.length}). Maksymalnie ${MAX_REPEATS} – wybierz wcześniejszą datę końca.`,
                classRepeatUntil
            );
        }
    }

    // Zajęcia powtarzane dostają wspólny seriesId, żeby można było usunąć całą serię.
    const seriesId = dates.length > 1 ? crypto.randomUUID() : null;

    dates.forEach(classDay => {
        schedule.push({
            id: crypto.randomUUID(),
            date: classDay,
            start,
            end,
            subject,
            type,
            room,
            custom: true,
            seriesId
        });
    });

    const message = dates.length > 1
        ? `Dodano zajęcia „${subject}” co tydzień od ${formatDueDate(date)} ` +
          `do ${formatDueDate(dates[dates.length - 1])} (liczba terminów: ${dates.length}).`
        : `Dodano zajęcia „${subject}”: ${formatDueDate(date)}, ${start}–${end}.`;

    finishSaving(date, message);
});

// Zapis, przejście do tygodnia z zajęciami i komunikat.
function finishSaving(date, message) {
    saveSchedule();
    weekStart = getMonday(parseDateString(date));
    renderSchedule();
    classDialog.close();
    showImportStatus("success", message);
}

// ---------- Usuwanie (tylko w trybie edycji) ----------

function makeDialogButton(text, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    button.addEventListener("click", onClick);
    return button;
}

function deleteCustomEntries(shouldDelete, message) {
    schedule = schedule.filter(entry => !shouldDelete(entry));
    saveSchedule();
    renderSchedule();
    classDialog.close();
    showImportStatus("success", message);
}

function renderClassDeleteArea() {
    classDeleteArea.replaceChildren();

    if (!editingEntry) {
        return;
    }

    const entry = editingEntry;
    const seriesSize = entry.seriesId
        ? schedule.filter(other => other.seriesId === entry.seriesId).length
        : 1;

    const deleteButton = makeDialogButton("Usuń", "delete-button", () => {
        const cancel = makeDialogButton("Nie usuwaj", "cancel-button", () => {
            renderClassDeleteArea();
            deleteButton.focus();
        });

        const deleteOne = makeDialogButton(
            seriesSize > 1 ? "Usuń tylko te" : "Czy na pewno chcesz usunąć?",
            "delete-button confirm",
            () => deleteCustomEntries(
                other => other.id === entry.id,
                `Usunięto zajęcia „${entry.subject}” (${formatDueDate(entry.date)}).`
            )
        );

        const buttons = [deleteOne];

        if (seriesSize > 1) {
            buttons.push(makeDialogButton(
                `Usuń całą serię (${seriesSize})`,
                "delete-button confirm",
                () => deleteCustomEntries(
                    other => other.seriesId === entry.seriesId,
                    `Usunięto serię zajęć „${entry.subject}” (liczba terminów: ${seriesSize}).`
                )
            ));
        }

        buttons.push(cancel);
        classDeleteArea.replaceChildren(...buttons);
        deleteOne.focus();
    });

    classDeleteArea.appendChild(deleteButton);
}
