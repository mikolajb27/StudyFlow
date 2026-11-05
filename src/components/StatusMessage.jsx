const MAX_DETAILS = 5;

// Komunikat w ramce (success / warning / error) z opcjonalną listą szczegółów.
// status: { kind, message, details? } albo null (nic nie pokazujemy).
export function StatusMessage({ status }) {
    if (!status) {
        return null;
    }

    const details = status.details || [];

    return (
        <div className={`import-status ${status.kind}`} role="status">
            <p>{status.message}</p>

            {details.length > 0 && (
                <ul>
                    {details.slice(0, MAX_DETAILS).map(detail => (
                        <li key={detail}>{detail}</li>
                    ))}

                    {details.length > MAX_DETAILS && <li>…i {details.length - MAX_DETAILS} innych.</li>}
                </ul>
            )}
        </div>
    );
}
