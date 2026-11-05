// POMOC: asystent AI do zadań domowych (Claude), wywoływany z zakładki "Pomoc".
// Klucz API Anthropic jest tylko tutaj (Secret Manager), nigdy w przeglądarce.

import Anthropic from "@anthropic-ai/sdk";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineInt, defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { SYSTEM_PROMPT, buildContextText } from "./prompt.js";

initializeApp();

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

// Ile wiadomości dziennie może wysłać jeden użytkownik (ochrona przed nabiciem rachunku).
// Zmiana: plik functions/.env -> POMOC_DAILY_LIMIT=60, potem ponowny deploy.
const DAILY_LIMIT = defineInt("POMOC_DAILY_LIMIT", { default: 40 });

const MODEL = "claude-opus-5-5";

const MAX_MESSAGES = 60;
const MAX_TEXT_CHARS = 20000;
const MAX_ATTACHMENTS_PER_MESSAGE = 5;
const MAX_BASE64_CHARS = 14 * 1024 * 1024; // ~10 MB pliku po zakodowaniu
const MAX_TOTAL_BASE64_CHARS = 24 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// ---------- Walidacja danych z przeglądarki ----------

function invalid(message) {
    return new HttpsError("invalid-argument", message);
}

// Treść wiadomości ucznia: tekst, zdjęcia, PDF-y. Zwraca liczbę znaków base64 (do limitu łącznego).
function validateUserContent(content) {
    if (!Array.isArray(content) || content.length === 0) {
        throw invalid("Pusta wiadomość.");
    }

    let base64Chars = 0;
    let attachments = 0;

    for (const block of content) {
        if (block?.type === "text") {
            if (typeof block.text !== "string" || block.text.length > MAX_TEXT_CHARS) {
                throw invalid("Wiadomość jest za długa.");
            }
            continue;
        }

        const source = block?.source;
        const isImage = block?.type === "image" && IMAGE_TYPES.includes(source?.media_type);
        const isPdf = block?.type === "document" && source?.media_type === "application/pdf";

        if (!(isImage || isPdf) || source.type !== "base64" || typeof source.data !== "string") {
            throw invalid("Nieobsługiwany załącznik. Dozwolone: zdjęcia (JPG, PNG, WebP, GIF) i PDF.");
        }

        if (source.data.length > MAX_BASE64_CHARS) {
            throw invalid("Załącznik jest za duży (maks. 10 MB).");
        }

        attachments++;
        base64Chars += source.data.length;
    }

    if (attachments > MAX_ATTACHMENTS_PER_MESSAGE) {
        throw invalid(`Maksymalnie ${MAX_ATTACHMENTS_PER_MESSAGE} załączników w jednej wiadomości.`);
    }

    return base64Chars;
}

// Odpowiedzi asystenta wracają dokładnie w takiej postaci, w jakiej je zwróciliśmy.
function validateAssistantContent(content) {
    const allowed = ["text", "thinking", "redacted_thinking"];

    if (!Array.isArray(content) || content.some(block => !allowed.includes(block?.type))) {
        throw invalid("Nieprawidłowa historia rozmowy.");
    }
}

function validateMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
        throw invalid("Rozmowa jest za długa – zacznij nową.");
    }

    let totalBase64 = 0;

    messages.forEach((message, index) => {
        const expectedRole = index % 2 === 0 ? "user" : "assistant";

        if (message?.role !== expectedRole) {
            throw invalid("Nieprawidłowa historia rozmowy.");
        }

        if (expectedRole === "user") {
            totalBase64 += validateUserContent(message.content);
        } else {
            validateAssistantContent(message.content);
        }
    });

    if (messages[messages.length - 1].role !== "user") {
        throw invalid("Ostatnia wiadomość musi być od ucznia.");
    }

    if (totalBase64 > MAX_TOTAL_BASE64_CHARS) {
        throw invalid("Za dużo załączników w tej rozmowie – zacznij nową.");
    }
}

// ---------- Dzienny limit ----------

function limitReached(limit) {
    return new HttpsError("resource-exhausted", `Wykorzystano dzienny limit wiadomości (${limit}). Spróbuj jutro.`);
}

// Tylko lokalny emulator Functions uruchomiony bez emulatora Firestore (np. bez Javy):
// licznik w pamięci. Po wdrożeniu FUNCTIONS_EMULATOR nie istnieje, więc zawsze działa Firestore.
const memoryQuota = new Map();
const useMemoryQuota = process.env.FUNCTIONS_EMULATOR === "true" && !process.env.FIRESTORE_EMULATOR_HOST;

