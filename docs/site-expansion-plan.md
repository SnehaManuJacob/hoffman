# Site expansion plan: four pages, one investigation

*Branch `site-expansion`, cut from `storytelling-intro` (22 Nov 2026). Planning only: nothing is built yet.*

This plan comes from reading:
- the landing page (`kiln/index.html`, `style.css`, the `views/` scenes, `narrative-summary.md`, `Kiln_Project_Context_Brief.md`), seen running at localhost:5500
- `hoffman-kiln-research/`: the six documents and the two PDFs
- `future-research/`: *Kiln Futures*, the *Drying Ring* proposal, *A Dryer on Schedule* drafts 4 and 5, and the figures

---

## 0. What the inspection changes about the brief

**The landing page already tells the whole story.** It runs through the place, a five-step kiln tour, five computing ideas, the village drying problem, the kiln rebuilt into a four-bay dryer, and an honest close with five open questions. So the subpages can't be "the next chapter". Each one sits **behind one act** of the landing page. You get there from the act it deepens, and it holds what the story had to leave out: numbers, mechanisms, tables, alternatives, sources.

| Landing act | Goes deeper on |
|---|---|
| The place, the tour | **The kiln** |
| The logic in the kiln | **Evidence** (how strong each reading is) |
| The problem, the transformation | **The proposal** |
| The honest close | **The proposal** (tests) and **Evidence** (open questions) |

**Rule for every page:** the landing page says one idea per beat, and a subpage may not say it again in the same form. If a subpage needs a landing idea, it gives it in one line and then adds what the landing page couldn't hold.

Three assets already in the code shape this plan:

1. **The interactive kiln dashboard is still in the code, just hidden**: the ring, play/step/speed, the heat-recovery switch, the space–time chart, and the empty-chamber fork (wait / skip / fire empty). It's the strongest interactive the project has, and the landing page no longer shows it. It belongs on **The kiln** page.
2. **The evidence system already exists**: F/L/A/S/U tags in `config.js`, the "Show evidence" pill, and a details sheet generated from `METHODS`. The Evidence page should grow out of this rather than start fresh.
3. **The research already grades itself**, in four separate schemes:
   - Kiln facts are tagged **F / L / A / S / U** (`config.js`, the book).
   - Algorithm readings are rated **Strong / Moderate / Weak / Contrast / Method / Trap** (*Algorithm Connections*).
   - Applications are graded **Exists / Tested / Proposed / Speculative** (*Kiln Futures*).
   - Proposal claims are tagged **Established / Field / Design decision / Open** (*Dryer on Schedule*).

   Together these are the backbone of the Evidence page, provided they're explained as **three separate questions**, not one scale (section 4).

---

## 1. Sitemap and navigation

```
A Kiln on Schedule
│
├── /                 The investigation   (existing landing page, a long scroll story)
│     question → place → kiln tour → logic → problem → dryer → honest close
│
├── /kiln.html        The kiln            "How the original system works"
├── /proposal.html    The proposal        "Same organisation, different decisions"
└── /evidence.html    Evidence            "How each claim is known"
                         └── #claim-…     one anchor per claim, which every chip links to
```

**Navigation** (one shared top bar, extended from the existing one):

```
A KILN ON SCHEDULE      Investigation   The kiln   The proposal   Evidence        [Show evidence]
```

- The wordmark stays on the left and the evidence pill on the right, as now. Four quiet text links sit between them. The current page is marked with an underline, not a colour (colour means heat).
- On the landing page the bar stays as it is during the pinned scroll scenes. The links fade in once the intro has finished, so the opening shot stays clean.
- **The evidence pill works on every page.** Switched on, every tagged claim shows its chip. **Every chip links to `evidence.html#claim-id`.** This is what joins the four pages: any statement anywhere is one click from its source.
- **The order is a reading order, not a hierarchy.** At the foot of each subpage, one "next" door continues the loop: Kiln → Proposal → Evidence → back to the question.
- Mobile: the links fold into a single "Pages" menu. The pill stays visible.

---

## 2. Each page's role, message and narrative flow

### 2.1 The kiln: *how the original system works*

