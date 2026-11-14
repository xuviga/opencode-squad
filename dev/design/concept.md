# SQUAD — Poster Concept

**Task:** `d_concept` · **Mission:** `m_2e72a622` · **Role:** designer, G2
**Deliverable:** one poster concept, three directions explored, one chosen and specified.
**Canvas:** 1200 × 1600 px portrait (3:4), single artboard, vector-only.
**Subject:** SQUAD — multi-agent orchestrator for OpenCode, routing work across DeepSeek models.
**Audience:** developer conference floor, read at 1–3 m.
**Tone:** precise, editorial, high contrast.

---

## 1. Design premises

1. **The product is a chain of command, not a chatbot.** The poster must show ordered
   hand-offs: mission → plan → hire → assign → review → integrate → finalize.
2. **Precision is the aesthetic.** Real product language (`plan gate`, `blind reviewer`,
   `worktree`, `cherry-pick`, `fail-closed`), monospaced facts, ruled tables, no metaphor
   that the software does not actually perform.
3. **Contrast is structural, not decorative.** One paper field, one ink field, one signal
   colour. The signal colour marks decisions only.
4. **Everything is drawn.** Type, rules, blocks and diagram are native vector objects.
   No photos, no renders, no textures, no external images.

---

## 2. Three directions

### Direction A — “Routing Ledger”

The poster as an operations sheet: a masthead, a ruled ledger of the four accountability
stages, and an inverted black panel carrying the full seven-step routing chain. Editorial
light paper, one red proof-mark. The table is the hero because a ledger is exactly what an
orchestrator is: named roles, fixed outputs, signed gates.

- **Palette:** paper `#F2F0E9`, ink `#0B0B0C`, graphite `#5C5952`, signal red `#E0361A`,
  rule tint `#CFCABF`.
- **Type:** Inter Display Black masthead; Inter Display SemiBold declarations; Inter Regular
  body; Ubuntu Mono for all machine facts.
- **Composition:** top-heavy, left-aligned, 8-column grid, 70/30 white-to-black split.
- **Risk:** can read as a spec sheet if the masthead scale is timid. Mitigation: 240 px
  display and a hard 3.3× jump to the statement.
- **Why it fits:** it makes the orchestration legible instead of mystical, and it is the
  most honest translation of the product into a printed object.

### Direction B — “Dark Instrument”

Full-bleed near-black field. Seven agent nodes sit on thin orbital arcs, connected by
2 px callout lines with grade labels; the word SQUAD is set enormous at the bottom and
cropped by the trim, so the poster reads as a machine fascia rather than a page. DeepSeek
blue is the only chroma. Type contrast is weight-based (Thin vs Black), not size-based.

- **Palette:** night `#07080C`, off-white `#EFEDE6`, DeepSeek blue `#4D6BFE`, steel
  `#8E96A8`, faint rail `#23252C`.
- **Type:** Inter Display Thin 160 px + Inter Black 96 px; Ubuntu Mono 11 px data labels.
- **Composition:** centred radial diagram in the upper 60%, cropped wordmark below,
  12-column grid used only for label anchoring.
- **Risk:** dark posters lose detail under conference lighting; radial diagrams can look
  like generic “AI network” art; the cropped wordmark hurts name recall at distance.
- **Why it fits:** strongest night-stage presence and the clearest “system” mood.

### Direction C — “Red Bulletin”

The poster as a front page: full-bleed red field, black condensed type set in three
unequal columns, SQUAD broken across two lines and pushed to the edges, and a white paper
band at the foot carrying the factual programme. Hand-set, loud, almost no whitespace.

- **Palette:** bulletin red `#D7261E`, newsprint `#F6F1E4`, black `#111111`, warm grey
  `#B9AFA0`.
- **Type:** Bebas Neue 300 px headline, PT Sans Narrow Bold 56 px subheads, PT Sans Narrow
  20 px copy, Ubuntu Mono 13 px stamps.
- **Composition:** asymmetric three-column stack, full-bleed colour, white footer band,
  no grid beyond the column widths.
- **Risk:** red at this area fails small-text contrast; reads as music/festival poster;
  weakens the “precise” half of the brief; least room for the product facts.
- **Why it fits:** maximum wall shout and the most distinct silhouette in a poster tube.

### Decision

