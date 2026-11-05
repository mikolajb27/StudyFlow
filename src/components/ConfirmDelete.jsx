import { useEffect, useRef, useState } from "react";

// Usuwanie w dwóch krokach: najpierw "Usuń", potem potwierdzenie (jedno albo kilka,
// np. "Usuń tylko te" / "Usuń całą serię") i przycisk anulowania.
// actions: [{ label, onConfirm }]
export function ConfirmDelete({ label = "Usuń", actions, cancelLabel = "Anuluj", className }) {
    const [confirming, setConfirming] = useState(false);
    const firstActionRef = useRef(null);
    const deleteRef = useRef(null);
    const wasConfirming = useRef(false);

    // Fokus: na pierwsze potwierdzenie po kliknięciu "Usuń", z powrotem na "Usuń" po anulowaniu.
    useEffect(() => {
        if (confirming) {
            firstActionRef.current?.focus();
        } else if (wasConfirming.current) {
            deleteRef.current?.focus();
        }

        wasConfirming.current = confirming;
    }, [confirming]);

    if (!confirming) {
        return (
            <div className={className}>
                <button type="button" ref={deleteRef} className="delete-button" onClick={() => setConfirming(true)}>
                    {label}
                </button>
            </div>
        );
    }

    return (
        <div className={className}>
            {actions.map((action, index) => (
                <button
                    key={action.label}
                    type="button"
                    ref={index === 0 ? firstActionRef : undefined}
                    className="delete-button confirm"
                    onClick={action.onConfirm}
                >
                    {action.label}
                </button>
            ))}

            <button type="button" className="cancel-button" onClick={() => setConfirming(false)}>
                {cancelLabel}
            </button>
        </div>
    );
}
