// Nawigacja między widokami i "przejścia z kontekstem", np. z kalendarza do formularza
// zadania z wpisaną datą, albo z podglądu zadania do kalendarza na dzień terminu.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getMonday, getTodayString, parseDateString } from "./lib/dates.js";

export const VIEWS = {
    dashboard: { label: "Dashboard", subtitle: "TWÓJ PANEL", title: "Witaj w StudyFlow!" },
    zadania: { label: "Moje zadania", subtitle: "ORGANIZACJA", title: "Moje zadania" },
    kalendarz: { label: "Kalendarz zadań", subtitle: "PLANOWANIE", title: "Kalendarz zadań" },
    "plan-zajec": { label: "Plan zajęć", subtitle: "PLANOWANIE", title: "Plan zajęć" },
    przedmioty: { label: "Przedmioty", subtitle: "STUDIA", title: "Przedmioty" },
    oceny: { label: "Oceny", subtitle: "STUDIA", title: "Oceny" },
    pomoc: { label: "Pomoc", subtitle: "ASYSTENT AI", title: "Pomoc w zadaniach" }
};

// Widok zależy od adresu, np. index.html#kalendarz.
function viewFromHash() {
    const name = window.location.hash.slice(1);
    return VIEWS[name] ? name : "dashboard";
}

const NavigationContext = createContext(null);

export function NavigationProvider({ children }) {
    const [view, setView] = useState(viewFromHash);

    // Kalendarz: wybrany dzień i oglądany miesiąc (pierwszy dzień miesiąca).
    const [selectedDate, setSelectedDate] = useState(getTodayString);
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    // Plan zajęć: poniedziałek oglądanego tygodnia.
    const [scheduleWeek, setScheduleWeek] = useState(() => getMonday(new Date()));

    // Prośba o otwarcie formularza zadania z wypełnionymi polami: { dueDate?, subjectId?, key }.
    const [taskFormRequest, setTaskFormRequest] = useState(null);

    // Zadanie pokazane w oknie podglądu (id albo null).
    const [previewTaskId, setPreviewTaskId] = useState(null);

    // Prośba o pomoc AI do konkretnego zadania: { taskId, key }.
    const [helpRequest, setHelpRequest] = useState(null);

    useEffect(() => {
        const onHashChange = () => setView(viewFromHash());
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    const navigate = useCallback(name => {
        window.location.hash = name;
        setView(name);
    }, []);

    const value = useMemo(() => ({
        view,
        navigate,

        selectedDate,
        setSelectedDate,
        calendarMonth,
        setCalendarMonth,
        scheduleWeek,
        setScheduleWeek,

        taskFormRequest,
        previewTaskId,
        openTaskPreview: setPreviewTaskId,
        closeTaskPreview: () => setPreviewTaskId(null),

        // Formularz zadania (Moje zadania) z wpisaną datą i/lub przedmiotem.
        openTaskForm(prefill = {}) {
            setTaskFormRequest({ ...prefill, key: Date.now() });
            navigate("zadania");
        },

        // Kalendarz na danym dniu.
        showInCalendar(dateString) {
            const date = parseDateString(dateString);
            setSelectedDate(dateString);
            setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
            navigate("kalendarz");
        },

        // Plan zajęć na tygodniu z danym dniem.
        showInSchedule(dateString) {
            setScheduleWeek(getMonday(parseDateString(dateString)));
            navigate("plan-zajec");
        },

        // Zakładka Pomoc z wybranym zadaniem jako kontekstem rozmowy.
        helpRequest,
        openHelp(taskId) {
            setHelpRequest({ taskId, key: Date.now() });
            navigate("pomoc");
        }
    }), [view, navigate, selectedDate, calendarMonth, scheduleWeek, taskFormRequest, previewTaskId, helpRequest]);

    return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
    return useContext(NavigationContext);
}