**Key message:** *The Hoffmann kiln saves fuel through how it is organised, not through a better fire: the fire travels, the air has one route, and every chamber is at a different stage at once.*

**Who it's for:** a visitor who finished the tour and wants to know *how*: the air circuit, the dampers, the firing curve, how it compares with other kilns, and what isn't known about this one.

**Identity:** the **technical drawing**. Blueprint paper (`--paper`) with an ink grid and section cuts, the way the intro turns the factory into a drawing. Heat colour appears only where something is hot, as everywhere else.

**Flow:**

| # | Section | What it holds | Visual / interaction |
|---|---|---|---|
| 1 | **Opening: the kiln in figures** | Five facts as a strip of figures, each with its chip: 8 chambers [F] · fire moves every 2 h, without fail [F] · ~850–900 °C, as told [F] · cashew-nut shells through roof holes [F] · shape at Kundapur unknown [U]. One line on what the page covers. | Figure strip; chips always shown here. |
| 2 | **A short lineage** | 1858 patent (Hoffmann; sources say 1858 or 1859) → circular, then elliptical, then racetrack plans → over 4,000 kilns by 1900 → Basel Mission tile works, Mangalore, 1865 → Albuquerque, 1868 (a z-shaped, cashew-shell-fed kiln at 850–900 °C) → the Mangalore cluster shrinks from about 75 factories (early 1990s) to 3 (2022) → Prabhakar, Kundapur, today. | A horizontal timeline with plan shapes drawn at their dates. Disputed dates are shown as a span with a note, not a single tick. |
| 3 | **Anatomy** | Chambers, partitions, wicket doors, stoke holes, roof, main flue, dampers, chimney, walkway. For each: what it does, how it's known, and a reference photo (from another kiln, and labelled as such). | **An exploded axonometric of one chamber plus a plan of the ring.** Hotspots open a short card. Reuses `COMPONENTS` in `config.js` and the existing tour photos with their credits. |
| 4 | **The air circuit** | Air drawn in behind the fire cools the fired tiles, feeds the fire, crosses the green tiles ahead, then leaves through one open damper to the chimney. It moves by natural draught, with no fans. [L, not observed at Kundapur] | **A longitudinal section.** The visitor picks which damper is open; the route redraws and the chambers ahead warm or stay cold. The landing showed this as an arrow; this is the mechanism. |
| 5 | **Two ways to read one kiln** | *One chamber over time* (its firing curve: load → preheat → fire → cool → unload) versus *all chambers at one moment* (every one at a different stage). They are the same table read along different axes. | **The space–time grid.** Hover a row to see a moment, hover a column to see a chamber's life. Temperatures shown as bands [S], never as precise readings. |
| 6 | **Run the kiln** | The revived dashboard: play, step, speed, recovery on/off (fuel compared side by side in relative units), and emptying a chamber to meet the fork: wait / skip / fire empty. What Kundapur actually does is unknown. | **The existing ring, chart and panels**, moved onto this page under a clear "this is a model" frame. No score, no best choice, as the brief requires. |
| 7 | **One logic, many kilns** | What moves and what stays put: batch (intermittent) kiln, Hoffmann, tunnel kiln (the ware moves and the fire stays), Bull's trench / zigzag. Then pace: Kundapur (8 chambers, 2 h) against a standard 16-chamber kiln (one chamber a day) and Stewartby, UK (17 chambers each side, 10-day cycle, 930–960 °C soak). | **Small multiples**: one tiny ring per type, with arrows for what moves. A **loop-time bar chart** on a log scale. Kundapur's ~16 h loop is drawn dashed, because it's derived [A], not observed. |
| 8 | **What we don't know about this kiln** | Its shape. What exactly moves every 2 h. How many chambers are thermally active at once. Why the BEE cluster reports say 32–36 chambers when the manager said 8. What happens to a chamber that isn't ready. | A short list of cards. Each links to its entry on the Evidence page. |
| → | **Door** | "These rules, carried to a different material." | → The proposal |

**Not on this page:** the five computing ideas as cards (the landing has them; their strength ratings go on Evidence), and the drying problem.

