// Oceny: cząstkowe (z wagą) i jedna ocena końcowa na przedmiot.
// Ocena: { id, subjectId, value, label, weight, date "RRRR-MM-DD" | "", final }

export const GRADE_OPTIONS = [
    { value: 5, label: "5 – bardzo dobry" },
    { value: 4.5, label: "4,5 – dobry plus" },
    { value: 4, label: "4 – dobry" },
    { value: 3.5, label: "3,5 – dostateczny plus" },
    { value: 3, label: "3 – dostateczny" },
    { value: 2, label: "2 – niedostateczny" }
];

// 3.5 -> "3,5", 4 -> "4"
export function formatGrade(value) {
    return String(value).replace(".", ",");
}

// 4.1666 -> "4,17"
export function formatAverage(value) {
    return value.toFixed(2).replace(".", ",");
}

// Poziom oceny – do kolorów (2 = niezaliczone, 3–3,5, 4, 4,5–5).
export function getGradeLevel(value) {
    if (value < 3) return "fail";
    if (value < 4) return "ok";
    if (value < 4.5) return "good";
    return "great";
}

export function getSubjectGrades(grades, subjectId) {
    return grades
        .filter(grade => grade.subjectId === subjectId)
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

export function getFinalGrade(grades, subjectId) {
    return grades.find(grade => grade.subjectId === subjectId && grade.final);
}

// Średnia ważona ocen cząstkowych (bez oceny końcowej). null, gdy brak ocen.
export function getWeightedAverage(list) {
    const partial = list.filter(grade => !grade.final);
    const weightSum = partial.reduce((sum, grade) => sum + grade.weight, 0);

    if (weightSum === 0) {
        return null;
    }

    return partial.reduce((sum, grade) => sum + grade.value * grade.weight, 0) / weightSum;
}

// Średnia ocen końcowych i średnia ważona punktami ECTS.
export function getOverallAverages(subjects, grades) {
    const finals = subjects
        .map(subject => ({ subject, final: getFinalGrade(grades, subject.id) }))
        .filter(item => item.final);

    const simple = finals.length === 0
        ? null
        : finals.reduce((sum, item) => sum + item.final.value, 0) / finals.length;

    const withEcts = finals.filter(item => item.subject.ects > 0);
    const ectsSum = withEcts.reduce((sum, item) => sum + item.subject.ects, 0);

    const ects = ectsSum === 0
        ? null
        : withEcts.reduce((sum, item) => sum + item.final.value * item.subject.ects, 0) / ectsSum;

    return { simple, ects, finalCount: finals.length, ectsCount: withEcts.length, ectsSum };
}

// Krótki opis do karty przedmiotu: "Oceny: średnia 4,17 · końcowa 4,5"
export function getSubjectGradeSummary(grades, subjectId) {
    const average = getWeightedAverage(getSubjectGrades(grades, subjectId));
    const final = getFinalGrade(grades, subjectId);

    const parts = [];

    if (average !== null) parts.push(`średnia ${formatAverage(average)}`);
    if (final) parts.push(`końcowa ${formatGrade(final.value)}`);

    return parts.length === 0 ? "" : `Oceny: ${parts.join(" · ")}`;
}