| Criterion (weight)              | A | B | C |
|---------------------------------|---|---|---|
| Legibility at 3 m (25%)         | 9 | 8 | 7 |
| Product truth / brand fit (25%) | 9 | 8 | 6 |
| High-contrast editorial tone (20%) | 9 | 7 | 7 |
| Vector simplicity / buildability (20%) | 10 | 8 | 8 |
| Distinctiveness in a poster hall (10%) | 8 | 9 | 9 |
| **Weighted**                    | **9.1** | **7.9** | **7.2** |

**Chosen: Direction A, “Routing Ledger.”** It is the only direction where the layout
itself argues the product thesis — ordered roles, fixed outputs, a gate that can say no —
and it holds the brief’s “precise, editorial, high contrast” without borrowing a visual
cliché. B is the better night-stage poster and C the better street poster; both are kept
as fallbacks if the conference venue is dark or the print run is large-format outdoor.

---

## 3. Chosen direction — specification

### 3.1 Thesis

> A mission is not a prompt. It is a ledger of accountable hand-offs, and nothing merges
> without proof.

The poster is a page from that ledger: paper masthead, four ruled rows of responsibility,
then the black instrument panel where the whole chain runs and the review gate is marked
in red.

### 3.2 Palette

| Token     | Hex       | Role                                        | Area |
|-----------|-----------|---------------------------------------------|------|
| Paper     | `#F2F0E9` | field, panel text                           | 58%  |
| Ink       | `#0B0B0C` | text, panel field, rules                    | 32%  |
| Graphite  | `#5C5952` | secondary copy, ledger meta                 | 3%   |
| Signal    | `#E0361A` | gate marker, accent bar, one phrase         | 4%   |
| Rule tint | `#CFCABF` | hairlines on paper only                     | 3%   |

Measured contrast (WCAG 2.x, sRGB):

- Ink on paper `17.25:1` — display, statement, body.
- Graphite on paper `6.13:1` — body meta, safe at 14 px.
- Paper on ink `17.25:1` — panel copy.
- Signal on paper `3.91:1` — **large text and non-text marks only** (≥ 40 px or ≥ 8 px bar).
- Signal on ink `4.41:1` — diagram node, passes for graphics.

Rules: signal red is used exactly three times — the 240 × 8 accent bar, the REVIEW node in
the chain, and the words “NO MERGE.” in the closing line. It is never used for body copy,
never as a background wash, never as a second accent.

### 3.3 Type hierarchy

All faces verified installed on the build machine (Inter, Inter Display, Ubuntu Mono).

| # | Role                | Face                        | Size / line | Tracking | Case | Use |
|---|---------------------|-----------------------------|-------------|----------|------|-----|
| 1 | Masthead            | Inter Display Black         | 240 / 192   | −0.03em  | CAPS | `SQUAD`, solver-fit to 90–100% of the 1008 measure |
| 2 | Statement           | Inter Display SemiBold      | 72 / 80     | −0.02em  | CAPS | two lines, 160 px block |
| 3 | Closing             | Inter Display SemiBold      | 40 / 48     | −0.015em | CAPS | `NO PROOF. NO MERGE.` |
| 4 | Panel head          | Inter Display SemiBold      | 28 / 32     | −0.01em  | CAPS | `ORCHESTRATED ON DEEPSEEK` |
| 5 | Ledger stage        | Inter Display SemiBold      | 28 / 32     | −0.01em  | CAPS | `PLAN`, `HIRE`, `REVIEW`, `INTEGRATE` |
| 6 | Lead / body         | Inter Regular               | 18 / 32     | 0        | Sentence | one paragraph, 60–66 characters per line |
| 7 | Ledger role         | Ubuntu Mono Regular         | 14 / 24     | +0.14em  | CAPS | masthead kicker, `BOSS · PLAN GATE` |
| 8 | Micro / colophon    | Ubuntu Mono Regular         | 12 / 16     | +0.08em  | CAPS | panel footnote, event meta |
| 9 | Index numeral       | Ubuntu Mono Regular         | 20 / 24     | 0        | Tabular | `01`–`04` |

Rationale: two voices only — a grotesque that makes declarations and a mono that states
machine facts. The 240 → 72 jump (3.3×) creates the editorial shock; 72 → 28 → 18 steps
down in job-sized increments rather than a decorative ratio, so the eye always knows what
is a claim and what is a detail. Nothing is smaller than 12 px on a 1200 px canvas; 12 px
exists only in the panel footnote and the event meta.

Fit conditions (checked by the solver against real metrics before build):

- Masthead: 240 px at −0.03em must measure ≥ 906 px (90% of 1008). If short, step up in
  8 px increments to a 272 px ceiling; if long, step down. Never distort or scale by eye.
