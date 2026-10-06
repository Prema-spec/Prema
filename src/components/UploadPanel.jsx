export default function UploadPanel({
  t,
  files,
  onFilesSelected,
  onRemove,
  errors,
  isProcessing,
  totalBytes,
  disabled,
}) {
  return (
    <section className="panel upload-panel" aria-labelledby="upload-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t.step} 2</p>
          <h2 id="upload-heading">{t.uploadTitle}</h2>
        </div>
        <span className="count-pill">{files.length} / 30</span>
      </div>

      <label className={`dropzone ${isProcessing ? "is-disabled" : ""}`}>
        <input
          type="file"
          accept=".pdf,application/pdf"
          multiple
          disabled={isProcessing}
          onChange={onFilesSelected}
          aria-label={t.choosePdfs}
        />
        <span className="upload-icon" aria-hidden="true">↑</span>
        <strong>{isProcessing ? t.readingPdfs : t.choosePdfs}</strong>
        <span>{t.uploadHint}</span>
        <span className="size-hint">{t.fileLimits} · {formatBytes(totalBytes)} / 50 MB</span>
      </label>

      {errors.length > 0 && (
        <div className="error-list" role="alert">
          {errors.map((error, index) => <p key={`${error}-${index}`}>{error}</p>)}
        </div>
      )}

      {files.length > 0 ? (
        <ul className="file-list">
          {files.map((file) => (
            <li className="file-row" key={file.id}>
              <span className="file-icon" aria-hidden="true">PDF</span>
              <span className="file-details">
                <strong title={file.name}>{file.name}</strong>
                <span>{file.pageCount} {file.pageCount === 1 ? t.page : t.pages} · {formatBytes(file.size)}</span>
              </span>
              {file.duplicateCount > 1 && (
                <span className="duplicate-tag" title={t.duplicateHint}>
                  {t.duplicate} · {file.duplicateCount}
                </span>
              )}
              <button
                className="icon-button"
                type="button"
                onClick={() => onRemove(file.id)}
                disabled={disabled}
                aria-label={`${t.remove} ${file.name}`}
                title={t.remove}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-note">{t.noPdfs}</p>
      )}
    </section>
  );
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
