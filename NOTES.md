# STOCKPROOF: Architecture & Product Decisions

## Product Assumptions & Mathematical Foundations

### 1. Grain Bulk Density Matrix (tonnes/m³)
Based on standard agronomical and silo engineering tables:
- **Wheat**: 0.770 t/m³ (standard test weight ~77 kg/hL)
- **Rice (Paddy/Milled)**: 0.750 t/m³
- **Maize / Corn**: 0.720 t/m³
- **Soybean**: 0.770 t/m³
- **Pulses / Gram**: 0.800 t/m³
- **Barley**: 0.620 t/m³

### 2. Physical Pile Geometry
Bulk grain stored flat in covered warehouses or shed floors forms natural conical or truncated conical (frustum) piles dictated by the angle of repose (~28°–34° for dry grains):
- Cone volume: $V = \frac{1}{3} \cdot \pi \cdot r^2 \cdot h$
- Frustum volume: $V = \frac{1}{3} \cdot \pi \cdot h \cdot (r_1^2 + r_1 r_2 + r_2^2)$
- The app supports mobile-based visual markers: users can adjust or confirm height $h$ (meters) and base diameter $d = 2r$ (meters), or use the calibrated auto-heuristic from the photo reference markers.

### 3. Contextual Corrections (Volume != Weight) — season-aware, no fixed factor
- **Season calibration curve (Kharif / Rabi / Zaid)**: the same photo fill reads differently by season. Each curve sets its own settling rate, compaction bias, ambient moisture bias, and typical humidity band:
  - Kharif (monsoon storage): fast settle ~1.4%/30d (cap +5.0%), bias +0.008, typical 13.0–15.5%.
  - Rabi (dry winter, reference): ~1.1%/30d (cap +4.0%), bias 0, typical 11.0–13.0%.
  - Zaid (hot dry): slow settle ~0.8%/30d (cap +3.2%), bias −0.012, typical 9.5–12.0%.
  - Same 110 m³ wheat pile ≈ 86.8 T (Kharif) vs 84.3 T (Zaid). Readings outside the season band widen the range (+0.5%) and lower confidence (−2%).
- **Humidity Modifier**: Baseline safe storage is 12.0% moisture content. For each 1% deviation:
  - $+0.8\%$ effective density per +1% moisture up to 17% (hygroscopic mass addition).
  - Above 18%, moisture increases spoilage risk and grain swell, capping density gain.
- **Compaction Multiplier**:
  - Low compaction: $\times 0.94$ (recently unloaded, fluffy surface aeration)
  - Medium compaction: $\times 1.00$ (settled normal gravity distribution)
  - High compaction: $\times 1.06$ (deep piles, mechanical tamping, or vibration)
- **Storage Duration Factor (season-aware)**:
  - Piles compact naturally under sustained hydrostatic grain pressure over time, at the season curve's rate (see above).

### 4. Range and Confidence Calculation
- **No False Precision Rule**: The output is strictly formatted as a defensible range $[W_{\text{min}}, W_{\text{max}}]$ and a percentage confidence score.
- Range spread is $\pm 3.2\%$ to $\pm 6.5\%$ depending on input precision (measured vs estimated height/diameter, whether humidity meter test was performed).
- Confidence percentage starts at 96% and decreases if:
  - Height was visually estimated without laser/AR reference (-8%)
  - Humidity is unverified or extreme (-6%)
  - Pile footprint is asymmetric (-5%)

### 5. Risk Classification & Neutral Audit Language
- **Consistent** (Green): Declared warehouse receipt tonnage falls comfortably inside $[W_{\text{min}}, W_{\text{max}}]$.
- **Review Required** (Amber): Declared tonnage falls outside the range by $\le 5\%$ or touches boundary limits. Procedural notification generated.
- **High Priority** (Red): Declared tonnage exceeds $W_{\text{max}}$ by $> 5\%$ (classic over-declaration / phantom stock collateral risk). Escalation recommended before next loan disbursement.

### 6. Persistence & Offline Reliability
- Node/Express backend with persistent disk-backed JSON store in `/data/storage.json`.
- Automatic offline detection and manual simulated patchy-network toggle for field auditors.