- Statement: line 2 at 72 px must stay inside 1008 px. If it measures wider, drop the
  statement to 64 / 72 rather than allowing a third line — the two-line claim is the device.

### 3.4 Grid — 1200 × 1600

- **Margins:** 96 left / right / top; 128 bottom (optical, gives the closing line air).
- **Columns:** 8 × 105 px, gutter 24 px. Check: `8×105 + 7×24 = 840 + 168 = 1008`;
  `1200 − 2×96 = 1008`. Content spans x = 96 → 1104.
- **Baseline:** 8 px. All type blocks, rules and panels sit on multiples of 8.
- **Vertical bands:** 96 top → 1472 last baseline → 128 bottom.
- **Safe zone:** all live text ≥ 96 px from any edge; the black panel may bleed, its text
  may not.

Column starts: `96, 225, 354, 483, 612, 741, 870, 999`; right edge `1104`.

**Why this grid:** the poster carries a table and a 7-step chain, so the page grid has to
divide cleanly into 1 / 3 / 2 / 2 (index, stage, role, output) while the diagram uses its
own 7-step pitch of 144 px. Both are anchored to the same 96 px margin: the ledger fills
all four groupings of the 8-column grid, the chain starts at x 96 and places one 8 px node
every 144 px, so seven labels (longest: `INTEGRATE`, ≈ 65 px at 12 px mono) sit inside
their columns without collisions. The 24 px gutter is roughly one and a half cap heights
of body text, which keeps the table from turning into a form.

### 3.5 Vertical layout (y in px, all 8-multiples)

| y         | h   | Element |
|-----------|-----|---------|
| 0–96      | 96  | top margin |
| 96        | 24  | masthead row: `SQUAD — MULTI-AGENT ORCHESTRATION` left, `OPENCODE 2.3.0` right |
| 136       | 2   | full-measure rule, ink |
| 152–344   | 192 | masthead `SQUAD`, 240 px, cap-top 160, baseline 334 |
| 368       | 8   | signal bar, 240 wide, starts at x 96 |
| 400–560   | 160 | statement, 2 lines × 80 |
| 584–680   | 96  | lead paragraph, 3 lines × 32, measure 600 px |
| 704       | 2   | full-measure rule, ink |
| 720–752   | 32  | ledger header: `ID / STAGE / ROLE / OUTPUT` |
| 752–1008  | 256 | 4 ledger rows × 64, hairline `#CFCABF` between rows |
| 1040–1304 | 264 | black panel, full bleed x 0–1200 |
| 1336–1384 | 48  | closing line, 40 px |
| 1424–1472 | 48  | event meta, 3 columns, 12 px mono |
| 1472–1600 | 128 | bottom margin |

Panel internals (inside the 1040–1304 ink field, text inset 96): head 1072–1104 at
28/32; rail at 1152; node labels 1176–1192 at 12/16; footnote 1240–1256; 32 px top and
48 px bottom padding.

### 3.6 Horizontal layout

| Element | x | w | Notes |
|---|---|---|---|
| Masthead left | 96 | 600 | 14 px mono, +0.14em |
| Masthead right | 804 | 300 | right-aligned to 1104 |
| Rules | 96 | 1008 | 2 px, ink |
| Display | 96 | 1008 | 240 px, tracking −0.03em; measured width must reach ≥ 90% of the measure |
| Accent bar | 96 | 240 | 8 px, signal |
| Statement | 96 | 1008 | 72 px; line 1 short, line 2 runs to ≈ 950 px |
| Lead | 96 | 600 | 18/32, graphite |
| Ledger index | 96 | 105 | col 1 |
| Ledger stage | 225 | 363 | cols 2–4 |
| Ledger role | 612 | 234 | cols 5–6 |
| Ledger output | 870 | 234 | cols 7–8, right-aligned |
| Panel head / rail / footnote | 96 | 1008 | same measure as the page |
| Event meta | 96 / 483 / 870 | 363 / 363 / 234 | starts on cols 1, 4, 7; third field right-aligned |

### 3.7 Composition

Reading order is deliberately vertical and single-path:

1. **Masthead zone (96–560).** Kicker → rule → SQUAD at 20% of the canvas width →
   red bar → two-line claim. The bar is the only colour above the panel, so the eye
   lands on the claim.
2. **Ledger zone (704–1008).** Four rows, one per accountability stage. The index numerals
   form a left rail; outputs right-align into a clean edge. The table is quiet on purpose —
   it is evidence, not decoration.
