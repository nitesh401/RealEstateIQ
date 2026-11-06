# EstateIQ — Property Intelligence (v2)

A static, GitHub-Pages-deployable web app that tests a property's asking price against comparable evidence, maps its surroundings (OpenStreetMap), assesses traditional Vastu orientation, lists legal due-diligence checks, calculates acquisition cost and produces a 19-section PDF report. Initial market: India (Indore, Madhya Pradesh); the cost and legal modules are data-driven so other states/cities can be added.

**Stack:** React 18 · Vite 5 · TypeScript · Tailwind CSS 3 · Leaflet · jsPDF · Framer Motion · Lucide · Vitest · Playwright (e2e).
No backend. Everything is stored in the browser (localStorage).

## Quick start
```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck && npm run lint && npm test
npm run build        # outputs dist/
npm run preview
npm run test:e2e     # needs: npm run build, python3 + playwright (pip install playwright; playwright install chromium) and poppler (pdftotext)
```

## Deploy to GitHub Pages
1. Push the project to the `main` branch.
2. In **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
3. If the first workflow run started before Pages was enabled, re-run it from the **Actions** tab. Later pushes to `main` run `.github/workflows/deploy.yml` automatically; it type-checks, lints, runs the unit tests, builds the app and publishes `dist/`.
4. When the workflow succeeds, the site is available at [https://nitesh401.github.io/RealEstateIQ/](https://nitesh401.github.io/RealEstateIQ/).

The build uses `base: './'` and hash routing (`#/analyze`, `#/report/<id>`), so it works under the repository sub-path with no extra configuration or 404 fallback. This was exercised by the e2e suite, which serves the build under `/estateiq-repo/`.

## What is real, what is not
| Capability | Status |
|---|---|
| Address search / reverse geocoding | OpenStreetMap **Nominatim** (public instance). Search runs on submit (type-ahead is against its policy), throttled to ≤1 req/s, cached. |
| Nearby schools, hospitals, shopping, transport, highways, rail, airports, IT parks, water bodies, proposed/under-construction roads & rail | OpenStreetMap **Overpass** (primary + mirror fallback). Community data, can be incomplete. |
| Comparable listings / transactions | **Not scraped** (portal terms forbid it). You enter comparables manually / by CSV, or point Settings → *Market-data endpoint* at your own licensed feed. |
| Government guideline rates | Entered by you (no public API integrated). Used as a reference floor and stamp-duty base. |
| Stamp duty / registration | Date-labelled, editable assumptions. MP preset (7.5% + 3%, 2026-06) comes from secondary sources and is flagged **indicative/unverified**. No other state is guessed. |
| SAMPADA, land records, MP RERA, municipal portals | **Not integrated.** Checklist gives manual verification hints. |
| Flood / geographic hazard | **Not assessed** (no reliable open dataset integrated). |
| Uploaded photos / plans / documents | Names recorded only; **not analysed, never counted as legal verification.** |
| Vastu | Traditional-belief rule tables; clearly disclaimed; room zones are user-entered. |

## Valuation method (summary)
Same-type comparables only → filter by validity, age, distance → outliers removed only with ≥5 comps → weight = recency (270-day half-life) × distance (1/(1+km)) × evidence (transaction 1.0, asking 0.6) × size similarity → optional road/corner/township adjustments (only when the comp states the attribute; editable, uncalibrated). Fair rate = weighted mean; range = weighted 25th–75th percentile (±15% placeholder under 3 comps). Confidence: **HIGH** ≥5 comps, median age ≤180 d, CV ≤20%, ≥1 transaction · **MEDIUM** ≥3, ≤365 d, CV ≤35% · else **LOW**. Demo data is forced LOW. With no usable comparables **no market value is produced** — only the asking-price arithmetic, a guideline floor (if entered) and a HOLD verdict.

Recommendation rules: AVOID on flagged legal issue / unapproved layout / >25% premium; NEGOTIATE on >8% premium; **BUY is never issued while any critical legal check is unverified**, or with LOW confidence.

## Optional market-data endpoint contract
`GET {endpoint}?lat=22.7&lon=75.8&type=plot&radiusKm=5` →
```json
{ "sourceName": "My feed", "retrievedAt": "2026-11-01T00:00:00Z",
  "comparables": [ { "id": "x1", "label": "…", "propertyType": "plot", "kind": "transaction|asking",
    "ratePerSqft": 4200, "observedOn": "2026-10-10", "sourceName": "…", "areaSqft": 1500,
    "distanceKm": 0.8, "roadWidthFt": 30, "corner": false, "township": true, "verified": true } ] }
```
Must be HTTPS and send CORS headers. **Never put API keys in the frontend** — keep them in a serverless function/worker that exposes this contract.

## Environment variables
None. There are no secrets in the bundle.

## Project layout
```
src/lib        pure engines (valuation, costs, vastu, legal, recommendation, location, analysis) + unit tests
src/services   Nominatim, Overpass, market endpoint, storage, PDF, analysis orchestration
src/components wizard steps, map, charts, UI kit
src/views      Landing, Wizard, Results, Reports, Settings
e2e/           Playwright end-to-end suite (external services mocked)
legacy-v1/     the original vanilla-JS prototype, kept for reference
```

## Known limitations
- Live Nominatim/Overpass were **not reachable from the build sandbox**; their request/parse code is covered by unit tests and mocked e2e tests only. Use *Settings → Test live connections* after deploying.
- Public OSM servers are fair-use; heavy usage needs your own instances.
- Comparable quality is only as good as what you enter; EstateIQ cannot verify listings.
- MP stamp-duty figures are secondary-source and unverified; concessions (e.g. gender) are not modelled.
- No flood-risk data, no appreciation forecast, no floor-plan image analysis, no automated document verification.
- Map PDF section is a radial plot of mapped features, not a tile snapshot (tile bulk-use and CORS limits).
- Bundle ~570 kB main + lazy 377 kB PDF chunk.

## Roadmap
Licensed market-data connector (serverless); guideline-rate datasets per city; more state presets with sourced notifications; official-portal deep links per locality; flood/hazard layers (state SDMA / WRIS) when machine-readable; IndexedDB for attachments; multi-property comparison; Hindi UI.
