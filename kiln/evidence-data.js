/**
 * evidence-data.js — what the Evidence page says, and where each piece
 * comes from.
 *
 * Nothing here is new research. Every entry is taken from the project's own
 * documents, named in `from`:
 *
 *   config     kiln/config.js (the model's values, tags and notes)
 *   brief      Kiln_Project_Context_Brief.md, section 4
 *   proposal   future-research/Dryer_on_Schedule_Proposal.docx (draft 5)
 *   futures    future-research/Kiln_Futures_Research.md
 *   survey     hoffman-kiln-research/Algorithm_Connections_to_the_Hoffmann_Kiln.docx
 *   history    hoffman-kiln-research/Hoffmann_Kiln_History_Mangalore.docx
 *   research   hoffman-kiln-research/Hoffmann_Kiln_Research_Consolidated.docx
 *   benchmark  hoffman-kiln-research/Brick_Kiln_Methodological_Benchmark.docx
 *
 * Where the documents disagree with each other, both are kept and the
 * disagreement is shown (DISAGREE). Where they are silent, the page says so
 * rather than filling the gap.
 */

/** The three scales. Only the first is a chip; the others never are. */
export const SCALES = {
  known: {
    q: 'How is this fact known?',
    where: 'Every page',
    items: [
      ['F', 'Field', 'Seen or told at Prabhakar Tile Works, or told by arecanut growers.'],
      ['L', 'Literature', 'Published writing on other kilns, or established engineering. Not checked at Kundapur. On the proposal page: "Established".'],
      ['A', 'Assumption', 'A choice made to build the model or the design. On the proposal page: "Design decision".'],
      ['S', 'Simulated', 'Computed by the model, or calculated on the page. Relative units, not measurements.'],
      ['U', 'Unknown', 'Not known. Where an answer is needed, one possibility is shown and labelled. On the proposal page: "Open".'],
    ],
  },
  strength: {
    q: 'How strong is a reading of the kiln as computing?',
    where: 'The logic in the story; section 04 below',
    items: [
      ['Strong', 'Matches documented behaviour with few or no extra assumptions.'],
      ['Moderate', 'Holds if named assumptions hold; those can be checked.'],
      ['Weak', 'A lens, not a claim: it reinterprets key elements, or rests on unobserved practice.'],
      ['Contrast', 'Useful for what the kiln does not do.'],
      ['Trap', 'Similar in words or look, not in mechanism. Kept in order to be rejected.'],
    ],
  },
  real: {
    q: 'How real is an application?',
    where: 'The proposal’s precedents',
    items: [
      ['Exists', 'Running commercially or historically somewhere, with documentation.'],
      ['Tested', 'Shown in lab work, pilots or engineering studies, but not in routine practice.'],
      ['Proposed', 'Recommended in a formal study. No evidence it was carried out.'],
      ['Speculative', 'An inference: the parts are grounded, but nobody has documented the combination.'],
    ],
  },
};

/**
 * Marks shown on each part of the site, counted from the pages' own code
 * on 22 November 2026: the story's tour steps (views/anatomy.js), the drying
 * problem's source lines (views/problem.js), the dryer's (views/transform.js),
 * and every chip on the kiln and proposal pages, less keys and repeats.
 * "The logic in the kiln" carries no marks: it says it is a reading.
 */
export const SHAPE = [
  { part: 'Story: the kiln tour', counts: { F: 1, L: 3, A: 1 } },
  { part: 'Story: the logic', counts: {}, note: 'A reading, not observation. Rated in section 04.' },
  { part: 'Story: the drying problem', counts: { F: 6, L: 1 } },
  { part: 'Story: the dryer and the close', counts: { F: 3, A: 13, U: 4 } },
  { part: 'The kiln page', counts: { F: 8, L: 18, A: 4, S: 1, U: 8 } },
  { part: 'The proposal page', counts: { F: 12, L: 12, A: 15, S: 1, U: 11 } },
];

/**
 * The field log. `how` says how each fact reached the record, in the words
 * the documents use. Where they do not say, neither does this.
 */
