# EstateIQ — Property Intelligence (GitHub Pages MVP)

A static, India-first real-estate decision-support app. No build step or server required.

## Run locally
Open `index.html` in a browser, or serve this folder with any static server. Internet access is needed for the map, geocoding and nearby-amenity lookups.

## Deploy to GitHub Pages
1. Create a GitHub repository (for example `estateiq`).
2. Upload `index.html`, `styles.css`, `app.js`, and this README to the repository root.
3. Open **Settings → Pages**.
4. Under Build and deployment, choose **Deploy from a branch**, select `main` and `/ (root)`, then Save.
5. Wait for the Pages deployment and open the published URL.

## What works
- Property type, location, area, asking rate, facing, dimensions, road width, plot position and approval inputs.
- Exact base-price calculation (`area × asking rate`), explicitly excluding registry.
- User-entered nearby asking-rate comparables with distance-weighted benchmark, range and price premium/discount.
- OpenStreetMap Nominatim location search, Leaflet map, and Overpass nearby mapped amenities.
- Rule-based Vastu orientation notes and due-diligence checklist.
- Responsive UI, animated 3D-style hero and local-only form state.

## Accuracy and data limitations
This MVP deliberately does **not** scrape property portals or claim access to registered sale-deed data. The comparable-rate panel accepts evidence the user has collected; those quotes remain unverified asking prices. A production-grade valuation needs licensed listing/transaction feeds, local government guideline values (e.g. the relevant state's current guideline/collector rate), data normalization, deduplication, property-type matching and a secure backend/serverless proxy for paid APIs. Do not expose private API keys in GitHub Pages JavaScript.

OpenStreetMap coverage is community-maintained and may be incomplete. Nominatim and Overpass have fair-use limits; do not use these public endpoints for high-volume production workloads. Vastu notes are traditional interpretive guidance, not scientific claims or a substitute for an architect's review. Legal checks require a qualified local lawyer and official records.

## Recommended next production upgrades
1. Secure API layer (Cloudflare Workers / Netlify Functions / Vercel Functions) for protected providers and rate limiting.
2. Licensed listing integrations and a provenance ledger for each comparable (source URL, date, distance, status, asking vs registered price).
3. MP guideline-rate integration and city-specific transaction datasets, after confirming lawful access.
4. Parcel geometry, road frontage, north alignment, plot-shape and slope inputs for deeper Vastu/site analysis.
5. Save/share PDF report, user accounts, property history and audit trail.