---

### 2.2 The proposal: *a design hypothesis, not a result*

**Key message:** *Keep the kiln's organisation, change how it decides. The produce stays put and the heated air's route moves, but the dryer advances when the nuts are ready, not when a clock says so. Whether that beats simpler options is untested.*

**Who it's for:** someone who saw the Drying Cycle on the landing page and asks "how would that actually work, and how do you know?"

**Identity:** **the control layer.** The landing page already uses purple (`#B46AFF`) for whatever does the controlling: logic, dampers, trigger. This page takes purple as its accent and the air tone (`--air`) for airflow. Bays are drawn in ink. Heat colour is used only for the heater. A persistent **status band** ("Design hypothesis · draft 5 · not built, not tested") runs under the top bar.

**Flow:**

| # | Section | What it holds | Visual / interaction |
|---|---|---|---|
| 1 | **Status first** | What this is and what it isn't: not a Hoffmann kiln for farms (no masonry ring, no fire touching food, no two-hour clock). How to read the four marks (Established / Field / Design decision / Open) and how they map to the site's letters. | Status band plus a four-chip key. |
| 2 | **The problem, made precise** | **Two problems, not one.** (1) Rain falling on nuts spoils them, and growers already solve this by carrying them indoors. (2) Humid air indoors slows drying from up to 2 weeks to 1–1.5 months; the nuts don't spoil, they wait. The dryer is mainly for problem 2. It's about wet spells, not the monsoon itself: arecanut ripens mostly after the main monsoon. | **A split panel** for the two problems. **A harvest-and-rain calendar ring**: coastal ripening late Oct – late Jan [Established, TSS] against the monsoon season. |
| 3 | **The benchmark** | Success is defined before the design: in a rainy spell, a batch should dry closer to the 2 weeks of roof drying than the 1–1.5 months of indoor drying. Matching indoor drying counts as failure. | Three bars: roof [F], indoor [F], and the dryer as a **dashed target band** labelled "a claim to test". This is the landing's comparison turned into a pass/fail line. |
| 4 | **Why the existing options fall short** | Sun on the roof, indoors, tarpaulins, a single-batch heated dryer, this proposal, compared on: protects from rain? dries in humid weather? handles lots arriving over weeks? | **A compact matrix** with tagged cells. The proposal's row is drawn as intended, not achieved. |
| 5 | **What carries over, what's left behind** | Principles A–E kept (stationary material, a moving thermal zone, staggered batches, shared infrastructure, by-product fuel). F–H dropped (heat recovered from hot product, fuel fed into the charge, a fixed clock). **Precedents** that show A–D working elsewhere: simulated moving bed (1961), Johnson's tobacco-curing patent (1980, claims 60–75% less fuel; inventor's claim only), HP's counter-flow dryer patent, Arita's shared 21-chamber climbing kiln. | **A sorting diagram**: eight principle tiles fall into "carried" or "left behind", each with a one-line reason. Precedent cards graded Exists / Tested. |
| 6 | **How it works** | Four bays, each with a plenum, perforated floor, nut layer and headspace. One fixed husk-fired heater (indirect: combustion gas never touches the nuts) and one fan. Twelve dampers. Three bay states: active, isolated, bypassed. The return duct. | **The central interactive: a damper diagram** redrawn in the site's language. A step control (1 → 4) opens and closes dampers, *make before break*, and the air route redraws. The 12 × 4 damper table beside it highlights the current column. |
| 7 | **The counter-current check** | Each batch enters as the tail, becomes the middle, then the lead, then is unloaded, without moving. | **A batch-by-step grid** that shows the **same diagonal as the kiln's space–time chart**. This is the visual hinge between the two pages, and it's said outright. |
| 8 | **Is the air fit for the next bay?** | Why relative humidity alone misleads. Humidity ratio, dew point and remaining capacity. The route check: pass air on only if capacity is above a minimum and the dew point is below the next bay's nut temperature. | **A psychrometric explainer**: set inlet air (e.g. 27 °C / 90% heated to 47 °C) and follow it through bay 1 → 2 → 3. A warning appears when the dew point rises above the nut temperature. Standard physics, no heat loss, **illustrative, not a performance prediction**, and labelled as such. Reproduces the proposal's worked example exactly. |
| 9 | **Two exceptions** | *Early exit* (air fails the check, so the next bay is bypassed) and *tempering* (a partly open supply damper warms a cold new batch). | Toggles on the same damper diagram. |
| 10 | **Two clocks** | The kiln is time-triggered: every 2 h, without fail [F]. The dryer is condition-triggered: sense → route → temper → balance → advance, with a person confirming by the growers' own test (the nut is hard, the outer layer peels easily) [F]. Its step is roughly 4–5 days, the author's estimate. | **Two dials side by side** (2 hours vs several days), then **the decision logic as a flowchart**, with the human-in-the-loop step marked. Pseudocode available in a fold-out. |
| 11 | **Potential effects** | No rain exposure; faster than indoors (how much: open); fuel from the crop; better use of heated air; more regular output; a shared heater. Each says what it rests on. **No fuel, cost or labour saving is claimed.** | A list where every line carries its basis chip. Nothing is shown as a number. |
| 12 | **What would have to be tested** | The 13 tests, grouped by method: model, bench rig, field. Test 1 (does it beat indoor drying in rain?) is the one the others serve. | **A test board**: three columns by method, with test 1 pinned above. Each card says why it matters and how it could be investigated. |
| → | **Door** | "Every claim on this page, traced." | → Evidence |

**Not on this page:** the village scene, the box-dryer failure, or the kiln-to-dryer transformation sequence. The landing page tells those.

---

### 2.3 Evidence: *how each claim is known*

**Key message:** *Every claim on this site says how it is known: seen, told, read, assumed, simulated or unknown. Very little was directly observed, and the site says so rather than hiding it.*

**Who it's for:** a juror, a researcher, or a sceptical visitor. It works as a reference page: you don't have to read it top to bottom.

**Identity:** **the ledger.** The clay reading ground (`--clay`), sand type, ruled rows. The chips are the main colour on the page. Almost no motion. It should feel like an archive, not a show.

**Flow:**

| # | Section | What it holds | Visual / interaction |
|---|---|---|---|
| 1 | **Three questions, three scales** | (1) *How is this fact known?* F / L / A / S / U. (2) *How strong is this reading of the kiln as computing?* Strong → Trap. (3) *How real is this application?* Exists / Tested / Proposed / Speculative. How the proposal's four marks map onto (1). | Three keys side by side, each with one worked example. |
| 2 | **The shape of the evidence** | How the tags are spread across the site: per landing act, then the kiln page, then the proposal. Observed claims thin out, and proposed or unknown ones grow, as the story moves from kiln to dryer. | **A stacked proportion strip per section**, generated from the claims data, not drawn by hand. |
| 3 | **Fieldwork** | What was done, when and how: the site visit to Prabhakar Tile Works, conversations with workers and a follow-up conversation, conversations with arecanut growers (Nov 2026). The limits: a few conversations, not a survey; no instruments; one site, one season. | **An observation log**: one card per field fact, each marked **seen** or **told**, with date, who (by role, not name) and how it's used on the site. Field photos only if permitted (see gaps). |
| 4 | **Claims register** | Every claim on the site: the claim, its tag, its source(s), where it appears (linked), notes and discrepancies. | **A filterable table** (by page, by tag, by source type). Each row is the anchor that chips link to. |
| 5 | **Readings of the kiln** | The five ideas on the landing page (Algorithm, Loop, Pipeline, Forwarding, Trigger), each rated on the *Algorithm Connections* scale, with *where it breaks*. The three levels of claim (descriptive / behavioural / mechanism). **Readings tested and rejected**: simulated annealing, caching, genetic algorithms. | Five rated cards with a strength meter, plus a "rejected" shelf. Text kept short; full reasoning in fold-outs. |
| 6 | **The model** | What the simulation is and isn't: relative units only, bands not readings, what each computed figure is based on. | **Generated from `config.js` `METHODS`**, as the details sheet is now, so it can't drift from the code. |
| 7 | **Where sources disagree** | The patent in 1858 or 1859. The Basel Mission factory founded in 1860 or 1865. 8 chambers (the manager) or 32–36 (BEE cluster reports). 850–900 °C (field) or 1100–1200 °C (BEE reports). Roof drying in 2 weeks (growers) or 40–45 days (published guidance). Kundapur's 2-hour step against one chamber a day elsewhere. | **Discrepancy cards**: two values facing each other, sources under each, and what the site uses and why. |
| 8 | **Open questions** | Kiln and dryer together, each with *what would settle it* (from *Algorithm Connections* §6 and the proposal's §18). | Grouped by what would answer it: a return visit, a model, a bench test. |
| 9 | **References** | The full list (section 5 below), grouped. Each entry: citation, link, source type, what it supports on the site. | Grouped list, filterable by type. Entries without a confirmed URL say so instead of guessing one. |

---

## 3. How the pages connect to the landing page

**From the landing page (new, light-touch exits):**
- **End of the kiln tour** ("Heat, handed forward"): a small door, *"The full anatomy, and a kiln you can run →"* to The kiln.
- **End of "The logic in the kiln"**: *"How strong are these readings? →"* to Evidence #readings.
- **After "The Drying Cycle" is named**: *"How it would work, and what's untested →"* to The proposal.
- **The final question** ("Do you have a problem a system like this could help solve?"): three doors appear under it, one per page. This replaces a dead end with the site's index.
- **The skip link** ("Skip the scrolling story") gets a sibling: "Go to a page".
- **Every evidence chip** on the landing page becomes a link to its Evidence entry.

**Back to the landing page:** the wordmark, plus a line on each subpage's opener, e.g. *"In the story: the five-step tour. Here: the mechanism behind it."*

**Shared threads, carried across pages as on the landing page:**
- **The chamber numbers / bay numbers.** The same numerals and the same cell style appear on the kiln page's space–time grid, the proposal's batch grid and the Evidence strip.
- **The diagonal.** The kiln's space–time chart and the dryer's batch-by-step grid are the same picture. The proposal page puts them side by side.
- **The colour rules hold everywhere:** heat colour only for heat, air tone only for air, purple only for control.

**Nothing is moved off the landing page in this phase.** Once the subpages exist, the transformation sequence could be tightened, since its detail will have a home on the proposal page. That's a later, separate decision.

---

## 4. Reconciling the four tagging schemes (needs a decision)

The site shows one set of letter chips. The proposal document uses words. Suggested mapping:

| Site chip | Kiln page reads as | Proposal page reads as |
|---|---|---|
| **F** | Field observation | Field (seen at the factory or told by growers) |
| **L** | Literature | Established (published, or textbook physics) |
| **A** | Assumption | **Design decision** |
| **S** | Simulated | Calculated (e.g. the psychrometric example) |
| **U** | Unknown | Open |

Strength ratings (Strong → Trap) and application grades (Exists → Speculative) are **not** chips. They appear only where they apply: on reading cards and precedent cards. Keeping them off the chip system stops it from turning into a scale of how true something is.

**Suggested refinement:** split **F** into **F·seen** and **F·told**. Several "field" facts were reported, not observed: 850–900 °C was told, not measured; the 2-hour rule was confirmed in conversation; all the grower practice was reported. That's the most important honesty upgrade available.

---

## 5. References: organised list (to be verified before publishing)

Grouped as the Evidence page would show them. ✔ = a full URL is present in the research documents. ⚠ = cited only at site or organisation level, or the bibliographic details aren't verified; it needs checking before it goes on the page.

**Field (unpublished)**
- Prabhakar Tile Works, Kundapur: site visit, conversations with workers, follow-up conversation (dates to confirm).
- Conversations with arecanut growers, November 2026.

**The Hoffmann kiln: technology**
- ✔ Low-Tech Magazine, *Rings of Fire: Hoffmann Kilns* (2009) (and its Resilience.org mirror)
- ✔ Russell, A. & Vogel, R. (1999), *Evaluation of Hoffmann Kiln Technology*, Intermediate Technology Consultants (Practical Action), a study visit to Stewartby brickworks, UK. *(The local PDF is this report; the docx calls it only "Practical Action".)*
- ✔ Wikipedia, *Hoffmann kiln*; HandWiki; Grace's Guide, *Hoffman's Patent Kiln*; Historic Brick, *History*
- ✔ Taylor & Francis knowledge base excerpt, *Materials for Architects and Builders* (2019)
- ✔ Johnson, D. (2002), "Friedrich Edouard Hoffmann and the Invention of Continuous Kiln Technology", *Industrial Archaeology Review* 24(2) (paywalled; not read in full)
- ✔ ResearchGate figure, typological study of Hoffmann kilns in China since the 1950s
- ✔ EC JRC, *BAT Reference Document, Ceramic Manufacturing* (2007; updated draft 2025)
- ✔ SDC/shareweb, *Hoffman Kiln Technology*; *Hybrid Hoffman Kiln Technology*
- ✔ US patents 4790749, 4828489, 4888143, 4527974 (tile kilns; background only)

**The Mangalore tile industry**
- ✔ Wikipedia, *Mangalore tiles*; *Basel Mission tile factory*
- ✔ Udayavani (2022) and ThePrint/PTI (2022), decline of the industry
- ✔ Scroll.in (two articles); MAP Academy; Kerala Museum, *Commonwealth Trust Tile Factory, Feroke*
- ✔ Architexturez.net (Basel Mission tile industry; the Albuquerque kiln)
- ✔ Heidelberg University journal article on Mangalore tiles; Marvi Mazhar & Associates blog
- ✔ Daijiworld, Mangalorean.com, Mangalore Today (2025 clay-permit news)
- ⚠ Sahapedia; Pakistan Chowk (domain only)

**Brick-kiln research and policy (India)**
- ✔ Tibrewal, K. et al. (2023), *Nature Sustainability* 6, 1248–1257
- ✔ Yadav, Kumar & Shrivastava (2019), CSE stack monitoring
- ✔ TERI/BEE Varanasi cluster audit reports; Enzen/GKSPL brick-sector mapping (2022)
- ✔ *Breaking the Cycle or Repeat?*, *Energies* (2026)
- ✔ BEE, Mangalore roof-tile cluster profile (c. 2008); **BEE 2012 DPRs for the Mangalore–Kundapura tile cluster** (SAMEEEKSHA)
- ✔ CSE, *Zigzag Kilns: A Design Manual*; CSE slide deck on brick technologies
- ✔ Le Brun & Markides, FCBTK energetic assessment
- ⚠ "2026 CSE compliance survey" on zigzag kiln defects: no specific link
- ⚠ BEE *Towards Cleaner Brick Kilns*, SDEWES zigzag paper: domain only
- ⚠ Maithel, S., PhD thesis, IIT Bombay: cited second-hand

**Arecanut, drying and the region**
- ✔ FAO, grain drying principles; FAO, grain storage, moisture and fungi
- ✔ CPCRI, *Arecanut cultivation practices*; TSS Sirsi, *Problems in processing*; indiaagronet; Krishisewa
- ✔ Lok Sabha reply on arecanut moisture; *Madras Agricultural Journal* (2007), solar–biomass arecanut dryer
- ✔ Deccan Herald (untimely rain); Newstrail (solar tarpaulins); Inshorts (2025)
- ✔ CAMPCO (Wikipedia); Indian Cooperative (CAMPCO)
- ✔ Sateesh, D. & Adhanki, V. P. (2026), "Aquapelagic Entanglements in the Panchagangavali Region", *Geo: Geography and Environment*, doi:10.1002/geo2.70073 *(regional context; its use on the site is to be decided)*

**Precedents and parallels**
- ✔ Johnson, W. H., US 4,499,911 (multi-chamber curing); Hewlett-Packard, US 9,731,515 (variable humidity drying)
- ✔ TU Munich, *Simulated moving bed technology: old and new*
- ✔ MLIT Japan, Tengudani kiln (Arita); Noborigama climbing kilns
- ✔ Cardamom curing efficiency studies; cashew borma drying (DCR); cashew-shell carbonisation (Dapoli)

**Computing and operations research** ⚠ *(the research doc itself says year, edition and pages aren't verified)*
- Christian & Griffiths (2016), *Algorithms to Live By*; Kopetz, *Real-Time Systems*; Little (1961); Murata (1989); Silberschatz et al.; Pinedo; Åström & Murray; Cassandras & Lafortune; Kirkpatrick et al. (1983)

**Images**
- ✔ Six Wikimedia Commons photos (CC BY-SA 3.0/4.0), listed in `kiln/assets/tour/CREDITS.md`

---

## 6. Visualisation and interaction principles for the new pages

- **One central interactive per page, not many.** Kiln: the runnable ring. Proposal: the damper diagram. Evidence: the claims register. Everything else is a static or lightly animated diagram.
- **Progressive disclosure:** a one-line claim, then the diagram, then a fold-out for the working (pseudocode, tables, full reasoning). Tables like the 12-damper matrix are never shown cold; they appear next to the diagram they describe.
- **Motion only where something moves**, as on the landing page. Scroll-pinned sequences only for the damper steps; the Evidence page has essentially none. `prefers-reduced-motion` gives static, captioned states.
- **Redraw the proposal figures** (`future-research/figures/`) in the site's language. They currently use red–orange for air, which breaks the rule that air is drawn in the air tone and heat colour means heat.
- **Data-driven honesty:** the proportion strips, claims register and model notes are generated from one shared data file. A claim's tag is never typed twice.
- **Technical approach (no build step, as now):**
  - Pages: `kiln/kiln.html`, `kiln/proposal.html`, `kiln/evidence.html`.
  - Extract tokens, the top bar, nav and chips from `style.css` into a shared `site.css`, with one CSS file per page.
  - Shared modules: `nav.js`, `chips.js`, and a new `claims.js` (every claim: id, text, tag, sources, pages).
  - The kiln page reuses `engine.js`, `config.js`, `ring.js`, `chart.js` and `panel.js` as they are.
  - `bump-version.py` will need to stamp all four HTML files.

---

## 7. Content gaps and questions for you

**Decisions**
1. **The dryer's name.** The landing page calls it *The Drying Cycle*; the proposal is *A Dryer on Schedule*; *Kiln Futures* calls it a *drying ring*. Pick one for the whole site.
2. **Revive the dashboard on The kiln page?** It's built but hidden. The plan assumes yes.
3. **Tag scheme** (section 4): the letter-to-word mapping, and whether to split F into *seen* and *told*.

**Material outside the two named folders**
4. **Field documentation lives elsewhere.** The observation log needs dates, who was spoken to (by role) and what was seen versus told. That material appears to be in `field/` (photos and video from 15 Nov 2026, a scan from 7 Sep 2026) and `book/`. May I use them as sources?
5. **Photos of the factory and of growers:** do you have permission to publish them, and should any people be cropped out or anonymised?

**Facts to confirm**
6. **The kiln drawing's shape.** The landing page draws a racetrack ring, but the shape at Kundapur is recorded as unknown. Does the kiln page need to say "drawn as a ring; actual shape unknown" on the drawing itself?
7. **8 chambers versus 32–36** (BEE cluster reports): is there any answer from a return visit?
8. **"Forwarding"** is one of the landing page's five ideas, but it isn't among the 49 concepts rated in *Algorithm Connections* (the nearest, caching/warm-start, is rated a **Trap**). It needs a rating and a "where it breaks" before the Evidence page can show it alongside the others.
9. **Fieldwork dates and method**, for the Evidence page header: date(s) of the Prabhakar visit, the follow-up conversation and the grower conversations.

**Sources**
10. **Unverified sources** (marked ⚠): may I check them online and add exact URLs, or should they appear on the page marked "link to be confirmed"? Nothing will be filled in from memory.
11. **The Sateesh & Adhanki paper**: what role should it play? It's useful regional context (the monsoon on this coast, Kundapura's estuary), but nothing on the site cites it yet.
12. **Test status:** have any of the proposal's 13 tests started (a model sweep, a bench rig)? If not, every test card says "not started".