3. **Panel zone (1040–1304).** Hard tonal flip: black field, paper type, a single 2 px rail
   with seven 8 × 8 nodes and labels beneath. REVIEW is the only red node. The panel is
   full bleed, so it reads as the machine under the page.
4. **Footer zone (1336–1472).** Closing claim, then three columns of practical data.
   Bottom margin 128 closes the page without a logo lockup.

### 3.8 Copy deck

```
SQUAD — MULTI-AGENT ORCHESTRATION                      OPENCODE 2.3.0
────────────────────────────────────────────────────────────────────
SQUAD

MANY AGENTS.
ONE CHAIN OF COMMAND.

SQUAD turns a mission into a plan, hires specialists at the
right grade, isolates every writer in its own worktree, and
refuses to merge without a blind review.

ID   STAGE        ROLE                          OUTPUT
01   PLAN         BOSS · PLAN GATE              BUDGET SET
02   HIRE         PERSONA · WORKTREE            STAFFED
03   REVIEW       BLIND REVIEWER · NO TOOLS     PASS / REWORK
04   INTEGRATE    CHERRY-PICK · ABORT|THEIRS    MERGED

[panel] ORCHESTRATED ON DEEPSEEK
        MISSION · PLAN · HIRE · ASSIGN · REVIEW · INTEGRATE · FINALIZE
        FAIL-CLOSED BY DEFAULT — NO REVIEW, NO MERGE

NO PROOF. NO MERGE.

DEVELOPER CONFERENCE 2026      {{DATE}}                {{VENUE}}
```

Fill-in fields: `{{DATE}}`, `{{VENUE}}` (and the conference name, if the event is not
“Developer Conference 2026”). No URL is invented; add one only when confirmed.

### 3.9 Vector inventory (no external assets)

| Kind | Count | Spec |
|---|---|---|
| Background rect | 1 | 1200 × 1600, paper |
| Panel rect | 1 | 1200 × 264 at y 1040, ink, full bleed |
| Signal bars | 1 | 240 × 8 at (96, 368) |
| Rules | 7 | 2 px horizontal: 136 ink, 704 ink, 752 ink header underline, 816/880/944 tint, 1008 ink |
| Chain rail | 1 | 1008 × 2 at y 1152, `#3A3936`, from x 96 to 1104 (runs past the last node) |
| Chain nodes | 7 | 8 × 8 squares at x = 96, 240, 384, 528, 672, 816, 960; REVIEW in signal |
| Text runs | 39 | live editable text, not curves in the master |
| Images / bitmaps | 0 | — |
| Gradients / shadows / transparency / blends / blurs | 0 | — |

Minimum stroke 2 px at this canvas. Corners square; no rounded rectangles. Nothing is
placed by eye — every coordinate is an 8 px multiple, and every text block is set by the
solver against real font metrics.

### 3.10 Print appendix

If the 1200 × 1600 master is printed at 420 × 560 mm, 1 px = 0.35 mm: the 240 px masthead
becomes 84 mm, body 6.3 mm, micro 4.2 mm, and the 2 px rule 0.7 mm. Export a second copy
with text converted to curves for the print vendor; keep the master live. Colour is flat
spot-free CMYK-safe (all five tokens convert without a gradient), so a FOGRA39 proof can
be run without retouching.

---

## 4. Acceptance self-check

- [x] Three genuinely different directions: light operational ledger, dark orbital
      instrument, full-red newspaper bulletin — different palettes, type systems, grids
      and reading orders, not three skins of one layout.
- [x] Chosen direction states palette hex values, full type hierarchy with sizes and
      tracking, and the grid rationale (8 columns, 24 gutter, 96 margin, 8 baseline).
- [x] 1200 × 1600 portrait respected: all coordinates and bands fit inside the artboard,
      with top 96 / bottom 128 margins.
- [x] No external assets: vector rects, rules, squares and live text only; no images,
      gradients, transparency or effects.

## 5. Handoff

1. Build the vector master 1:1 at 1200 × 1600 (CorelDRAW via poster-compiler), text live,
   two named layers: `field` and `type`.
2. Export PNG 1200 × 1600 and PDF/X for review; check the masthead spans ≥ 90% of the
   1008 measure, the panel rail carries 7 nodes at 144 pitch, and no text falls below 12 px.
3. Open items: event name, date and venue tokens; confirm whether the poster is screen-only
   or offset, which decides 2 px vs 0.7 mm hairline tuning.