export const FIELD = [
  {
    place: 'Prabhakar Tile Works, Kundapur',
    when: 'Site visit and a follow-up conversation. Dates are not recorded in the documents behind this site.',
    who: 'The factory’s workers and its manager.',
    items: [
      { fact: 'Eight connected chambers.', how: 'either', detail: 'The model’s notes say "counted at Prabhakar Tile Factory"; the futures research says "Prabhakar’s manager said 8". Both are recorded; see "Where sources disagree".', from: 'config; futures', used: 'kiln, story' },
      { fact: 'The fire moves to the next chamber every two hours.', how: 'told', detail: 'Workers confirmed it was kept "without fail". What exactly moves (the fuel feed, the dampers, the crew) was not recorded.', from: 'brief; proposal', used: 'kiln, proposal, story' },
      { fact: 'The two-hour period is fixed, not adjusted batch to batch.', how: 'told', detail: 'Confirmed in a follow-up conversation.', from: 'config; brief', used: 'kiln' },
      { fact: 'Cashew-nut shells are fed through holes in the chamber roofs.', how: 'seen', detail: 'The model’s notes: "Seen at the factory." How many holes each chamber has was not recorded.', from: 'config', used: 'kiln, story' },
      { fact: 'Fuel arrives in wheeled hoppers.', how: 'recorded', detail: 'Recorded as field; whether seen or told is not stated.', from: 'proposal', used: '' },
      { fact: 'A marker on the kiln reads ಬೆಂಕಿ, "fire".', how: 'seen', detail: 'That it records the fire’s position is an interpretation, marked as such in the proposal.', from: 'proposal', used: '' },
      { fact: 'The peak firing temperature is about 850–900 °C.', how: 'recorded', detail: 'Always shown as a band. No instrument was used: the energy audit of this cluster found no temperature measurement anywhere in it.', from: 'brief; futures', used: 'kiln, story' },
      { fact: 'Tiles dry for about 20 days in summer and about 1.5 months in the monsoon before firing.', how: 'recorded', detail: 'Whether seen or told is not stated.', from: 'brief', used: 'model only' },
      { fact: 'The process runs clay preparation, shaping, drying, firing, cooling, sorting.', how: 'reconstructed', detail: '"Reconstructed from field notes."', from: 'survey', used: 'model only' },
    ],
  },
  {
    place: 'Arecanut growers',
    when: 'Conversations in November 2026.',
    who: 'A few growers. "Reported practice from a few conversations, not a survey."',
    items: [
      { fact: 'Nuts are dried on the roof in the sun, for up to two weeks.', how: 'told', from: 'proposal', used: 'proposal, story' },
      { fact: 'The outer surface is combed off before drying.', how: 'told', detail: '"As described to me; I have not seen this step."', from: 'proposal', used: '' },
      { fact: 'Drying has two stages: the whole nut first, then a short second drying of the inner nut.', how: 'told', from: 'proposal', used: '' },
      { fact: 'A nut is dry when it is hard and the outer layer peels off easily.', how: 'told', from: 'proposal', used: 'proposal, story' },
      { fact: 'Rain falling on the nuts spoils them, so they are carried indoors.', how: 'told', from: 'proposal', used: 'proposal, story' },
      { fact: 'Indoors in rainy weather, drying takes 1 to 1.5 months. Humid air does not spoil the nuts.', how: 'told', from: 'proposal', used: 'proposal, story' },
      { fact: 'Many growers burn the arecanut husk as fuel.', how: 'told', from: 'proposal', used: 'proposal, story' },
      { fact: 'Nuts do not lower each other’s grade, so drying beside a neighbour’s lot is acceptable.', how: 'told', detail: 'Other concerns about sharing were not asked about.', from: 'proposal', used: 'proposal' },
    ],
  },
];

export const HOW = {
  seen: 'Seen',
  counted: 'Counted',
  either: 'Counted or told',
  told: 'Told',
  recorded: 'Recorded',
  reconstructed: 'Reconstructed',
};

/**
 * The story's five computing ideas, against the survey's ratings. The
 * survey rates 49 concepts; these are its entries nearest to each idea.
 * Ratings and "where it breaks" are quoted or closely paraphrased from it.
 */
