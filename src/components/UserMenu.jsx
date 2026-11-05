import { useRef, useState } from "react";
import { useAuth } from "../Auth.jsx";
import { useDismiss } from "../hooks/useDismiss.js";

// "Mikołaj Bacik" -> "MB", bez imienia: pierwsza litera e-maila.
function getInitials(user) {
    const words = (user.displayName || "").trim().split(/\s+/).filter(Boolean);

    if (words.length > 0) {
        return words.slice(0, 2).map(word => word[0].toUpperCase()).join("");
    }

    return (user.email || "?")[0].toUpperCase();
}

// Awatar w nagłówku z menu konta (kto jest zalogowany, wylogowanie).
export function UserMenu() {
    const { user, logOut } = useAuth();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const wrapperRef = useRef(null);
    const buttonRef = useRef(null);

    useDismiss(open, () => setOpen(false), wrapperRef, buttonRef);

    return (
        <div className="settings" ref={wrapperRef}>
            <button
                type="button"
                ref={buttonRef}
                className="user-avatar"
                aria-label="Konto"
                aria-haspopup="true"
                aria-expanded={open}
                title={user.email}
                onClick={() => setOpen(!open)}
            >
                {getInitials(user)}
            </button>

            {open && (
                <div className="settings-menu user-menu">
                    <p className="settings-menu-title">Zalogowano jako</p>
                    {user.displayName && <p className="user-menu-name">{user.displayName}</p>}
                    <p className="user-menu-email">{user.email}</p>

                    <button
                        type="button"
                        className="secondary-button settings-menu-item"
                        disabled={busy}
                        onClick={() => {
                            setBusy(true);
                            logOut();
                        }}
                    >
                        {busy ? "Wylogowywanie…" : "Wyloguj się"}
                    </button>
                </div>
            )}
        </div>
    );
}
