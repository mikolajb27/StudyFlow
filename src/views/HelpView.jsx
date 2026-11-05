// POMOC: rozmowa z asystentem AI (korepetytorem) przy zadaniach domowych.
// Odpowiedzi przychodzą na żywo z funkcji Firebase "pomoc" (functions/index.js).

import { httpsCallable } from "firebase/functions";
import "katex/dist/katex.min.css";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { useAppData } from "../AppData.jsx";
import { useNavigation } from "../Navigation.jsx";
import { functions } from "../firebase.js";
import { ACCEPTED_FILES, MAX_ATTACHMENTS, prepareAttachment } from "../lib/attachments.js";
import { assistantText, buildHelpContext, getHelpErrorMessage, SUGGESTIONS, toApiMessages } from "../lib/helpChat.js";
import { sortSubjects } from "../lib/subjects.js";
import { compareTasksByDue } from "../lib/tasks.js";

const CALL_TIMEOUT_MS = 540 * 1000; // jak timeoutSeconds funkcji

export function HelpView() {
    const { tasks, subjects, getSubject } = useAppData();
    const { helpRequest } = useNavigation();

    const [turns, setTurns] = useState([]);
    const [contextKey, setContextKey] = useState(""); // "" | "task:<id>" | "subject:<id>"
    const [conversationContext, setConversationContext] = useState(null); // ustalony przy 1. wiadomości
    const [pendingContextKey, setPendingContextKey] = useState(null); // "Pomoc AI" w trakcie innej rozmowy
    const [draft, setDraft] = useState("");
    const [attachments, setAttachments] = useState([]);
    const [error, setError] = useState("");
    const [dragging, setDragging] = useState(false);

    const textareaRef = useRef(null);
    const fileRef = useRef(null);
    const endRef = useRef(null);
    const abortRef = useRef(null);

    const busy = turns.some(turn => turn.assistant.status === "streaming");
    const openTasks = tasks.filter(task => !task.completed).sort(compareTasksByDue);
    const sortedSubjects = sortSubjects(subjects);

    // Kontekst z wybranej opcji: zadanie (z jego przedmiotem) albo sam przedmiot.
    function resolveContext(key) {
        const [kind, id] = key.split(":");
        const task = kind === "task" ? tasks.find(item => item.id === id) : null;
        const subject = kind === "subject" ? getSubject(id) : getSubject(task?.subjectId);

        return { task, subject };
    }

    function describeContext(key) {
        const { task, subject } = resolveContext(key);

        if (task) return subject ? `${task.title} · ${subject.name}` : task.title;
        if (subject) return subject.name;
        return "";
    }

    function startConversation(key = "") {
        abortRef.current?.abort();
        setTurns([]);
        setConversationContext(null);
        setContextKey(key);
        setPendingContextKey(null);
        setError("");
        textareaRef.current?.focus();
    }

    // "Pomoc AI" z podglądu zadania.
    useEffect(() => {
        if (!helpRequest) {
            return;
        }

        const key = `task:${helpRequest.taskId}`;

        if (turns.length === 0) {
            setContextKey(key);
            textareaRef.current?.focus();
        } else {
            setPendingContextKey(key);
        }
        // Reagujemy tylko na nową prośbę, nie na zmiany rozmowy.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [helpRequest]);

    // Przewijamy do nowej odpowiedzi, jeśli użytkownik jest przy końcu strony.
    useEffect(() => {
        const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 240;

        if (nearBottom) {
            endRef.current?.scrollIntoView({ block: "end" });
        }
    }, [turns]);

    function updateAssistant(turnId, changes) {
        setTurns(list => list.map(turn => (
            turn.id === turnId ? { ...turn, assistant: { ...turn.assistant, ...changes } } : turn
        )));
    }

    function removeTurn(turnId) {
        setTurns(list => list.filter(turn => turn.id !== turnId));
    }

    // ---------- Załączniki ----------

    async function addFiles(fileList) {
        const files = [...fileList];
        const free = MAX_ATTACHMENTS - attachments.length;

        if (files.length > free) {
            setError(`Możesz dołączyć maksymalnie ${MAX_ATTACHMENTS} plików do jednej wiadomości.`);
        } else {
            setError("");
        }

        for (const file of files.slice(0, Math.max(free, 0))) {
            try {
                const attachment = await prepareAttachment(file);
                setAttachments(list => [...list, attachment]);
            } catch (caught) {
                setError(caught.message);
            }
        }
    }

    function handlePaste(event) {
        const images = [...event.clipboardData.files].filter(file => file.type.startsWith("image/"));

        if (images.length > 0) {
            event.preventDefault();
            addFiles(images);
        }
    }

    // ---------- Wysyłanie ----------

    async function send(text = draft) {
        const trimmed = text.trim();

        if (busy || (trimmed === "" && attachments.length === 0)) {
            return;
        }

        // Zdjęcia i PDF-y przed tekstem – tak model najlepiej je czyta.
        const content = [
            ...attachments.map(attachment => attachment.block),
            ...(trimmed ? [{ type: "text", text: trimmed }] : [])
        ];

        const context = conversationContext ?? buildHelpContext({ ...resolveContext(contextKey), subjects });
        const sentAttachments = attachments;

        const turn = {
            id: crypto.randomUUID(),
            user: {
                text: trimmed,
                attachments: sentAttachments.map(({ id, kind, name, previewUrl }) => ({ id, kind, name, previewUrl })),
                content
            },
            assistant: { status: "streaming", content: [], text: "" }
        };

        const history = [...toApiMessages(turns), { role: "user", content }];

        setConversationContext(context);
        setTurns(list => [...list, turn]);
        setDraft("");
        setAttachments([]);
        setError("");

        const controller = new AbortController();
        abortRef.current = controller;
        let streamed = "";

        // Nieudana wiadomość wraca do pola tekstowego razem z załącznikami.
        const restoreDraft = () => {
            removeTurn(turn.id);
            setDraft(trimmed);
            setAttachments(sentAttachments);
        };

        try {
            const call = httpsCallable(functions, "pomoc", { timeout: CALL_TIMEOUT_MS });
            const { stream, data } = await call.stream({ messages: history, context }, { signal: controller.signal });

            // Gdy strumień się urwie, "data" też zgłasza błąd – obsługujemy go w catch poniżej,
            // a tu tylko zapobiegamy komunikatowi o nieobsłużonym błędzie.
            data.catch(() => {});

            for await (const chunk of stream) {
                streamed += chunk?.text ?? "";
                updateAssistant(turn.id, { text: streamed });
            }

            const result = await data;

            if (result?.refusal) {
                updateAssistant(turn.id, { status: "refused", text: "" });
            } else if (result?.content) {
                updateAssistant(turn.id, {
                    status: result.truncated ? "truncated" : "done",
                    content: result.content,
                    text: assistantText(result.content)
                });
            } else {
                throw new Error("empty");
            }
        } catch (caught) {
            if (controller.signal.aborted) {
                // Zatrzymane przez użytkownika: zostaje to, co już przyszło (albo nic).
                if (streamed.trim() === "") {
                    restoreDraft();
                } else {
                    updateAssistant(turn.id, { status: "stopped", content: [{ type: "text", text: streamed }], text: streamed });
                }
            } else {
                restoreDraft();
                setError(getHelpErrorMessage(caught));
            }
        } finally {
            if (abortRef.current === controller) {
                abortRef.current = null;
            }
        }
    }

    function handleKeyDown(event) {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            send();
        }
    }

    // Pole tekstowe rośnie razem z treścią (do limitu z CSS).
    function autoResize(element) {
        element.style.height = "auto";
        element.style.height = `${element.scrollHeight}px`;
    }

    useEffect(() => {
        if (textareaRef.current) {
            autoResize(textareaRef.current);
        }
    }, [draft]);

    // ---------- Widok ----------

    const contextOptionExists = contextKey === "" || describeContext(contextKey) !== "";
    const lockedContextLabel = conversationContext
        ? conversationContext.task?.title
            ? [conversationContext.task.title, conversationContext.subject?.name].filter(Boolean).join(" · ")
            : conversationContext.subject?.name || "Ogólne pytanie"
        : null;

    return (
        <section className="subjects-section help-section">
            <div className="schedule-header">
                <div>
                    <p className="subtitle">KOREPETYTOR AI</p>
                    <h2>Pomoc w zadaniach</h2>
                </div>

                <div className="schedule-actions">
                    <button type="button" className="secondary-button" disabled={turns.length === 0}
                        onClick={() => startConversation()}>
                        Nowa rozmowa
                    </button>
                </div>
            </div>

            {pendingContextKey && (
                <div className="subjects-hint app-banner">
                    <p>Zacząć nową rozmowę o „{describeContext(pendingContextKey)}”? Obecna rozmowa zniknie.</p>
                    <div className="app-banner-actions">
                        <button type="button" onClick={() => startConversation(pendingContextKey)}>Nowa rozmowa</button>
                        <button type="button" className="secondary-button" onClick={() => setPendingContextKey(null)}>
                            Zostań w obecnej
                        </button>
                    </div>
                </div>
            )}

            <div className="help-context">
                {lockedContextLabel ? (
                    <p>
                        <span className="help-context-label">Rozmowa o:</span> <strong>{lockedContextLabel}</strong>
                        <span className="help-context-hint"> · aby zmienić, zacznij nową rozmowę</span>
                    </p>
                ) : (
                    <label className="help-context-picker">
                        <span className="help-context-label">Pomoc do:</span>
                        <select className="form-field" value={contextOptionExists ? contextKey : ""}
                            onChange={event => setContextKey(event.target.value)}>
                            <option value="">Ogólne pytanie</option>

                            {openTasks.length > 0 && (
                                <optgroup label="Zadania do zrobienia">
                                    {openTasks.map(task => (
                                        <option key={task.id} value={`task:${task.id}`}>
                                            {describeContext(`task:${task.id}`)}
                                        </option>
                                    ))}
                                </optgroup>
                            )}

                            {sortedSubjects.length > 0 && (
                                <optgroup label="Przedmioty">
                                    {sortedSubjects.map(subject => (
                                        <option key={subject.id} value={`subject:${subject.id}`}>{subject.name}</option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    </label>
                )}
            </div>

            <div className="help-messages" aria-live="polite">
                {turns.length === 0 && (
                    <div className="help-empty">
                        <p>
                            Opisz zadanie, z którym masz problem, albo dołącz jego zdjęcie lub PDF.
                            Asystent pomoże Ci je zrozumieć krok po kroku – a pełne rozwiązanie pokaże,
                            gdy o nie poprosisz.
                        </p>

                        <div className="help-suggestions">
                            {SUGGESTIONS.map(suggestion => (
                                <button key={suggestion} type="button" className="secondary-button"
                                    onClick={() => {
                                        setDraft(suggestion);
                                        textareaRef.current?.focus();
                                    }}>
                                    {suggestion.trim()}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {turns.map(turn => (
                    <Turn key={turn.id} turn={turn} />
                ))}

                <div ref={endRef} />
            </div>

            {error && <p className="field-error help-error" role="alert">{error}</p>}

            <form
                className={`help-composer${dragging ? " dragging" : ""}`}
                onSubmit={event => {
                    event.preventDefault();
                    send();
                }}
                onDragOver={event => {
                    event.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={event => {
                    event.preventDefault();
                    setDragging(false);
                    addFiles(event.dataTransfer.files);
                }}
            >
                {attachments.length > 0 && (
                    <ul className="help-attachments">
                        {attachments.map(attachment => (
                            <li key={attachment.id}>
                                <AttachmentPreview attachment={attachment} />
                                <button type="button" className="help-attachment-remove"
                                    aria-label={`Usuń załącznik ${attachment.name}`}
                                    onClick={() => setAttachments(list => list.filter(item => item.id !== attachment.id))}>
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="help-composer-row">
                    <button type="button" className="icon-button" aria-label="Dołącz zdjęcie lub PDF"
                        title="Dołącz zdjęcie lub PDF (możesz też wkleić zrzut ekranu Ctrl+V)"
                        disabled={attachments.length >= MAX_ATTACHMENTS}
                        onClick={() => fileRef.current.click()}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="m21.4 11.6-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
                        </svg>
                    </button>

                    <textarea
                        ref={textareaRef}
                        className="form-field help-input"
                        rows={1}
                        placeholder="Napisz pytanie… (Enter – wyślij, Shift+Enter – nowa linia)"
                        aria-label="Pytanie do asystenta"
                        value={draft}
                        onChange={event => setDraft(event.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                    />

                    {busy ? (
                        <button type="button" className="cancel-button help-send" onClick={() => abortRef.current?.abort()}>
                            Zatrzymaj
                        </button>
                    ) : (
                        <button type="submit" className="help-send"
                            disabled={draft.trim() === "" && attachments.length === 0}>
                            Wyślij
                        </button>
                    )}
                </div>

                <input type="file" ref={fileRef} accept={ACCEPTED_FILES} multiple hidden
                    onChange={event => {
                        addFiles(event.target.files);
                        event.target.value = "";
                    }} />
            </form>

            <p className="help-disclaimer">
                Asystent AI może się pomylić – sprawdzaj wyniki i ucz się na nich, zamiast je przepisywać.
            </p>
        </section>
    );
}

function AttachmentPreview({ attachment }) {
    return (
        <span className="help-attachment" title={attachment.name}>
            {attachment.kind === "image"
                ? <img src={attachment.previewUrl} alt="" />
                : <span className="help-attachment-pdf" aria-hidden="true">PDF</span>}
            <span className="help-attachment-name">{attachment.name}</span>
        </span>
    );
}

function Turn({ turn }) {
    const { user, assistant } = turn;

    return (
        <>
            <div className="help-message user">
                {user.attachments.length > 0 && (
                    <div className="help-message-attachments">
                        {user.attachments.map(attachment => <AttachmentPreview key={attachment.id} attachment={attachment} />)}
                    </div>
                )}
                {user.text && <p className="help-user-text">{user.text}</p>}
            </div>

            <div className={`help-message assistant${assistant.status === "refused" ? " refused" : ""}`}>
                {assistant.status === "refused" ? (
                    <p>Asystent nie może pomóc w tej sprawie. Spróbuj zadać pytanie inaczej.</p>
                ) : assistant.text ? (
                    <AssistantMarkdown text={assistant.text} />
                ) : (
                    <p className="help-thinking" aria-label="Asystent pisze odpowiedź">
                        <span /><span /><span />
                    </p>
                )}

                {assistant.status === "stopped" && <p className="help-note">Odpowiedź została przerwana.</p>}
                {assistant.status === "truncated" && (
                    <p className="help-note">Odpowiedź była za długa i została ucięta – poproś o dokończenie.</p>
                )}
            </div>
        </>
    );
}

// Model czasem zapisuje wzory jako \( \) i \[ \] – zamieniamy na $ $ i $$ $$, które rozumie remark-math.
// Wzór blokowy musi mieć $$ w osobnych liniach, inaczej wyświetli się w tekście.
function normalizeMath(text) {
    return text
        .replace(/\\\[([\s\S]+?)\\\]/g, (_, formula) => `\n$$\n${formula.trim()}\n$$\n`)
        .replace(/\\\(([\s\S]+?)\\\)/g, (_, formula) => `$${formula}$`);
}

function AssistantMarkdown({ text }) {
    return (
        <div className="help-markdown">
            <Markdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    // eslint-disable-next-line no-unused-vars
                    a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />
                }}
            >
                {normalizeMath(text)}
            </Markdown>
        </div>
    );
}