export const READINGS = [
  {
    idea: 'Algorithm', says: 'Three steps, in the same order every time.',
    entries: [
      { code: 'A4', name: 'Cyclic executive (static, table-driven schedule)', rating: 'Strong', basis: 'F', why: 'A fixed sequence on a fixed period, with no adjustment from batch to batch: the schedule behaves as if compiled in advance.' },
      { code: 'D1', name: 'Finite-state machine', rating: 'Strong', basis: 'A + F', why: 'Strong as a representation, but the states are an abstraction rather than something observed.' },
    ],
    breaks: 'The two-hour schedule may be inherited practice rather than derived from any analysis. How an overrun, a slow chamber, is handled is unknown. And where preheating becomes firing is a line the modeller draws.',
  },
  {
    idea: 'Loop', says: 'After the last chamber comes the first.',
    entries: [
      { code: 'B2', name: 'Ring buffer (circular queue)', rating: 'Moderate', basis: 'L + U', why: 'Strong if the Kundapur kiln is a closed ring.' },
      { code: 'A5', name: 'Token passing', rating: 'Moderate', basis: 'F + A', why: 'Holds for the firing state only: at most one chamber is firing.' },
    ],
    breaks: 'The geometry is unverified: Hoffmann kilns are rings or racetracks, but the Albuquerque kiln in Mangalore is described as z-shaped. And a buffer stores passive data, where the kiln’s slots are transformed while they sit in it.',
  },
  {
    idea: 'Pipeline', says: 'Eight loads at different stages at once.',
    entries: [
      { code: 'B1', name: 'Pipelining', rating: 'Strong–Moderate', basis: 'F + L', why: 'Strong for the staged, simultaneous structure.' },
    ],
    breaks: 'In a pipeline the work moves through fixed stages; in the kiln the ware stays put and the stage moves. The two are equivalent only after a change of frame, which has to be said. Pipeline stages are also independent; the kiln’s are thermally coupled.',
  },
  {
    idea: 'Forwarding', says: 'What one stage throws away is handed to the next, which needs it.',
    entries: [
      { code: 'I2', name: 'Caching, memoisation and warm-start (nearest entry)', rating: 'Trap', basis: 'L', why: 'Weak as caching; moderate only as an amortised warm start.' },
    ],
    unrated: true,
    breaks: 'The survey does not rate "forwarding" itself. Of its nearest entry it says thermodynamic language, regenerative heat recovery, is more accurate, and the computing metaphor adds little. The heat recovery is established for Hoffmann kilns in general but was not observed at Kundapur. This reading still needs a rating of its own.',
  },
  {
    idea: 'Trigger', says: 'The fire moves on when two hours are up, not when the tiles are ready.',
    entries: [
      { code: 'D5', name: 'Time-triggered versus event-triggered', rating: 'Strong', basis: 'F', why: 'Supported by the confirmed fixed period. The most direct expression of fixed rule against judgement.' },
    ],
    breaks: 'Why the kiln is time-triggered cannot be inferred: determinism, inherited practice, or no instruments. The clock may be an outer loop, with checks by eye inside it.',
  },
];

export const LEVELS = [
  ['Descriptive mapping', 'The kiln can be described with the concept. Easy to make; says more about the modeller than the kiln.'],
  ['Behavioural equivalence', 'The kiln’s behaviour matches the concept’s formal definition, so the concept could predict what it does.'],
  ['Mechanism or intent', 'The people who built or run the kiln meant it that way. Almost never shown by field data, and rarely needed.'],
];

export const REJECTED = [
  { code: 'I1', name: 'Simulated annealing', why: 'Shared words (temperature, cooling, firing) and no shared mechanism. In annealing, temperature is a search parameter, and the kiln performs no search. The real link runs the other way: computing borrowed the idea from cooling metals.' },
  { code: 'I2', name: 'Caching', why: 'A cache stores copies of data, with lookup and eviction. The kiln stores heat that decays, with neither.' },
  { code: 'I3', name: 'Genetic algorithms', why: 'The kiln’s changing plans look like variation and selection, but no design was scored by a fitness function or recombined. Cost and materials drove the changes.' },
];

