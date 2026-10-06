# Tender Document Package Builder

A frontend-only tool for office staff to check tender document requirements, match local PDF files, and download one correctly ordered PDF package.

## Purpose

Load a tender's `requirements.json`, inspect and match the supplied PDFs, resolve missing or expired documents, then create a cover page and a single merged package in the browser. Tender-specific details and the document list are read from the selected file; no sample tender or filenames are built in.

## Install and run

Requirements: Node.js 18 or newer and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite in the latest Google Chrome. The browser's Web Crypto API is used for exact duplicate detection; run on `localhost` or HTTPS.

Create a production build with:

```sh
npm run build
npm run preview
```

Run the focused validation tests with `npm test`.

## GitHub Pages deployment

The GitHub Actions workflow at `.github/workflows/deploy-pages.yml` builds the app and deploys `dist/` on pushes to `main` (or when run manually). In the repository's **Settings → Pages**, set the build and deployment source to **GitHub Actions**. The Vite base path is `/Prema/`, matching the project Pages URL.

## Main features

- Loads and validates tender information and ordered document requirements from a user-selected `requirements.json`.
- Processes up to 30 PDF files and 50 MB total in the browser, showing file sizes, page counts, and SHA-256 exact-duplicate groups.
- Prevents a file or its exact-content duplicate from being assigned to multiple requirements. Matches can be changed or cleared.
- Applies the five document statuses (`Missing`, `Expiry date needed`, `Expired`, `Not provided`, and `OK`) and blocks generation for mandatory omissions and invalid/missing expiry dates. Expiry on the submission deadline is valid.
- Creates an English cover and merges matched documents in requirement order. Every output page has a readable `<tender_id> | Page X of Y` footer in an added footer margin.
- English/Bangla interface, responsive layout, clear privacy messaging, and safe handling of unreadable or protected PDFs.

## Download and screenshot

The browser downloads `<tender_id>_Package.pdf`. To meet the contest folder layout, save the downloaded package into `output/` in the project folder. Browser downloads cannot silently write to a project folder; use Chrome's Save As dialog if you prefer to save it directly into `output/`.

For the required status screenshot, load the requirements and PDFs, make the desired document statuses visible, and capture the application window with Windows Snipping Tool (`Win` + `Shift` + `S`). Save the image in `screenshots/`.

## Frontend-only architecture and privacy

React and Vite provide the UI. `pdfjs-dist` reads PDFs and counts their pages; `pdf-lib` creates the cover, embeds the source pages, and adds final page numbers. Tender JSON, PDF bytes, hashing, matching, and package generation stay in browser memory. The app has no backend, API, database, serverless function, or document storage, and does not upload tender data.

## Bonus features

No bonus features are implemented; effort is focused on the required workflow.

## Known problems

- The package download is browser-managed; the app cannot create or write into the project's `output/` directory directly.
- PDF viewing is not part of the app. Password-protected or damaged files are reported as unreadable and cannot be included.
- PDF cover text uses the standard PDF Helvetica font; tender field values are expected to be representable by that font.
- Automated tests cover requirements validation, status decisions, cover-only generation, and ordered package page counts/sizes. Full file-picker behavior is best verified manually in Chrome.

## AI tools used

GitHub Copilot in VS Code was used to assist with implementation and verification.

## Most useful AI prompt

> Build a frontend-only React/Vite tender document package builder that loads a generic requirements.json, validates and matches local PDFs, detects exact duplicates, applies mandatory/expiry status rules, and generates an ordered merged PDF with an English cover and correct total-page footers. Keep every document operation in the browser and provide a bilingual responsive interface.