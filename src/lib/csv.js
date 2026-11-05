// Odczyt i zapis plików CSV (plan zajęć, przedmioty).

// "Nazwa_przedmiotu" -> "nazwa przedmiotu": małe litery, bez polskich znaków i podkreśleń.
export function normalize(text) {
    return text
        .toLowerCase()
        .replace(/ł/g, "l")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[_.]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// Separator: średnik, przecinek albo tabulator.
function detectDelimiter(firstLine) {
    const candidates = [";", ",", "\t"];
    let best = ",";
    let bestCount = 0;

    candidates.forEach(candidate => {
        const count = firstLine.split(candidate).length - 1;

        if (count > bestCount) {
            best = candidate;
            bestCount = count;
        }
    });

    return best;
}

// Dzielimy tekst CSV na wiersze i komórki (obsługuje pola w cudzysłowach).
// Zwraca [{ cells: [...], line: numer wiersza w pliku }], bez pustych wierszy.
export function parseCsv(text) {
    text = text.replace(/^﻿/, "");

    const delimiter = detectDelimiter(text.split(/\r?\n/)[0]);
    const rows = [];

    let row = [];
    let field = "";
    let inQuotes = false;
    let line = 1;
    let rowLine = 1;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (inQuotes) {
            if (char === '"' && text[i + 1] === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                if (char === "\n") line++;
                field += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === delimiter) {
            row.push(field);
            field = "";
        } else if (char === "\n" || char === "\r") {
            if (char === "\r" && text[i + 1] === "\n") i++;

            row.push(field);
            rows.push({ cells: row, line: rowLine });

            row = [];
            field = "";
            line++;
            rowLine = line;
        } else {
            field += char;
        }
    }

    if (field !== "" || row.length > 0) {
        row.push(field);
        rows.push({ cells: row, line: rowLine });
    }

    return rows.filter(r => r.cells.some(cell => cell.trim() !== ""));
}

// Która kolumna jest którą? { pole: indeks } na podstawie nagłówków i ich nazw zastępczych.
export function findColumns(headerCells, aliasesByField) {
    const header = headerCells.map(normalize);
    const columns = {};

    Object.entries(aliasesByField).forEach(([field, aliases]) => {
        const index = header.findIndex(name => aliases.includes(name));

        if (index !== -1) {
            columns[field] = index;
        }
    });

    return columns;
}

// Wartość pola z wiersza CSV ("" gdy brak kolumny).
export function getCell(cells, columns, field) {
    return columns[field] === undefined ? "" : (cells[columns[field]] || "").trim();
}

// Pliki z polskiego Excela bywają zapisane w Windows-1250 zamiast UTF-8.
export async function readFileText(file) {
    const buffer = await file.arrayBuffer();

    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
        return new TextDecoder("windows-1250").decode(buffer);
    }
}

export const MAX_FILE_SIZE = 2 * 1024 * 1024;

// Pobranie pliku CSV (z BOM, żeby Excel poprawnie pokazał polskie znaki).
export function downloadCsv(fileName, lines) {
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
