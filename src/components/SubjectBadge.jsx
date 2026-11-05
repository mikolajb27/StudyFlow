import { getSubjectHue } from "../lib/schedule.js";

// Kolorowa etykieta przedmiotu (w liście zadań, kalendarzu, podglądzie).
export function SubjectBadge({ subject }) {
    return (
        <span className="subject-badge" style={{ "--hue": getSubjectHue(subject.name) }}>
            {subject.name}
        </span>
    );
}

// Styl z kolorem przedmiotu (zmienna CSS --hue) albo nic, gdy brak przedmiotu.
export function subjectHueStyle(subject) {
    return subject ? { "--hue": getSubjectHue(subject.name) } : undefined;
}
