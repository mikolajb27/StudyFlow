import { useRef } from "react";
import { useAppData } from "../AppData.jsx";
import { useNavigation } from "../Navigation.jsx";
import { getDueLabel } from "../lib/tasks.js";
import { Dialog } from "./Dialog.jsx";
import { SubjectBadge } from "./SubjectBadge.jsx";

// Podgląd zadania – otwierany z dashboardu i z kart przedmiotów.
// Elementy, które go otwierają, mają klasę "preview-trigger" i data-task-id,
// żeby po zamknięciu fokus mógł na nie wrócić nawet po przerysowaniu listy.
export function TaskPreviewDialog() {
    const { tasks, getSubject, updateTask } = useAppData();
    const { previewTaskId, closeTaskPreview, showInCalendar, openHelp } = useNavigation();
    const closeRef = useRef(null);

    const task = tasks.find(item => item.id === previewTaskId);

    if (!task) {
        return null;
    }

    const subject = getSubject(task.subjectId);
    const due = task.dueDate ? getDueLabel(task) : { label: "brak daty", overdue: false };

    return (
        <Dialog
            labelledBy="taskPreviewTitle"
            onClose={closeTaskPreview}
            initialFocusRef={closeRef}
            returnFocusSelector={`.view:not([hidden]) .preview-trigger[data-task-id="${task.id}"]`}
        >
            <div className="dialog-body task-preview">
                {subject && (
                    <div className="task-preview-subject">
                        <SubjectBadge subject={subject} />
                    </div>
                )}

                <h3 id="taskPreviewTitle" className={task.completed ? "completed" : undefined}>
                    {task.title}
                </h3>

                <dl className="task-preview-details">
                    <dt>Termin</dt>
                    <dd id="taskPreviewDue" className={due.overdue ? "overdue" : undefined}>{due.label}</dd>

                    <dt>Opis</dt>
                    <dd id="taskPreviewDescription" className={task.description ? undefined : "empty"}>
                        {task.description || "Brak opisu."}
                    </dd>
                </dl>

                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={event => updateTask(task.id, { completed: event.target.checked })}
                    />
                    Ukończone
                </label>

                <div className="dialog-actions">
                    {!task.completed && (
                        <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                                closeTaskPreview();
                                openHelp(task.id);
                            }}
                        >
                            Pomoc AI
                        </button>
                    )}

                    {task.dueDate && (
                        <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                                closeTaskPreview();
                                showInCalendar(task.dueDate);
                            }}
                        >
                            Pokaż w kalendarzu
                        </button>
                    )}

                    <button type="button" ref={closeRef} className="cancel-button" onClick={closeTaskPreview}>
                        Zamknij
                    </button>
                </div>
            </div>
        </Dialog>
    );
}
