// WŁASNE ZAJĘCIA: okno do dodawania, edycji i usuwania zajęć dodanych ręcznie (poza importem CSV).

import { useRef, useState } from "react";
import { useAppData } from "../AppData.jsx";
import { ConfirmDelete } from "../components/ConfirmDelete.jsx";
import { Dialog } from "../components/Dialog.jsx";
import { addDays, addMinutesToTime, formatDueDate, getTodayString, parseDateString, toDateString } from "../lib/dates.js";

const MAX_REPEATS = 52; // maks. liczba terminów przy powtarzaniu (rok)

// entry – edytowane zajęcia albo null (nowe), weekStart – oglądany tydzień (domyślna data).
export function ClassDialog({ entry, weekStart, onClose, onSaved }) {
    const { schedule, setSchedule } = useAppData();
    const isEdit = entry !== null;

    const [form, setForm] = useState(() => {
        if (isEdit) {
            return { ...entry, repeat: false, repeatUntil: "" };
        }

        // Domyślnie dziś, jeśli dzisiejszy dzień jest w oglądanym tygodniu, inaczej poniedziałek tego tygodnia.
        const today = getTodayString();
        const monday = toDateString(weekStart);
        const sunday = toDateString(addDays(weekStart, 6));

        return {
            subject: "",
            type: "",
            room: "",
            date: today >= monday && today <= sunday ? today : monday,
            start: "08:00",
            end: "09:30",
            repeat: false,
            repeatUntil: ""
        };
    });

    const [error, setError] = useState("");

    const fieldRefs = {
        subject: useRef(null),
        date: useRef(null),
        start: useRef(null),
        end: useRef(null),
        repeatUntil: useRef(null)
    };

    function update(field, value) {
        setForm(current => ({ ...current, [field]: value }));
    }

    function showError(message, field) {
        setError(message);
        fieldRefs[field]?.current?.focus();
    }

    // Po zmianie początku podpowiadamy koniec (+90 min), jeśli koniec byłby wcześniejszy.
    function handleStartChange(start) {
        setForm(current => ({
            ...current,
            start,
            end: start && (!current.end || current.end <= start) ? addMinutesToTime(start, 90) : current.end
        }));
    }

    // Domyślny koniec powtarzania: ostatni dzień planu albo 12 tygodni od daty zajęć.
    function handleRepeatChange(repeat) {
        setForm(current => {
            let repeatUntil = current.repeatUntil;

            if (repeat && !repeatUntil && current.date) {
                const lastPlanDate = schedule.map(item => item.date).sort().pop();
                const inTwelveWeeks = toDateString(addDays(parseDateString(current.date), 7 * 12));

                repeatUntil = lastPlanDate && lastPlanDate > current.date ? lastPlanDate : inTwelveWeeks;
            }

            return { ...current, repeat, repeatUntil };
        });
    }

    function handleSubmit(event) {
        event.preventDefault();

        const subject = form.subject.trim();
        const type = form.type.trim();
        const room = form.room.trim();
        const { date, start, end } = form;

        if (subject === "") {
            return showError("Podaj nazwę zajęć.", "subject");
        }

        if (date === "") {
            return showError("Wybierz datę zajęć.", "date");
        }

        if (start === "" || end === "") {
            return showError("Podaj godzinę rozpoczęcia i zakończenia.", start ? "end" : "start");
        }

        if (end <= start) {
            return showError("Zajęcia muszą kończyć się później, niż się zaczynają.", "end");
        }

        if (isEdit) {
            setSchedule(list => list.map(item => (
                item.id === entry.id ? { ...item, subject, type, room, date, start, end } : item
            )));

            onSaved(`Zapisano zmiany: „${subject}”.`, date);
            return;
        }

        // Terminy: jeden albo co tydzień aż do wybranej daty.
        const dates = [date];

        if (form.repeat) {
            const until = form.repeatUntil;

            if (until === "" || until <= date) {
                return showError("Data końca powtarzania musi być późniejsza niż data zajęć.", "repeatUntil");
            }

            let next = addDays(parseDateString(date), 7);

            while (toDateString(next) <= until) {
                dates.push(toDateString(next));
                next = addDays(next, 7);
            }

            if (dates.length > MAX_REPEATS) {
                return showError(
                    `Za dużo terminów (${dates.length}). Maksymalnie ${MAX_REPEATS} – wybierz wcześniejszą datę końca.`,
                    "repeatUntil"
                );
            }
        }

        // Zajęcia powtarzane dostają wspólny seriesId, żeby można było usunąć całą serię.
        const seriesId = dates.length > 1 ? crypto.randomUUID() : null;

        setSchedule(list => [
            ...list,
            ...dates.map(classDay => ({
                id: crypto.randomUUID(),
                date: classDay,
                start,
                end,
                subject,
                type,
                room,
                custom: true,
                seriesId
            }))
        ]);

        onSaved(
            dates.length > 1
                ? `Dodano zajęcia „${subject}” co tydzień od ${formatDueDate(date)} ` +
                  `do ${formatDueDate(dates[dates.length - 1])} (liczba terminów: ${dates.length}).`
                : `Dodano zajęcia „${subject}”: ${formatDueDate(date)}, ${start}–${end}.`,
            date
        );
    }

    // ---------- Usuwanie (tylko w trybie edycji) ----------

    function deleteEntries(shouldDelete, message) {
        setSchedule(list => list.filter(item => !shouldDelete(item)));
        onSaved(message, null);
    }

    const seriesSize = isEdit && entry.seriesId
        ? schedule.filter(item => item.seriesId === entry.seriesId).length
        : 1;

    const deleteActions = isEdit
        ? [
            {
                label: seriesSize > 1 ? "Usuń tylko te" : "Czy na pewno chcesz usunąć?",
                onConfirm: () => deleteEntries(
                    item => item.id === entry.id,
                    `Usunięto zajęcia „${entry.subject}” (${formatDueDate(entry.date)}).`
                )
            },
            ...(seriesSize > 1
                ? [{
                    label: `Usuń całą serię (${seriesSize})`,
                    onConfirm: () => deleteEntries(
                        item => item.seriesId === entry.seriesId,
                        `Usunięto serię zajęć „${entry.subject}” (liczba terminów: ${seriesSize}).`
                    )
                }]
                : [])
        ]
        : [];

    // Okno nowych zajęć otwiera przycisk z menu, które się zamyka – wtedy fokus wraca na zębatkę.
    return (
        <Dialog
            labelledBy="classDialogTitle"
            onClose={onClose}
            initialFocusRef={fieldRefs.subject}
            returnFocusSelector=".view:not([hidden]) .settings .icon-button"
        >
            <form className="dialog-body" noValidate onSubmit={handleSubmit}>
                <h3 id="classDialogTitle">{isEdit ? "Edytuj zajęcia" : "Dodaj własne zajęcia"}</h3>

                <label className="field">
                    <span>Nazwa zajęć <span className="required-mark">*</span></span>
                    <input type="text" ref={fieldRefs.subject} className="form-field" maxLength={100}
                        placeholder="np. Kurs języka niemieckiego"
                        value={form.subject} onChange={event => update("subject", event.target.value)} />
                </label>

                <div className="field-row">
                    <label className="field">
                        <span>Rodzaj zajęć</span>
                        <input type="text" className="form-field" maxLength={60} list="classTypeOptions"
                            placeholder="np. wykład"
                            value={form.type} onChange={event => update("type", event.target.value)} />
                    </label>

                    <label className="field field-small">
                        <span>Sala</span>
                        <input type="text" className="form-field" maxLength={30} placeholder="np. 1.38"
                            value={form.room} onChange={event => update("room", event.target.value)} />
                    </label>
                </div>

                <datalist id="classTypeOptions">
                    <option value="wykład" />
                    <option value="ćwiczenia audytoryjne" />
                    <option value="ćwiczenia laboratoryjne" />
                    <option value="zajęcia warsztatowe" />
                    <option value="seminarium" />
                    <option value="konsultacje" />
                </datalist>

                <div className="field-row">
                    <label className="field">
                        <span>Data <span className="required-mark">*</span></span>
                        <input type="date" ref={fieldRefs.date} className="form-field"
                            value={form.date} onChange={event => update("date", event.target.value)} />
                    </label>

                    <label className="field field-small">
                        <span>Od <span className="required-mark">*</span></span>
                        <input type="time" ref={fieldRefs.start} className="form-field"
                            value={form.start} onChange={event => handleStartChange(event.target.value)} />
                    </label>

                    <label className="field field-small">
                        <span>Do <span className="required-mark">*</span></span>
                        <input type="time" ref={fieldRefs.end} className="form-field"
                            value={form.end} onChange={event => update("end", event.target.value)} />
                    </label>
                </div>

                {/* Powtarzanie ma sens tylko przy dodawaniu nowych zajęć. */}
                {!isEdit && (
                    <div className="repeat-row">
                        <label className="checkbox-label">
                            <input type="checkbox" checked={form.repeat}
                                onChange={event => handleRepeatChange(event.target.checked)} />
                            Powtarzaj co tydzień
                        </label>

                        {form.repeat && (
                            <label className="field field-inline">
                                <span>do</span>
                                <input type="date" ref={fieldRefs.repeatUntil} className="form-field"
                                    value={form.repeatUntil} onChange={event => update("repeatUntil", event.target.value)} />
                            </label>
                        )}
                    </div>
                )}

                {error && <p className="field-error" role="alert">{error}</p>}

                <div className="dialog-actions">
                    {isEdit && (
                        <ConfirmDelete className="dialog-delete" actions={deleteActions} cancelLabel="Nie usuwaj" />
                    )}

                    <button type="button" className="cancel-button" onClick={onClose}>Anuluj</button>
                    <button type="submit">{isEdit ? "Zapisz zmiany" : "Dodaj zajęcia"}</button>
                </div>
            </form>
        </Dialog>
    );
}
