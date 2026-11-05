// Dane zalogowanego użytkownika (zadania, przedmioty, plan zajęć, oceny) dostępne w każdym
// komponencie przez useAppData(). Wszystko jest zapisywane w Firestore, na koncie użytkownika,
// więc te same dane widać na każdym urządzeniu.

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useCloudList } from "./hooks/useCloudList.js";

const AppDataContext = createContext(null);

// Stare wpisy planu bez daty (z pierwszej wersji aplikacji) pomijamy.
const withDate = entries => (Array.isArray(entries) ? entries.filter(entry => entry.date) : []);
const asList = items => (Array.isArray(items) ? items : []);

export function AppDataProvider({ uid, children }) {
    const [syncError, setSyncError] = useState(null);

    const onError = useCallback(error => {
        console.error(error);
        setSyncError(error.code === "permission-denied"
            ? "Brak dostępu do danych. Sprawdź reguły bazy Firestore (README)."
            : "Nie udało się zapisać albo wczytać danych. Zmiany zostaną wysłane, gdy połączenie wróci.");
    }, []);

    const [tasks, setTasks, tasksInfo] = useCloudList(uid, "tasks", { sanitize: asList, onError });
    const [subjects, setSubjects, subjectsInfo] = useCloudList(uid, "subjects", { sanitize: asList, onError });
    const [schedule, setSchedule, scheduleInfo] = useCloudList(uid, "schedule", { sanitize: withDate, onError });
    const [grades, setGrades, gradesInfo] = useCloudList(uid, "grades", { sanitize: asList, onError });

    const infos = [tasksInfo, subjectsInfo, scheduleInfo, gradesInfo];
    const loaded = infos.every(info => info.loaded);
    const isEmpty = infos.every(info => !info.exists);

    const value = useMemo(() => {
        const getSubject = id => (id ? subjects.find(subject => subject.id === id) : undefined);

        return {
            loaded,
            isEmpty,
            syncError,
            clearSyncError: () => setSyncError(null),

            tasks,
            subjects,
            schedule,
            grades,
            setTasks,
            setSubjects,
            setSchedule,
            setGrades,
            getSubject,

            updateTask(id, changes) {
                setTasks(list => list.map(task => (task.id === id ? { ...task, ...changes } : task)));
            },

            // Zadania przedmiotu zostają (bez przypisania), oceny są usuwane razem z nim.
            deleteSubject(id) {
                setSubjects(list => list.filter(subject => subject.id !== id));
                setTasks(list => list.map(task => (task.subjectId === id ? { ...task, subjectId: null } : task)));
                setGrades(list => list.filter(grade => grade.subjectId !== id));
            }
        };
    }, [loaded, isEmpty, syncError, tasks, subjects, schedule, grades, setTasks, setSubjects, setSchedule, setGrades]);

    return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
    return useContext(AppDataContext);
}