/** Where the sources disagree, and what the site does about it. */
export const DISAGREE = [
  {
    topic: 'How the eight chambers are known',
    a: ['Counted at the factory', 'the model’s notes (config)'],
    b: ['"Prabhakar’s manager said 8"', 'the futures research'],
    use: 'The site says eight and tags it Field. Whether it was counted, told or both should be settled and one wording used.',
  },
  {
    topic: 'How many chambers',
    a: ['8', 'Prabhakar Tile Works (field)'],
    b: ['32–36', 'BEE’s 2012 reports for the Mangalore cluster'],
    use: 'The site uses 8. Either this kiln is unusual, or "chamber" means different things, for instance groups of the auditors’ chambers, or rows of fuel holes. Open.',
  },
  {
    topic: 'Firing temperature',
    a: ['850–900 °C', 'the field record; the Albuquerque kiln documentation'],
    b: ['1100 °C in one paragraph, 1150–1200 °C in another', 'BEE’s 2012 reports, which contradict themselves'],
    use: 'The site uses the field band, always as a range.',
  },
  {
    topic: 'How fast the fire moves',
    a: ['One chamber every 2 hours', 'Prabhakar (field)'],
    b: ['One chamber a day', 'a standard later Hoffmann kiln (Materials for Architects and Builders, 2019)'],
    use: 'Both shown on the kiln page. Whether "two hours" is one chamber or one row of fuel holes is an open question.',
  },
  {
    topic: 'Arecanut on the roof',
    a: ['Up to 2 weeks', 'growers (field)'],
    b: ['40–45 days; elsewhere 35–40 or 45–60', 'CPCRI, TSS, indiaagronet, Krishisewa'],
    use: 'The proposal uses the growers’ figure. Possible reasons: combing the outer layer first, both drying stages counted, other regions. Open.',
  },
  {
    topic: 'The patent',
    a: ['1858, Austria', 'most sources'],
    b: ['1859; Prussia', 'some sources'],
    use: 'The site says 1858 and notes the disagreement on the kiln page.',
  },
  {
    topic: 'The Basel Mission tile works',
    a: ['Founded 1860', 'some sources'],
    b: ['Production began 4 December 1865', 'most sources'],
    use: 'The site dates the start of production, 1865.',
  },
];

/** What is still open, and what would answer it. */
export const OPEN = [
  {
    by: 'A return visit to the tile works',
    items: [
      ['Is the kiln a closed ring, a racetrack, linear or z-shaped?', 'Decides whether the loop readings hold.'],
      ['What exactly moves every two hours: the fire, the fuel feed, the dampers, the crew?', ''],
      ['What happens inside the two hours: firing only, or loading and unloading too?', ''],
      ['If the next chamber is not ready, is it skipped, delayed or fired empty?', 'The model shows all three; none is known to be right.'],
      ['Has the two-hour period ever been different, and who or what set it?', 'Decides whether it is a physical limit or a convention.'],
      ['What do workers watch and adjust within a slot: flame colour, draught, fuel rate?', 'Where judgement hides inside the fixed rule.'],
      ['Crew size, tasks per step, shift pattern; does the kiln run around the clock?', ''],
      ['How many tiles in a chamber, and how are they stacked?', ''],
      ['Is anything measured or recorded?', 'The 2012 audit found nothing measured in the cluster.'],
      ['How are fired tiles graded, and does the grade depend on the chamber?', ''],
      ['Eight chambers, or thirty-odd, and what is a "chamber" here?', ''],
      ['When, and by whom, was this kiln built?', ''],
    ],
  },
  {
    by: 'More conversations with growers',
    items: [
      ['How many pickings, and how far apart?', 'Decides whether staggered bays can be kept full.'],
      ['How often does rain catch nuts before they can be moved?', ''],
      ['What does slow drying cost: a late sale, space, handling?', ''],
      ['How would lots be kept apart in a shared dryer?', ''],
      ['Is there enough husk to fuel it?', ''],
      ['Will buyers accept mechanically dried nuts?', 'Needs a cooperative or trader too.'],
    ],
  },
  {
    by: 'A model and a bench rig',
    items: [
      ['Eleven questions about the dryer itself: saturation, heat loss, how many bays, thresholds, the fan, balancing, condensation, monitoring, seals and sensors, safe temperatures, and whether spent air dries anything.', 'Listed with how each could be tested on the proposal page.'],
    ],
    link: './proposal.html#tests',
  },
];

/**
 * Every source the site rests on, grouped. `url` is as recorded in the
 * research documents; none was re-checked for this page. Where a document
 * cites only a site or an organisation, `url` is null and the entry says so.
 * `supports` says what it is used for on the site.
 */
