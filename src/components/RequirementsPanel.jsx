const statusClass = {
  missing: "status-missing",
  expiryNeeded: "status-needed",
  expired: "status-expired",
  notProvided: "status-optional",
  ok: "status-ok",
};

export default function RequirementsPanel({
  t,
  language,
  rows,
  files,
  matches,
  expiryDates,
  onMatch,
  onExpiryChange,
  disabled,
}) {
  const assignedFileIds = new Set(Object.values(matches).filter(Boolean));

  return (
    <section className="panel requirements-panel" aria-labelledby="requirements-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t.step} 3</p>
          <h2 id="requirements-heading">{t.requirementsTitle}</h2>
        </div>
        <span className="count-pill">{rows.length} {t.documents}</span>
      </div>
      <p className="section-intro">{t.matchInstructions}</p>

      {rows.length ? (
        <div className="requirement-list">
          {rows.map(({ requirement, matchedFile, status }) => {
            const options = files.filter((file) => {
              if (file.id === matches[requirement.id]) return true;
              if (assignedFileIds.has(file.id)) return false;
              return !files.some((other) =>
                other.id !== file.id &&
                other.hash === file.hash &&
                assignedFileIds.has(other.id),
              );
            });
            const title = language === "bn" ? requirement.title_bn : requirement.title_en;

            return (
              <article className="requirement-row" key={requirement.id}>
                <div className="requirement-main">
                  <div className="requirement-title">
                    <span className="order-number">{requirement.order}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>
                        {requirement.mandatory ? t.mandatory : t.optional}
                        {requirement.has_expiry && <span className="dot-separator">·</span>}
                        {requirement.has_expiry && t.expiryApplies}
                      </p>
                    </div>
                  </div>
                  <span className={`status-badge ${statusClass[status]}`} role="status">
                    <span className="status-dot" aria-hidden="true" />
                    {t.statuses[status]}
                  </span>
                </div>

                <label className="field-label">
                  {t.matchedPdf}
                  <select
                    value={matches[requirement.id] || ""}
                    onChange={(event) => onMatch(requirement.id, event.target.value)}
                    disabled={disabled}
                    aria-label={`${t.matchedPdf}: ${title}`}
                  >
                    <option value="">{t.selectPdf}</option>
                    {options.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.name}{file.duplicateCount > 1 ? ` · ${t.duplicate}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                {requirement.has_expiry && matchedFile && (
                  <label className="field-label expiry-field">
                    {t.expiryDate}
                    <input
                      type="date"
                      value={expiryDates[requirement.id] || ""}
                      onChange={(event) => onExpiryChange(requirement.id, event.target.value)}
                      disabled={disabled}
                      aria-label={`${t.expiryDate}: ${title}`}
                    />
                    <span className="field-hint">{t.expiryHint}</span>
                  </label>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="requirements-empty">
          <span className="empty-symbol" aria-hidden="true">≡</span>
          <strong>{t.requirementsEmptyTitle}</strong>
          <p>{t.requirementsEmpty}</p>
        </div>
      )}
    </section>
  );
}
