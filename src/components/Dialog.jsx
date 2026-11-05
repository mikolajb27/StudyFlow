import { useEffect, useRef } from "react";

// Okno dialogowe (<dialog> jako modal). Komponent jest otwarty, dopóki jest wyrenderowany –
// rodzic zamyka okno, przestając go renderować (onClose).
// - Esc i kliknięcie w tło wywołują onClose,
// - initialFocusRef – pole, które dostaje fokus po otwarciu,
// - po zamknięciu fokus wraca na element, z którego otwarto okno, a jeśli zniknął –
//   na element pasujący do returnFocusSelector.
export function Dialog({ labelledBy, onClose, initialFocusRef, returnFocusSelector, children }) {
    const dialogRef = useRef(null);
    const restoreTimer = useRef(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        const opener = document.activeElement;

        // W trybie deweloperskim React montuje komponent dwa razy – anulujemy wtedy
        // przywracanie fokusu zaplanowane przy pierwszym odmontowaniu.
        clearTimeout(restoreTimer.current);

        if (!dialog.open) {
            dialog.showModal();
        }

        initialFocusRef?.current?.focus();

        return () => {
            if (dialog.open) {
                dialog.close();
            }

            restoreTimer.current = setTimeout(() => {
                const target = opener?.isConnected
                    ? opener
                    : returnFocusSelector && document.querySelector(returnFocusSelector);

                target?.focus?.();
            });
        };
        // Okno otwieramy raz, przy zamontowaniu.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className="dialog"
            aria-labelledby={labelledBy}
            onCancel={event => {
                event.preventDefault();
                onClose();
            }}
            onClick={event => {
                if (event.target === dialogRef.current) {
                    onClose();
                }
            }}
        >
            {children}
        </dialog>
    );
}
