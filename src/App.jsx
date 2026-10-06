import { useMemo, useRef, useState } from "react";
import UploadPanel from "./components/UploadPanel.jsx";
import RequirementsPanel from "./components/RequirementsPanel.jsx";
import { createPackagePdf, inspectPdf } from "./lib/pdf.js";
import { getStatusRows, validateRequirementsDocument } from "./lib/requirements.js";
import { messages } from "./locales.js";

const MAX_FILES = 30;
const MAX_BYTES = 50 * 1024 * 1024;

function formatDate(value, language) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(language === "bn" ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function App() {
  const [language, setLanguage] = useState("en");
  const [tenderPack, setTenderPack] = useState(null);
  const [files, setFiles] = useState([]);
  const [matches, setMatches] = useState({});
  const [expiryDates, setExpiryDates] = useState({});
  const [errors, setErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [success, setSuccess] = useState("");
  const requirementsInput = useRef(null);
  const t = messages[language];

  const rows = useMemo(() => {
    if (!tenderPack) return [];
    return getStatusRows(
      tenderPack.requirements,
      files,
      matches,
      expiryDates,
      tenderPack.tender.submission_deadline,
    );
  }, [tenderPack, files, matches, expiryDates]);
  const blockingRows = rows.filter((row) => row.blocksPackage);
  const duplicateCounts = useMemo(() => {
    const counts = new Map();
    for (const file of files) counts.set(file.hash, (counts.get(file.hash) || 0) + 1);
    return counts;
  }, [files]);
  const displayFiles = useMemo(
    () => files.map((file) => ({ ...file, duplicateCount: duplicateCounts.get(file.hash) || 1 })),
    [files, duplicateCounts],
  );

  async function loadRequirements(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setErrors([]);
    setSuccess("");
    try {
      const data = JSON.parse(await file.text());
      const validatedPack = validateRequirementsDocument(data);
      setTenderPack(validatedPack);
      setMatches({});
      setExpiryDates({});
    } catch (error) {
      setErrors([`${t.errors.invalidRequirements}${error.message}`]);
    }
  }

  async function handleFilesSelected(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length) return;

    setErrors([]);
    setSuccess("");
    setIsProcessing(true);
    const nextFiles = [...files];
    const nextErrors = [];
    let totalBytes = nextFiles.reduce((sum, file) => sum + file.size, 0);

    for (const file of selected) {
      const isPdf = /\.pdf$/i.test(file.name);
      if (!isPdf) {
        nextErrors.push(t.errors.notPdf(file.name));
        continue;
      }
      if (nextFiles.length >= MAX_FILES) {
        nextErrors.push(t.errors.fileLimit);
        break;
      }
      if (totalBytes + file.size > MAX_BYTES) {
        nextErrors.push(t.errors.sizeLimit);
        continue;
      }

      try {
        if (!globalThis.crypto?.subtle) throw new Error("HASH_UNAVAILABLE");
        const inspected = await inspectPdf(file);
        nextFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          size: file.size,
          hash: inspected.hash,
          pageCount: inspected.pageCount,
          bytes: inspected.bytes,
        });
        totalBytes += file.size;
      } catch (error) {
        nextErrors.push(error.message === "HASH_UNAVAILABLE"
          ? t.errors.hashUnavailable
          : t.errors.unreadablePdf(file.name));
      }
    }

    setFiles(nextFiles);
    setErrors(nextErrors);
    setIsProcessing(false);
  }

  function removeFile(fileId) {
    setFiles((current) => current.filter((file) => file.id !== fileId));
    setMatches((current) => Object.fromEntries(
      Object.entries(current).filter(([, matchedId]) => matchedId !== fileId),
    ));
  }

  function updateMatch(requirementId, fileId) {
    setMatches((current) => {
      const next = { ...current };
      if (fileId) next[requirementId] = fileId;
      else delete next[requirementId];
      return next;
    });
  }

  async function generatePackage() {
    if (!tenderPack || blockingRows.length || isGenerating) return;
    setErrors([]);
    setSuccess("");
    setIsGenerating(true);

    try {
      const includedDocuments = rows
        .filter((row) => row.matchedFile)
        .map((row) => ({ requirement: row.requirement, file: row.matchedFile }));
      const filesById = new Map(files.map((file) => [file.id, file]));
      const pdfBytes = await createPackagePdf({
        tender: tenderPack.tender,
        includedDocuments,
        filesById,
        madeOn: new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date()),
      });
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${tenderPack.tender.tender_id}_Package.pdf`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSuccess(t.downloadReady);
    } catch (error) {
      setErrors([`${t.errors.generation}${error.message}`]);
    } finally {
      setIsGenerating(false);
    }
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="#" className="brand-lockup" aria-label={t.brand}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>
            <strong>{t.brand}</strong>
            <small>{t.tagline}</small>
          </span>
        </a>
        <button
          className="language-button"
          type="button"
          onClick={() => setLanguage((current) => current === "en" ? "bn" : "en")}
          aria-label={t.switchLanguage}
        >
          <span aria-hidden="true">文</span>{t.switchLanguage}
        </button>
      </header>

      <main className="workspace">
        <div className="page-intro">
          <div>
            <p className="eyebrow">{t.privacy}</p>
            <h1>{t.brand}</h1>
            <p>{t.privacyText}</p>
          </div>
          <div className="privacy-stamp">
            <span aria-hidden="true">✓</span>
            <span><strong>{t.privacy}</strong><small>{t.privacyText}</small></span>
          </div>
        </div>

        <section className={`panel tender-panel ${tenderPack ? "is-loaded" : ""}`} aria-labelledby="tender-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t.step} 1</p>
              <h2 id="tender-heading">{t.tenderTitle}</h2>
            </div>
            <input
              ref={requirementsInput}
              className="visually-hidden"
              type="file"
              accept=".json,application/json"
              onChange={loadRequirements}
              aria-label={t.loadRequirements}
            />
            <button className="secondary-button" type="button" onClick={() => requirementsInput.current?.click()}>
              <span aria-hidden="true">＋</span>
              {tenderPack ? t.changeFile : t.loadRequirements}
            </button>
          </div>

          {tenderPack ? (
            <div className="tender-details">
              <div className="tender-id-card">
                <span>{t.tenderId}</span>
                <strong>{tenderPack.tender.tender_id}</strong>
              </div>
              <div className="tender-title-card">
                <span>{t.tenderTitle}</span>
                <strong>{tenderPack.tender.title}</strong>
              </div>
              <div className="detail-cell">
                <span>{t.procuringEntity}</span>
                <strong>{tenderPack.tender.procuring_entity}</strong>
              </div>
              <div className="detail-cell">
                <span>{t.bidder}</span>
                <strong>{tenderPack.tender.bidder}</strong>
              </div>
              <div className="detail-cell">
                <span>{t.deadline}</span>
                <strong>{formatDate(tenderPack.tender.submission_deadline, language)}</strong>
              </div>
              <p className="loaded-note"><span aria-hidden="true">✓</span>{t.requirementsReady(tenderPack.requirements.length)}</p>
            </div>
          ) : (
            <button className="load-prompt" type="button" onClick={() => requirementsInput.current?.click()}>
              <span className="prompt-icon" aria-hidden="true">↥</span>
              <span><strong>{t.loadRequirements}</strong><small>{t.noRequirements}</small></span>
              <span className="prompt-arrow" aria-hidden="true">→</span>
            </button>
          )}
        </section>

        <div className="main-grid">
          <UploadPanel
            t={t}
            files={displayFiles}
            onFilesSelected={handleFilesSelected}
            onRemove={removeFile}
            errors={errors}
            isProcessing={isProcessing}
            totalBytes={totalBytes}
            disabled={isProcessing}
          />
          <RequirementsPanel
            t={t}
            language={language}
            rows={rows}
            files={displayFiles}
            matches={matches}
            expiryDates={expiryDates}
            onMatch={updateMatch}
            onExpiryChange={(id, date) => setExpiryDates((current) => ({ ...current, [id]: date }))}
            disabled={isProcessing || isGenerating}
          />
        </div>

        <section className="generate-panel">
          <div className="generate-copy">
            <span className={`generate-icon ${blockingRows.length ? "has-blockers" : ""}`} aria-hidden="true">
              {blockingRows.length ? "!" : "↓"}
            </span>
            <div>
              <h2>{t.generateTitle}</h2>
              {blockingRows.length > 0 ? (
                <>
                  <p>{t.blockingItems(blockingRows.length)} · {t.blockersTitle}</p>
                  <ul className="blocker-list">
                    {blockingRows.map(({ requirement, status }) => (
                      <li key={requirement.id}>
                        {language === "bn" ? requirement.title_bn : requirement.title_en}
                        <span> — {t.statuses[status]}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>{tenderPack ? t.readyToGenerate : t.loadToStart}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={!tenderPack || blockingRows.length > 0 || isGenerating || isProcessing}
            onClick={generatePackage}
          >
            {isGenerating ? t.generating : t.generate}
            {!isGenerating && <span aria-hidden="true">→</span>}
          </button>
        </section>

        {success && (
          <div className="success-banner" role="status">
            <span aria-hidden="true">✓</span><span><strong>{t.successTitle}</strong> {success}</span>
            <button type="button" className="icon-button" onClick={() => setSuccess("")} aria-label={t.dismiss}>×</button>
          </div>
        )}

        <footer className="app-footer">
          <span>{t.brand}</span>
          <span>{t.privacyText}</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
