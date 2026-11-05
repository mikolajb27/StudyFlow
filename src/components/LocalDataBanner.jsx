import { useState } from "react";
import { useAppData } from "../AppData.jsx";
import { markLocalDataHandled, mergeById, readLocalData } from "../lib/localData.js";
import { StatusMessage } from "./StatusMessage.jsx";

// Propozycja przeniesienia na konto danych zapisanych w tej przeglądarce przed logowaniem.
export function LocalDataBanner() {
    const { setTasks, setSubjects, setSchedule, setGrades } = useAppData();

    const [localData, setLocalData] = useState(readLocalData);
    const [done, setDone] = useState(null);

    if (done) {
        return <StatusMessage status={done} />;
    }

    if (!localData) {
        return null;
    }

    const counts = [
        localData.tasks.length > 0 && `zadania: ${localData.tasks.length}`,
        localData.subjects.length > 0 && `przedmioty: ${localData.subjects.length}`,
        localData.schedule.length > 0 && `zajęcia w planie: ${localData.schedule.length}`,
        localData.grades.length > 0 && `oceny: ${localData.grades.length}`
    ].filter(Boolean);

    function transfer() {
        setTasks(list => mergeById(list, localData.tasks));
        setSubjects(list => mergeById(list, localData.subjects));
        setSchedule(list => mergeById(list, localData.schedule));
        setGrades(list => mergeById(list, localData.grades));

        markLocalDataHandled();
        setLocalData(null);
        setDone({ kind: "success", message: `Przeniesiono dane na Twoje konto (${counts.join(", ")}).` });
    }

    function skip() {
        markLocalDataHandled();
        setLocalData(null);
    }

    return (
        <div className="subjects-hint app-banner">
            <p>
                W tej przeglądarce są dane zapisane przed zalogowaniem ({counts.join(", ")}).
                Przenieść je na Twoje konto?
            </p>

            <div className="app-banner-actions">
                <button type="button" onClick={transfer}>Przenieś na konto</button>
                <button type="button" className="secondary-button" onClick={skip}>Nie, dziękuję</button>
            </div>
        </div>
    );
}
