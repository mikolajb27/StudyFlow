// Załączniki do pytań w zakładce Pomoc: zdjęcia zadań i pliki PDF.
// Zdjęcia zmniejszamy w przeglądarce (szybsze wysyłanie, mniejszy koszt) i zapisujemy jako JPEG.

export const MAX_ATTACHMENTS = 5;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // przed zmniejszeniem
const MAX_IMAGE_SIDE = 1568; // dłuższy bok – większe zdjęcia i tak są zmniejszane przez model

export const ACCEPTED_FILES = "image/jpeg,image/png,image/webp,image/gif,application/pdf";

function readAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

// "data:image/jpeg;base64,AAAA" -> "AAAA"
const base64Of = dataUrl => dataUrl.slice(dataUrl.indexOf(",") + 1);

async function prepareImage(file) {
    if (file.size > MAX_IMAGE_BYTES) {
        throw new Error(`Zdjęcie „${file.name}” jest za duże (maks. 20 MB).`);
    }

    let bitmap;

    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new Error(`Nie udało się odczytać zdjęcia „${file.name}”.`);
    }

    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff"; // przezroczyste tło PNG -> białe (JPEG nie ma przezroczystości)
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

    return {
        kind: "image",
        name: file.name || "zdjęcie.jpg",
        previewUrl: dataUrl,
        block: { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Of(dataUrl) } }
    };
}

async function preparePdf(file) {
    if (file.size > MAX_PDF_BYTES) {
        throw new Error(`Plik „${file.name}” jest za duży (maks. 10 MB).`);
    }

    const dataUrl = await readAsDataUrl(file);

    return {
        kind: "pdf",
        name: file.name || "dokument.pdf",
        previewUrl: null,
        block: { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Of(dataUrl) } }
    };
}

// Plik z <input type="file">, schowka albo przeciągnięcia -> załącznik { id, kind, name, previewUrl, block }.
export async function prepareAttachment(file) {
    let attachment;

    if (file.type === "application/pdf") {
        attachment = await preparePdf(file);
    } else if (file.type.startsWith("image/")) {
        attachment = await prepareImage(file);
    } else {
        throw new Error(`„${file.name}” – obsługiwane są tylko zdjęcia i pliki PDF.`);
    }

    return { id: crypto.randomUUID(), ...attachment };
}
