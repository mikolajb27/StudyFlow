// Daty i godziny. Daty zapisujemy jako tekst "RRRR-MM-DD", godziny jako "GG:MM".

const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateString(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${date.getFullYear()}-${month}-${day}`;
}

export function getTodayString() {
    return toDateString(new Date());
}

export function getCurrentTimeString(now = new Date()) {
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    return `${hours}:${minutes}`;
}

// "RRRR-MM-DD" -> Date (czas lokalny).
export function parseDateString(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
}

// "2026-11-20" -> "20 listopada 2026"; brak albo błędna data -> "brak daty".
export function formatDueDate(dateString) {
    const [year, month, day] = (dateString || "").split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())) {
        return "brak daty";
    }

    return date.toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

export function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export function toMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}

// "08:00" + 90 min -> "09:30" (najpóźniej 23:59)
export function addMinutesToTime(time, minutes) {
    const total = Math.min(toMinutes(time) + minutes, 23 * 60 + 59);
    const hours = String(Math.floor(total / 60)).padStart(2, "0");
    const mins = String(total % 60).padStart(2, "0");

    return `${hours}:${mins}`;
}

export function getMonday(date) {
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return monday;
}

export function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// "5–11 października 2026", "28 września – 4 października 2026", "28 grudnia 2026 – 3 stycznia 2027"
export function formatWeekRange(monday) {
    const sunday = addDays(monday, 6);
    const end = sunday.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });

    if (monday.getMonth() === sunday.getMonth()) {
        return `${monday.getDate()}–${end}`;
    }

    const startOptions = monday.getFullYear() === sunday.getFullYear()
        ? { day: "numeric", month: "long" }
        : { day: "numeric", month: "long", year: "numeric" };

    return `${monday.toLocaleDateString("pl-PL", startOptions)} – ${end}`;
}

// Data i godzina jako Date (czas lokalny).
export function toDateTime(dateString, time) {
    const date = parseDateString(dateString);
    const [hours, minutes] = time.split(":").map(Number);
    date.setHours(hours, minutes);
    return date;
}

// Ile dni kalendarzowych od dziś (0 = dziś, 1 = jutro, -1 = wczoraj).
export function daysFromToday(dateString) {
    const today = parseDateString(getTodayString());
    return Math.round((parseDateString(dateString) - today) / DAY_MS);
}

export function pluralDays(count) {
    return count === 1 ? "1 dzień" : `${count} dni`;
}

// "Dziś", "Jutro", "Czwartek" (w tym tygodniu), "Pon., 16 listopada" (później)
export function formatRelativeDay(dateString) {
    const days = daysFromToday(dateString);
    const date = parseDateString(dateString);

    if (days === 0) return "Dziś";
    if (days === 1) return "Jutro";

    if (days > 1 && days < 7) {
        return capitalize(date.toLocaleDateString("pl-PL", { weekday: "long" }));
    }

    return capitalize(date.toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "long" }));
}

// Za ile minut / godzin / dni coś się zaczyna.
export function formatCountdown(target, now = new Date()) {
    const minutes = Math.round((target - now) / 60000);

    if (minutes < 1) return "za chwilę";
    if (minutes < 60) return `za ${minutes} min`;

    if (minutes < 24 * 60) {
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        return rest === 0 ? `za ${hours} godz.` : `za ${hours} godz. ${rest} min`;
    }

    return `za ${pluralDays(Math.round(minutes / (24 * 60)))}`;
}
