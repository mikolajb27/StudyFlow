import { useEffect, useState } from "react";

// Aktualny czas, odświeżany co intervalMs (domyślnie co minutę) i po powrocie do karty,
// bo przeglądarka spowalnia liczniki w kartach w tle.
export function useNow(intervalMs = 60 * 1000) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const update = () => setNow(new Date());
        const timer = setInterval(update, intervalMs);

        const onVisibilityChange = () => {
            if (!document.hidden) update();
        };

        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [intervalMs]);

    return now;
}