// Licznik w kolekcji pomocUsage – reguły Firestore nie dają do niej dostępu z przeglądarki,
// więc użytkownik nie może go wyzerować.
async function takeDailyQuota(uid) {
    const today = new Date().toISOString().slice(0, 10);
    const limit = DAILY_LIMIT.value();

    if (useMemoryQuota) {
        const entry = memoryQuota.get(uid);
        const count = entry?.date === today ? entry.count : 0;

        if (count >= limit) {
            throw limitReached(limit);
        }

        memoryQuota.set(uid, { date: today, count: count + 1 });
        return;
    }

    const db = getFirestore();
    const ref = db.collection("pomocUsage").doc(uid);

    await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        const data = snapshot.data();
        const count = data?.date === today ? data.count : 0;

        if (count >= limit) {
            throw limitReached(limit);
        }

        transaction.set(ref, { date: today, count: count + 1, updatedAt: FieldValue.serverTimestamp() });
    });
}

// ---------- Odpowiedź do historii ----------

// Po przełączeniu na model zapasowy (fallback) w trakcie odpowiedzi bloki "thinking" sprzed
// ostatniego bloku "fallback" nie mogą wrócić do API. Blok "fallback" to tylko znacznik – pomijamy go.
function toHistoryContent(content) {
    const lastFallback = content.findLastIndex(block => block.type === "fallback");

    return content.filter((block, index) => {
        if (block.type === "fallback") {
            return false;
        }

        if (index < lastFallback && (block.type === "thinking" || block.type === "redacted_thinking")) {
            return false;
        }

        return ["text", "thinking", "redacted_thinking"].includes(block.type);
    });
}

// Kontekst (przedmiot, zadanie) dokładamy na początku pierwszej wiadomości – zawsze tak samo,
// więc wcześniejsze wiadomości są identyczne w każdym zapytaniu (cache, ciągłość rozumowania).
function withContext(messages, context) {
    const contextText = buildContextText(context);

    if (!contextText) {
        return messages;
    }

    const [first, ...rest] = messages;
    return [{ ...first, content: [{ type: "text", text: contextText }, ...first.content] }, ...rest];
}

// ---------- Funkcja ----------

export const pomoc = onCall(
    {
        region: "europe-central2",
        secrets: [ANTHROPIC_API_KEY],
        timeoutSeconds: 540,
        memory: "512MiB",
        maxInstances: 10
    },
    async (request, response) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Zaloguj się, żeby korzystać z pomocy.");
        }

        const { messages, context } = request.data ?? {};
        validateMessages(messages);
        await takeDailyQuota(request.auth.uid);

        const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

        try {
            const stream = client.beta.messages.stream(
                {
                    model: MODEL,
                    max_tokens: 32000,
                    // Przy odmowie (klasyfikatory bezpieczeństwa) API samo ponawia na zalecanym modelu.
                    betas: ["server-side-fallback-2026-07-01"],
                    fallbacks: "default",
                    thinking: { type: "adaptive" },
                    // Zadania (zwłaszcza ścisłe) wymagają dokładności – "high" zamiast domyślnego "medium".
                    output_config: { effort: "high" },
                    cache_control: { type: "ephemeral" },
                    system: SYSTEM_PROMPT,
                    messages: withContext(messages, context)
                },
                // Uczeń kliknął "Zatrzymaj" albo zamknął kartę – przerywamy i nie płacimy za resztę.
                { signal: response?.signal }
            );

            stream.on("text", text => {
                response?.sendChunk({ text }).catch(() => {});
            });

            const message = await stream.finalMessage();

            logger.info("pomoc", {
                uid: request.auth.uid,
                model: message.model,
                stopReason: message.stop_reason,
                usage: message.usage
            });

            if (message.stop_reason === "refusal") {
                return { refusal: true };
            }

            return {
                content: toHistoryContent(message.content),
                truncated: message.stop_reason === "max_tokens"
            };
        } catch (error) {
            if (response?.signal?.aborted) {
                return { aborted: true };
            }

            logger.error("pomoc: błąd API", error);

            if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
                throw new HttpsError("failed-precondition", "Asystent nie jest poprawnie skonfigurowany (klucz API).");
            }

            if (error instanceof Anthropic.RateLimitError) {
                throw new HttpsError("resource-exhausted", "Asystent jest teraz przeciążony. Spróbuj za chwilę.");
            }

            if (error instanceof Anthropic.BadRequestError) {
                throw new HttpsError("invalid-argument", "Nie udało się przetworzyć wiadomości (np. uszkodzony plik).");
            }

            if (error instanceof Anthropic.APIConnectionError || error instanceof Anthropic.InternalServerError) {
                throw new HttpsError("unavailable", "Asystent jest chwilowo niedostępny. Spróbuj ponownie.");
            }

            throw new HttpsError("internal", "Coś poszło nie tak. Spróbuj ponownie.");
        }
    }
);