export const SOURCES = [
  {
    group: 'Fieldwork',
    local: true,
    items: [
      { cite: 'Prabhakar Tile Works, Kundapur. Site visit, conversations with workers and the manager, and a follow-up conversation.', type: 'Field', supports: 'Every F mark about the kiln.' },
      { cite: 'Conversations with arecanut growers, November 2026.', type: 'Field', supports: 'Every F mark about drying.' },
    ],
  },
  {
    group: 'The project’s own documents',
    local: true,
    items: [
      { cite: 'A Dryer on Schedule: design hypothesis, draft 5. November 2026.', type: 'Unpublished', supports: 'Every design decision and test on the proposal page.' },
      { cite: 'Beyond the Tile: Futures for the Mangalore Tile Kiln. Research notes, 15 November 2026.', type: 'Unpublished', supports: 'The principles, the industry survey, the BEE reports, the precedents.' },
      { cite: 'Algorithm Connections to the Hoffmann Kiln. 28 September 2026.', type: 'Unpublished', supports: 'The ratings in section 04; the field questions.' },
      { cite: 'Brick Kilns in India as a Methodological Benchmark. 30 September 2026.', type: 'Unpublished', supports: 'How this project separates fact, assumption and simulation.' },
      { cite: 'The kiln model: kiln/config.js and kiln/engine.js.', type: 'Code', supports: 'Every S mark; the values listed in section 05.' },
    ],
  },
  {
    group: 'The Hoffmann kiln',
    items: [
      { cite: 'Russell, A. & Vogel, R. (1999). Evaluation of Hoffmann Kiln Technology. Intermediate Technology Consultants.', url: 'https://practicalactionpublishing.com/book/2727/download?type=download', type: 'Report', supports: 'A working kiln at Stewartby, England: natural draught, dampers, the 10-day cycle, the 150 °C exhaust.' },
      { cite: 'Low-Tech Magazine (2009). Rings of Fire: Hoffmann Kilns.', url: 'https://solar.lowtechmagazine.com/2009/10/rings-of-fire-hoffmann-kilns/', type: 'Article', supports: 'The air circuit, partitions, dampers; plans from circular to rectangular.' },
      { cite: 'Resilience.org (2009). Rings of Fire: Hoffmann Kilns (mirror).', url: 'https://www.resilience.org/stories/2009-11-16/rings-fire-hoffmann-kilns/', type: 'Article', supports: 'As above.' },
      { cite: 'Johnson, D. (2002). Friedrich Edouard Hoffmann and the Invention of Continuous Kiln Technology. Industrial Archaeology Review 24(2).', url: 'https://www.tandfonline.com/doi/abs/10.1179/iar.2002.24.2.119', type: 'Journal', supports: 'Origins and typology. Paywalled; not read in full.' },
      { cite: 'Wikipedia. Hoffmann kiln.', url: 'https://en.wikipedia.org/wiki/Hoffmann_kiln', type: 'Encyclopedia', supports: 'The patent, the spread, surviving examples.' },
      { cite: 'Grace’s Guide. Hoffman’s Patent Kiln.', url: 'https://www.gracesguide.co.uk/Hoffman%27s_Patent_Kiln', type: 'Encyclopedia', supports: 'Patent history.' },
      { cite: 'HandWiki. Engineering: Hoffmann kiln.', url: 'https://handwiki.org/wiki/Engineering:Hoffmann_kiln', type: 'Encyclopedia', supports: 'Patent history.' },
      { cite: 'Historic Brick. History.', url: 'https://historic-brick.com/brick_history.html', type: 'Website', supports: 'The invention; Wienerberg.' },
      { cite: 'Materials for Architects and Builders (2019), excerpt in the Taylor & Francis knowledge base.', url: 'https://taylorandfrancis.com/knowledge/Engineering_and_technology/Industrial_engineering_%26_manufacturing/Hoffmann_kiln', type: 'Book excerpt', supports: 'The standard later kiln: one chamber a day, 960–1000 °C; tunnel kilns replacing it.' },
      { cite: 'Typological study of Hoffmann kiln modifications in China since the 1950s (figure on ResearchGate).', url: 'https://www.researchgate.net/figure/Design-drawing-of-Hoffmann-kiln-patented-for-the-first-time-in-Austria-in-1858-Source_fig1_335639775', type: 'Journal figure', supports: 'The 1858 patent drawing; local adaptations.' },
      { cite: 'civilengineering.blog (2017). Working of clamp, Bull’s trench and Hoffman’s kilns.', url: 'https://civilengineering.blog/2017/09/25/bricks-burning/', type: 'Article', supports: 'Background.' },
      { cite: 'SDC / shareweb. Hoffman Kiln Technology; Hybrid Hoffman Kiln Technology.', url: 'https://www.shareweb.ch/site/Climate-Change-and-Environment/about%20us/about%20gpcc/Documents/05%20Hoffman%20Kiln.pdf', type: 'Report', supports: 'Background.' },
      { cite: 'European Commission JRC (2007). Best Available Techniques Reference Document, Ceramic Manufacturing.', url: 'https://mepr.gov.ua/wp-content/uploads/2023/05/cer_bref_eng.pdf', type: 'Government report', supports: 'Tiles and bricks in one regulatory category.' },
      { cite: 'European Commission JRC (2025). Updated draft BAT Reference Document, Ceramic Manufacturing.', url: 'https://eippcb.jrc.ec.europa.eu/sites/default/files/2025-01/CER_D1_Updated_BW_web-bref.pdf', type: 'Government report', supports: 'As above.' },
      { cite: 'US patents 4790749, 4828489, 4888143, 4527974 (tile kilns).', url: 'https://patents.google.com/patent/US4790749', type: 'Patent', supports: 'Background only.' },
      { cite: 'Historic England. Llanymynech Hoffmann kiln listing.', url: 'https://historicengland.org.uk/listing/the-list/list-entry/1021412', type: 'Heritage record', supports: 'Background.' },
    ],
  },
  {
    group: 'The Mangalore tile industry',
    items: [
      { cite: 'Architexturez.net. The Basel Mission tile industry and the Albuquerque kiln.', url: 'https://architexturez.net/doc/az-cf-193722', type: 'Documentation', supports: 'The z-shaped, cashew-shell-fed kiln at 850–900 °C.' },
      { cite: 'Architexturez.net. The first Basel Mission tile factory, Jeppu.', url: 'https://architexturez.net/doc/az-cf-193590', type: 'Documentation', supports: 'Factory history.' },
      { cite: 'Wikipedia. Mangalore tiles.', url: 'https://en.wikipedia.org/wiki/Mangalore_tiles', type: 'Encyclopedia', supports: 'Plebst, 1865, the factories that followed.' },
      { cite: 'Wikipedia. Basel Mission tile factory.', url: 'https://en.wikipedia.org/wiki/Basel_Mission_tile_factory', type: 'Encyclopedia', supports: 'As above.' },
      { cite: 'Udayavani (2022). Mangalore tile industry in state of decline.', url: 'https://www.udayavani.com/english-news/mangalore-tile-industry-in-state-of-decline', type: 'News', supports: 'From about 75 factories to three. Also carried by ThePrint/PTI.' },
      { cite: 'ThePrint / PTI (2022). Mangalore tile industry in state of decline.', url: 'https://theprint.in/india/mangalore-tile-industry-in-state-of-decline/1199184/', type: 'News', supports: 'As above.' },
      { cite: 'Scroll.in. Mangalore’s age-old tiles survive the shift towards cement.', url: 'https://scroll.in/article/668853/mangalores-age-old-tiles-survive-the-shift-towards-cement', type: 'News', supports: 'Background.' },
      { cite: 'Heidelberg University journal. Mangalore tiles and the Basel Mission Company.', url: 'https://journals.ub.uni-heidelberg.de/index.php/mitt-dgamn/article/view/105434/100568', type: 'Journal', supports: 'Background.' },
      { cite: 'MAP Academy. Mangalore tiles.', url: 'https://mapacademy.io/?p=28325', type: 'Encyclopedia', supports: 'Background.' },
      { cite: 'Kerala Museum (2024). The Commonwealth Trust Tile Factory in Feroke.', url: 'https://keralamuseum.org/?p=8237', type: 'Heritage', supports: 'A still-working Basel Mission factory.' },
      { cite: 'Daijiworld (2025); Mangalorean.com; Mangalore Today. Clay-permit rules and closures.', url: 'https://daijiworld.com/index.php/news/newsDisplay?newsID=1274428', type: 'News', supports: 'The industry now.' },
      { cite: 'Marvi Mazhar & Associates. Basel Mission tile history.', url: 'https://marvimazhar.com/blog-1/tag/Basel+Mission', type: 'Blog', supports: 'Factory timeline.' },
      { cite: 'Sahapedia. The Basel Mission and its terracotta products.', url: null, type: 'Encyclopedia', supports: 'Background. Cited by site only; exact page to be found.' },
      { cite: 'Pakistan Chowk. The case of Mangalore tiles in Karachi.', url: null, type: 'Article', supports: 'Background. Cited by site only; exact page to be found.' },
    ],
  },
  {
    group: 'Brick and tile kilns in India',
    items: [
      { cite: 'Bureau of Energy Efficiency (2012). Detailed project reports, Mangalore tile cluster (SAMEEEKSHA).', url: 'https://sameeeksha.org/pdf/dpr/Mangalore_tiles_cluster/', type: 'Government report', supports: 'No measurement in the cluster; exhaust at 350–400 °C; 32–36 chambers; the heat-recovery fan. Projections, not outcomes.' },
      { cite: 'Bureau of Energy Efficiency (c. 2008). Mangalore roof tile cluster profile.', url: 'https://beeindia.gov.in/sites/default/files/Mangalore.pdf', type: 'Government report', supports: 'Cashew shell as the highest-energy fuel in use.' },
      { cite: 'Tibrewal, K. et al. (2023). Reconciliation of energy use disparities in brick production in India. Nature Sustainability 6, 1248–1257.', url: 'https://www.nature.com/articles/s41893-023-01165-x', type: 'Journal', supports: 'How kilns are studied: method benchmark.' },
      { cite: 'Yadav, N. K., Kumar, P. & Shrivastava, S. (2019). Emissions Monitoring of Brick Kilns: Zigzag vs FCBTK. CSE.', url: 'https://cseindia.org/content/downloadreports/9387', type: 'Report', supports: 'Method benchmark.' },
      { cite: 'TERI / BEE. Post-commissioning energy audit, Varanasi brick cluster.', url: 'https://beeindia.gov.in/sites/default/files/Post%20Commissioning_report_kiln%202_revised_2.pdf', type: 'Government report', supports: 'Method benchmark.' },
      { cite: 'Enzen & Greentech (2022). Energy and resource mapping of the MSME brick sector, for BEE.', url: 'https://beeindia.gov.in/sites/default/files/Brick_sector_Energy_Mapping.pdf', type: 'Government report', supports: 'Method benchmark.' },
      { cite: 'Breaking the Cycle or Repeat? Justice implications of energy transition in the Indian brick industry. Energies (2026).', url: 'https://doi.org/10.3390/en19092201', type: 'Journal', supports: 'Method benchmark.' },
      { cite: 'Centre for Science and Environment. Zigzag Kilns: A Design Manual.', url: 'https://cseindia.org/zigzag-kilns-a-design-manual-8525', type: 'Manual', supports: 'Bull’s trench and zigzag kilns.' },
      { cite: 'Le Brun & Markides. Energetic assessment of fixed-chimney Bull’s trench kilns.', url: 'https://www.matec-conferences.org/10.1051/matecconf/20166811001', type: 'Conference paper', supports: 'Background.' },
      { cite: 'CSE (2026). Compliance survey of zigzag kilns.', url: null, type: 'Report', supports: 'Not used on the site. Cited by organisation only.' },
      { cite: 'Maithel, S. Energy utilisation in brick kilns. PhD thesis, IIT Bombay.', url: null, type: 'Thesis', supports: 'Not used on the site. Cited second-hand.' },
    ],
  },
  {
    group: 'Arecanut, drying and the coast',
    items: [
      { cite: 'FAO. Grain drying: principles and general considerations.', url: 'https://www.fao.org/4/x5065e/x5065E0c.htm', type: 'Guidance', supports: 'Drying rate, saturation through deep beds.' },
      { cite: 'FAO. Grain storage: moisture and fungi.', url: 'https://www.fao.org/4/T1838E/T1838E0u.htm', type: 'Guidance', supports: 'Slow drying and mould.' },
      { cite: 'CPCRI, Kasaragod. Arecanut cultivation practices.', url: 'https://cpcri.gov.in/filemgr/webfs/publication/arecanut_cultivation_practices(eng).pdf', type: 'Extension guide', supports: 'Drying times; safe storage moisture.' },
      { cite: 'Totgars’ Cooperative Sale Society, Sirsi. Problems in arecanut processing.', url: 'https://tssindia.in/others/about-arecanut/problems-processing', type: 'Cooperative', supports: 'Ripening seasons; 40–45 days of drying.' },
      { cite: 'indiaagronet. Arecanut.', url: 'https://indiaagronet.com/indiaagronet/crop%20info/arecanut.htm', type: 'Guide', supports: '35–40 days.' },
      { cite: 'Krishisewa. Arecanut.', url: 'https://krishisewa.com/crop-cultivation/61-arecanut.html', type: 'Guide', supports: '45–60 days, unhusked.' },
      { cite: 'Lok Sabha. Reply on arecanut moisture (CPCRI findings).', url: 'https://eparlib.sansad.in/bitstream/123456789/2984120/1/AU1255_uonz6z.pdf', type: 'Parliament', supports: 'Moisture limits.' },
      { cite: 'Madras Agricultural Journal (2007). A solar–biomass hybrid arecanut dryer.', url: 'https://masujournal.org/store_file/archive/94-7-12-256-268.pdf', type: 'Journal', supports: 'Drying temperatures tested.' },
      { cite: 'Deccan Herald. Untimely rain in Dakshina Kannada and Udupi.', url: 'https://www.deccanherald.com/content/43552/untimely-rain-dk-udupi.html', type: 'News', supports: 'Rain catching drying nuts.' },
      { cite: 'Inshorts (2025). Coastal areca growers hit by rain.', url: 'https://inshorts.com/en/news/coastal-areca-growers-in-k-taka-hit-by-rain--crop-loss-looms-large-1752854648395', type: 'News', supports: 'As above.' },
      { cite: 'Newstrail. Areca growers opt for solar tarpaulins.', url: 'https://newstrailindia.com/inner.php?id=650', type: 'News', supports: 'What growers choose now.' },
      { cite: 'CAMPCO (Wikipedia); Indian Cooperative, CAMPCO procurement.', url: 'https://en.wikipedia.org/wiki/CAMPCO', type: 'Encyclopedia', supports: 'Cooperatives as possible users.' },
      { cite: 'Sateesh, D. & Adhanki, V. P. (2026). Aquapelagic Entanglements in the Panchagangavali Region. Geo: Geography and Environment.', url: 'https://doi.org/10.1002/geo2.70073', type: 'Journal', supports: 'The monsoon at Kundapura.' },
    ],
  },
  {
    group: 'Precedents and parallels',
    items: [
      { cite: 'TU Munich. Simulated moving bed technology: old and new.', url: 'https://portal.fis.tum.de/en/publications/simulated-moving-bed-technology-old-and-new/', type: 'Paper', supports: 'Material still, zone moving.' },
      { cite: 'Hewlett-Packard. US 9,731,515: Variable humidity drying.', url: 'https://patents.google.com/patent/US9731515', type: 'Patent', supports: 'Counter-current drying.' },
      { cite: 'Johnson, W. H. US 4,499,911: Energy efficient curing and drying system.', url: 'https://patents.google.com/patent/US4499911', type: 'Patent', supports: 'Staggered multi-chamber curing; the inventor’s fuel claim.' },
      { cite: 'MLIT Japan. Site of the Tengudani Kiln (Arita).', url: 'https://www.mlit.go.jp/tagengo-db/common/001550628.docx', type: 'Heritage', supports: 'A shared, rented chamber kiln.' },
    ],
  },
  {
    group: 'Computing and operations research',
    note: 'Standard texts. Their year, edition and pages were not checked in the research, and need checking before citation.',
    items: [
      { cite: 'Christian, B. & Griffiths, T. (2016). Algorithms to Live By. Henry Holt.', url: null, type: 'Book', supports: 'The studio’s lens.' },
      { cite: 'Kopetz, H. Real-Time Systems: Design Principles for Distributed Embedded Applications.', url: null, type: 'Book', supports: 'Time-triggered systems; cyclic executives (A4, D5).' },
      { cite: 'Cassandras, C. & Lafortune, S. Introduction to Discrete Event Systems.', url: null, type: 'Book', supports: 'State machines (D1).' },
      { cite: 'Silberschatz, A., Galvin, P. & Gagne, G. Operating System Concepts.', url: null, type: 'Book', supports: 'Scheduling and buffers (B2, A5).' },
      { cite: 'Kirkpatrick, S., Gelatt, C. & Vecchi, M. (1983). Optimization by simulated annealing. Science.', url: null, type: 'Journal', supports: 'A rejected reading (I1).' },
      { cite: 'Åström, K. & Murray, R. Feedback Systems.', url: null, type: 'Book', supports: 'Open and closed loops.' },
    ],
  },
  {
    group: 'Images',
    local: true,
    items: [
      { cite: 'Six photographs of other Hoffmann kilns and of 1865 Mangalore tiles. Wikimedia Commons, CC BY-SA 3.0 / 4.0. Kai3952, Hamelenser, ZornigeAmeise2017, Yadvendu.', url: null, type: 'Images', supports: 'The kiln page’s parts. Each source page is in kiln/assets/tour/CREDITS.md.' },
    ],
  },
];
