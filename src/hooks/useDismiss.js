import { useEffect, useRef } from "react";

// Zamykanie rozwijanego menu: kliknięcie poza nim albo Esc (wtedy fokus wraca na przycisk menu).
// containerRef – całe menu razem z przyciskiem, triggerRef – przycisk otwierający.
export function useDismiss(open, onClose, containerRef, triggerRef) {
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!open) {
            return;
        }

        // composedPath() pamięta, gdzie kliknięto, nawet jeśli kliknięty przycisk został już
        // podmieniony (np. "Wyczyść plan" -> potwierdzenie).
        const onClick = event => {
            if (!event.composedPath().includes(containerRef.current)) {
                onCloseRef.current();
            }
        };

        const onKeyDown = event => {
            if (event.key === "Escape") {
                onCloseRef.current();
                triggerRef?.current?.focus();
            }
        };

        document.addEventListener("click", onClick);
        document.addEventListener("keydown", onKeyDown);

        return () => {
            document.removeEventListener("click", onClick);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open, containerRef, triggerRef]);
}
