// ─── Localisation: the "semi-Hindi" policy ───────────────────────────────────
//
// Hindi mode is deliberately NOT a full translation. It mirrors how Hindi-medium
// schooling in India actually works, and it protects a child who switches
// language by accident.
//
// TRANSLATED (the learning content)
//   · question text, category names, topic descriptions
//   · misconception explanations and remediation — a child struggling in Hindi
//     must be told *why* in Hindi
//   · encouragement and result messages
//
// KEPT IN ENGLISH (or shown bilingually)
//   · NUMERALS — always Western Arabic (1, 2, 3), never Devanagari (१, २, ३).
//     Indian maths teaching and every board exam use Western Arabic digits,
//     including in Hindi-medium classrooms. Devanagari digits in an arithmetic
//     app would be actively confusing.
//   · NAVIGATION — Back, Home, Done, Cancel and the language control are shown
//     bilingually ("वापस · Back"). This is the escape hatch: a child who taps
//     हिन्दी by mistake can still find their way back without help.
//   · SETTINGS — board names (CBSE / ICSE), language names, and the technical
//     labels around them stay in Latin script, because that is how they appear
//     on every school document and in common speech.
//   · UNITS and symbols — km, cm, kg, %, ₹ — used as-is in Hindi-medium texts.
//
// The rule of thumb: translate what is being *learned*; keep what is being
// *navigated* recognisable in both languages.

export type Lang = 'en' | 'hi';

export const LANGUAGES: { key: Lang; label: string; nativeLabel: string }[] = [
  { key: 'en', label: 'English', nativeLabel: 'English' },
  { key: 'hi', label: 'Hindi',   nativeLabel: 'हिन्दी' },
];

type Dict = Record<string, { en: string; hi: string }>;

export const S: Dict = {
  // ── App / navigation ────────────────────────────────────────────────────
  appName:          { en: 'Maths Workout',     hi: 'गणित अभ्यास' },
  tagline:          { en: 'Train your mental arithmetic every day', hi: 'हर दिन अपना गणित अभ्यास करें' },
  back:             { en: 'Back',              hi: 'वापस · Back' },
  next:             { en: 'Next',              hi: 'आगे' },
  done:             { en: 'Done',              hi: 'पूरा · Done' },
  check:            { en: 'Check',             hi: 'जाँचें' },
  cancel:           { en: 'Cancel',            hi: 'रद्द · Cancel' },
  quit:             { en: 'Quit',              hi: 'छोड़ें · Quit' },
  keepPlaying:      { en: 'Keep Playing',      hi: 'जारी रखें · Keep Playing' },

  // ── Home ────────────────────────────────────────────────────────────────
  smartPractice:    { en: 'Smart Practice',    hi: 'स्मार्ट अभ्यास' },
  smartPracticeSub: { en: 'Picks what you need · hold to choose', hi: 'आपकी ज़रूरत चुनता है · दबाकर स्वयं चुनें' },
  timesTables:      { en: 'Times\nTables',     hi: 'पहाड़े' },
  myProgress:       { en: 'My\nProgress',      hi: 'मेरी\nप्रगति' },
  todaysGoal:       { en: "Today's goal",      hi: 'आज का लक्ष्य' },
  days:             { en: 'days',              hi: 'दिन' },
  day:              { en: 'day',               hi: 'दिन' },
  classes:          { en: 'CLASSES',           hi: 'कक्षाएँ' },
  accuracyByTopic:  { en: 'ACCURACY BY TOPIC', hi: 'विषयवार सटीकता' },
  questionsAnswered:{ en: 'questions answered',hi: 'प्रश्न हल किए' },
  mistakesToReview: { en: 'mistakes to review',hi: 'गलतियाँ दोहराने के लिए' },
  mistakeToReview:  { en: 'mistake to review', hi: 'गलती दोहराने के लिए' },
  practiceToClear:  { en: 'Practice to clear them from your list', hi: 'अभ्यास करके सूची से हटाएँ' },

  // ── Board selection ─────────────────────────────────────────────────────
  selectBoard:      { en: 'Select Board',      hi: 'बोर्ड चुनें · Select Board' },
  selectBoardSub:   { en: 'Topics and difficulty follow your syllabus', hi: 'विषय और कठिनाई आपके पाठ्यक्रम अनुसार' },
  changeBoard:      { en: 'Change board',      hi: 'बोर्ड बदलें · Change board' },
  board:            { en: 'Board',             hi: 'बोर्ड · Board' },
  topicsAvailable:  { en: 'topics available',  hi: 'विषय उपलब्ध' },

  // ── Language ────────────────────────────────────────────────────────────
  language:         { en: 'Language',          hi: 'भाषा · Language' },
  selectLanguage:   { en: 'Select Language',   hi: 'भाषा चुनें · Select Language' },

  // ── Class / category / difficulty ───────────────────────────────────────
  selectClass:      { en: 'Select Class',      hi: 'कक्षा चुनें' },
  selectClassSub:   { en: 'Choose your class',  hi: 'अपनी कक्षा चुनें' },
  age:              { en: 'Age',               hi: 'आयु' },
  arithmetic:       { en: 'ARITHMETIC',        hi: 'अंकगणित' },
  curriculumTopics: { en: 'CURRICULUM TOPICS', hi: 'पाठ्यक्रम विषय' },
  setUpGame:        { en: 'Set Up Practice',   hi: 'अभ्यास सेट करें' },
  difficulty:       { en: 'DIFFICULTY',        hi: 'कठिनाई' },
  sessionType:      { en: 'SESSION TYPE',      hi: 'सत्र का प्रकार' },
  easy:             { en: 'Easy',              hi: 'आसान' },
  medium:           { en: 'Medium',            hi: 'मध्यम' },
  hard:             { en: 'Hard',              hi: 'कठिन' },
  easyDesc:         { en: 'Smaller numbers, no carrying', hi: 'छोटी संख्याएँ, हासिल नहीं' },
  mediumDesc:       { en: 'Carrying, borrowing, mid-range', hi: 'हासिल और उधार, मध्यम संख्याएँ' },
  hardDesc:         { en: 'Large numbers, full operations', hi: 'बड़ी संख्याएँ, पूर्ण संक्रियाएँ' },
  tenQuestions:     { en: '10 Questions',      hi: '10 प्रश्न' },
  twentyQuestions:  { en: '20 Questions',      hi: '20 प्रश्न' },
  blitz:            { en: '60s Blitz',         hi: '60s ब्लिट्ज़' },
  aboutMinutes:     { en: '~3 minutes',        hi: 'लगभग 3 मिनट' },
  aboutSixMinutes:  { en: '~6 minutes',        hi: 'लगभग 6 मिनट' },
  asManyAsYouCan:   { en: 'As many as you can!', hi: 'जितने हो सकें!' },
  startGame:        { en: 'Start Practice',    hi: 'अभ्यास शुरू करें' },
  startBlitz:       { en: 'Start Blitz!',      hi: 'तेज़ अभ्यास शुरू!' },
  best:             { en: 'Best',              hi: 'सर्वश्रेष्ठ' },

  // ── Game ────────────────────────────────────────────────────────────────
  leaveGame:        { en: 'Leave practice?',   hi: 'अभ्यास छोड़ें?' },
  leaveGameBody:    { en: 'Any wrong answers so far will still be saved for review.', hi: 'अब तक की गलतियाँ दोहराने के लिए सुरक्षित रहेंगी।' },
  tapAllThatApply:  { en: 'Tap all that apply, then check', hi: 'सभी सही विकल्प चुनें, फिर जाँचें' },
  greenShowsCorrect:{ en: 'Green shows every correct answer', hi: 'हरा रंग सभी सही उत्तर दिखाता है' },
  tapInOrder:       { en: 'Tap in order',      hi: 'क्रम से चुनें' },
  smallestFirst:    { en: 'smallest first',    hi: 'छोटा पहले' },
  largestFirst:     { en: 'largest first',     hi: 'बड़ा पहले' },
  yourOrder:        { en: 'Your order — green means correctly placed', hi: 'आपका क्रम — हरा यानी सही स्थान' },
  correctLabel:     { en: 'Correct:',          hi: 'सही:' },
  answerLabel:      { en: 'Answer:',           hi: 'उत्तर:' },
  allPlaced:        { en: 'All placed — tap Check', hi: 'सभी रखे गए — जाँचें दबाएँ' },

  // ── Results ─────────────────────────────────────────────────────────────
  results:          { en: 'Results',           hi: 'परिणाम' },
  correct:          { en: 'Correct',           hi: 'सही' },
  wrong:            { en: 'Wrong',             hi: 'गलत' },
  playAgain:        { en: 'Play Again',        hi: 'फिर खेलें' },
  home:             { en: 'Home',              hi: 'होम · Home' },
  newBest:          { en: 'New Best!',         hi: 'नया रिकॉर्ड!' },
  keepTraining:     { en: 'Keep Training!',    hi: 'अभ्यास जारी रखें!' },
  wellDone:         { en: 'Well done!',        hi: 'शाबाश!' },
  excellent:        { en: 'Excellent!',        hi: 'बहुत बढ़िया!' },
  reviewMistakes:   { en: 'Review Mistakes',   hi: 'गलतियाँ देखें' },

  // ── Progress ────────────────────────────────────────────────────────────
  whatToWorkOn:     { en: 'WHAT TO WORK ON',   hi: 'किस पर काम करें' },
  skillMastery:     { en: 'SKILL MASTERY',     hi: 'कौशल दक्षता' },
  overall:          { en: 'Overall',           hi: 'कुल' },
  filterByClass:    { en: 'FILTER BY CLASS',   hi: 'कक्षा अनुसार' },
  allClasses:       { en: 'All Classes',       hi: 'सभी कक्षाएँ' },
  likelyCause:      { en: 'Likely cause',      hi: 'संभावित कारण' },
  needsWorkFirst:   { en: 'needs work first',  hi: 'पहले इस पर काम करें' },
  improving:        { en: 'improving',         hi: 'सुधार हो रहा है' },
  slipping:         { en: 'slipping',          hi: 'कमज़ोर हो रहा है' },
  notStarted:       { en: 'Not started',       hi: 'शुरू नहीं हुआ' },
  yourProgress:     { en: 'GROWING',           hi: 'प्रगति' },

  // ── Timer setting (§9 M1) ───────────────────────────────────────────────
  // Navigation/settings labels stay bilingual under the semi-Hindi policy so
  // an accidental language switch is always recoverable.
  questionTimer:    { en: 'Question timer',    hi: 'प्रश्न टाइमर · Question timer' },
  timerOn:          { en: 'On',                hi: 'चालू · On' },
  timerOff:         { en: 'Off',               hi: 'बंद · Off' },
  timerAuto:        { en: 'Auto',              hi: 'स्वतः · Auto' },
  timerAutoNote:    { en: 'Off below Class 3', hi: 'कक्षा 3 से पहले बंद' },
  timerNote:        { en: 'Blitz always keeps its clock', hi: 'ब्लिट्ज़ में घड़ी हमेशा चलती है' },
};

/** Look up a UI string. Falls back to English if a Hindi value is missing. */
export function t(key: keyof typeof S | string, lang: Lang): string {
  const entry = S[key as string];
  if (!entry) return key as string;
  return (lang === 'hi' ? entry.hi : entry.en) || entry.en;
}

// ─── Numeral policy ──────────────────────────────────────────────────────────

/** Devanagari digits, kept only so we can detect and reject them. */
const DEVANAGARI_DIGITS = /[\u0966-\u096F]/;

/**
 * Format a number for display.
 *
 * Always Western Arabic, in every language. Indian maths teaching and board
 * exams use 1/2/3 even in Hindi-medium classrooms, so Devanagari digits would
 * be actively confusing in an arithmetic app.
 */
export function num(value: number | string): string {
  return String(value);
}

/** True if a string contains Devanagari digits — used by tests as a guard. */
export function hasDevanagariDigits(text: string): boolean {
  return DEVANAGARI_DIGITS.test(text);
}

/**
 * Units and symbols are never translated: Hindi-medium textbooks write
 * "5 km", "250 g", "40%" and "₹50" exactly as English ones do.
 */
export const UNITS_UNTRANSLATED = ['km', 'm', 'cm', 'mm', 'kg', 'g', 'l', 'ml', '%', '₹', '°C'];

// ─── Category names ──────────────────────────────────────────────────────────

export const CATEGORY_NAMES: Record<string, { en: string; hi: string; descEn: string; descHi: string }> = {
  addition:       { en: 'Addition',        hi: 'जोड़',            descEn: 'Adding numbers together',           descHi: 'संख्याओं को जोड़ना' },
  subtraction:    { en: 'Subtraction',     hi: 'घटाव',            descEn: 'Taking numbers away',               descHi: 'संख्याओं को घटाना' },
  multiplication: { en: 'Multiplication',  hi: 'गुणा',            descEn: 'Times tables & multiplying',        descHi: 'पहाड़े और गुणा' },
  division:       { en: 'Division',        hi: 'भाग',             descEn: 'Sharing & dividing numbers',        descHi: 'बराबर बाँटना' },
  mixed:          { en: 'Mixed Practice',  hi: 'मिश्रित अभ्यास',  descEn: 'All operations mixed together',     descHi: 'सभी संक्रियाएँ एक साथ' },
  tables:         { en: 'Times Tables',    hi: 'पहाड़े',          descEn: 'Drill a specific times table',      descHi: 'किसी एक पहाड़े का अभ्यास' },
  counting:       { en: 'Counting',        hi: 'गिनती',           descEn: 'Count objects and skip count',      descHi: 'वस्तुएँ गिनना और छलांग गिनती' },
  number_sense:   { en: 'Number Sense',    hi: 'संख्या ज्ञान',    descEn: 'Compare and order numbers',         descHi: 'संख्याओं की तुलना और क्रम' },
  shapes:         { en: 'Shapes',          hi: 'आकार',            descEn: 'Identify and measure 2D shapes',    descHi: 'आकृतियाँ पहचानना और मापना' },
  time:           { en: 'Time',            hi: 'समय',             descEn: 'Read the clock and calculate time', descHi: 'घड़ी पढ़ना और समय निकालना' },
  money:          { en: 'Money',           hi: 'पैसे',            descEn: 'Coins, notes and giving change',    descHi: 'सिक्के, नोट और बाकी पैसे' },
  place_value:    { en: 'Place Value',     hi: 'स्थानीय मान',     descEn: 'Hundreds, tens and ones',           descHi: 'सैकड़ा, दहाई और इकाई' },
  measurement:    { en: 'Measurement',     hi: 'मापन',            descEn: 'Length, mass and capacity',         descHi: 'लंबाई, भार और धारिता' },
  fractions:      { en: 'Fractions',       hi: 'भिन्न',           descEn: 'Parts of a whole number',           descHi: 'पूर्ण के भाग' },
  word_problems:  { en: 'Word Problems',   hi: 'शब्द समस्याएँ',   descEn: 'Maths in real-life situations',     descHi: 'दैनिक जीवन में गणित' },
  decimals:       { en: 'Decimals',        hi: 'दशमलव',           descEn: 'Numbers with decimal points',       descHi: 'दशमलव वाली संख्याएँ' },
  factors:        { en: 'Factors & Primes',hi: 'गुणनखंड और अभाज्य',descEn: 'Factors, primes, HCF and LCM',     descHi: 'गुणनखंड, अभाज्य, म.स. और ल.स.' },
  geometry:       { en: 'Geometry',        hi: 'ज्यामिति',        descEn: 'Area, perimeter and angles',        descHi: 'क्षेत्रफल, परिमाप और कोण' },
  percentages:    { en: 'Percentages',     hi: 'प्रतिशत',         descEn: 'Fractions of 100',                  descHi: 'सौ के भाग' },
  data:           { en: 'Data & Averages', hi: 'आँकड़े और औसत',   descEn: 'Mean, median, mode and range',      descHi: 'माध्य, माध्यिका, बहुलक और परिसर' },
  ratio:          { en: 'Ratio',           hi: 'अनुपात',          descEn: 'Comparing quantities',              descHi: 'मात्राओं की तुलना' },
  integers:       { en: 'Integers',        hi: 'पूर्णांक',        descEn: 'Positive and negative numbers',     descHi: 'धनात्मक और ऋणात्मक संख्याएँ' },
  algebra:        { en: 'Algebra',         hi: 'बीजगणित',         descEn: 'Find the unknown value',            descHi: 'अज्ञात मान ज्ञात करना' },
};

export function categoryLabel(cat: string, lang: Lang): string {
  const e = CATEGORY_NAMES[cat];
  return e ? (lang === 'hi' ? e.hi : e.en) : cat;
}

export function categoryDesc(cat: string, lang: Lang): string {
  const e = CATEGORY_NAMES[cat];
  return e ? (lang === 'hi' ? e.descHi : e.descEn) : '';
}

// ─── Question phrasing ───────────────────────────────────────────────────────
// Generators emit these keys rather than literal English, so the same question
// renders correctly in either language.

export const Q: Record<string, { en: (...a: any[]) => string; hi: (...a: any[]) => string }> = {
  howMany:        { en: (e: string) => `How many ${e}?`,                       hi: (e: string) => `कितने ${e} हैं?` },
  countBy:        { en: (s: number) => `Count by ${s}s:`,                      hi: (s: number) => `${s} की छलांग में गिनें:` },
  whichIsBigger:  { en: () => 'Which is bigger?',                              hi: () => 'कौन बड़ा है?' },
  whichIsSmaller: { en: () => 'Which is smaller?',                             hi: () => 'कौन छोटा है?' },
  whatComesAfter: { en: (n: number) => `What comes after ${n}?`,               hi: (n: number) => `${n} के बाद क्या आता है?` },
  whatComesBefore:{ en: (n: number) => `What comes before ${n}?`,              hi: (n: number) => `${n} से पहले क्या आता है?` },
  oneMoreThan:    { en: (n: number) => `What is 1 more than ${n}?`,            hi: (n: number) => `${n} से 1 अधिक क्या है?` },
  tenLessThan:    { en: (n: number) => `What is 10 less than ${n}?`,           hi: (n: number) => `${n} से 10 कम क्या है?` },
  orderSmallest:  { en: () => 'Put these in order — SMALLEST first',           hi: () => 'इन्हें क्रम में रखें — छोटा पहले' },
  orderLargest:   { en: () => 'Put these in order — LARGEST first',            hi: () => 'इन्हें क्रम में रखें — बड़ा पहले' },
  orderDecimals:  { en: () => 'Put these decimals in order — SMALLEST first',  hi: () => 'इन दशमलवों को क्रम में रखें — छोटा पहले' },
  orderFractions: { en: () => 'Put these fractions in order — SMALLEST first', hi: () => 'इन भिन्नों को क्रम में रखें — छोटा पहले' },
  tapAllFactors:  { en: (n: number) => `Tap ALL the factors of ${n}`,          hi: (n: number) => `${n} के सभी गुणनखंड चुनें` },
  tapAllPrimes:   { en: () => 'Tap ALL the prime numbers',                     hi: () => 'सभी अभाज्य संख्याएँ चुनें' },
  tapAllMultiples:{ en: (n: number) => `Tap ALL the multiples of ${n}`,        hi: (n: number) => `${n} के सभी गुणज चुनें` },
  double:         { en: (n: number) => `Double ${n} = ?`,                      hi: (n: number) => `${n} का दुगुना = ?` },
  halfOf:         { en: (n: number) => `Half of ${n} = ?`,                     hi: (n: number) => `${n} का आधा = ?` },
  findX:          { en: () => 'Find x:',                                       hi: () => 'x ज्ञात करें:' },
  howManySides:   { en: (s: string) => `How many sides does a ${s} have?`,     hi: (s: string) => `${s} में कितनी भुजाएँ हैं?` },
  howManyCorners: { en: (s: string) => `How many corners does a ${s} have?`,   hi: (s: string) => `${s} में कितने कोने हैं?` },
  isPrime:        { en: () => 'Which of these is a prime number?',             hi: () => 'इनमें से कौन अभाज्य संख्या है?' },
  isNotPrime:     { en: () => 'Which of these is NOT a prime number?',         hi: () => 'इनमें से कौन अभाज्य संख्या नहीं है?' },
  roundToWhole:   { en: (n: number) => `Round ${n} to the nearest whole number`, hi: (n: number) => `${n} को निकटतम पूर्ण संख्या तक पूर्णांकित करें` },
  percentOf:      { en: (p: number, n: number) => `${p}% of ${n} = ?`,         hi: (p: number, n: number) => `${n} का ${p}% = ?` },
  areaRect:       { en: (a: number, b: number) => `Area of a rectangle ${a} × ${b} = ?`, hi: (a: number, b: number) => `${a} × ${b} आयत का क्षेत्रफल = ?` },
  perimeterRect:  { en: (a: number, b: number) => `Perimeter of a rectangle ${a} × ${b} = ?`, hi: (a: number, b: number) => `${a} × ${b} आयत का परिमाप = ?` },
};

/** Render a question phrase in the active language. */
export function q(key: keyof typeof Q | string, lang: Lang, ...args: any[]): string {
  const entry = Q[key as string];
  if (!entry) return String(key);
  const fn = lang === 'hi' ? entry.hi : entry.en;
  return fn(...args);
}

// ─── Shape names ─────────────────────────────────────────────────────────────
export const SHAPE_NAMES: Record<string, { en: string; hi: string }> = {
  Triangle:  { en: 'Triangle',  hi: 'त्रिभुज' },
  Square:    { en: 'Square',    hi: 'वर्ग' },
  Rectangle: { en: 'Rectangle', hi: 'आयत' },
  Pentagon:  { en: 'Pentagon',  hi: 'पंचभुज' },
  Hexagon:   { en: 'Hexagon',   hi: 'षट्भुज' },
  Octagon:   { en: 'Octagon',   hi: 'अष्टभुज' },
  Circle:    { en: 'Circle',    hi: 'वृत्त' },
};

export function shapeName(name: string, lang: Lang): string {
  const e = SHAPE_NAMES[name];
  return e ? (lang === 'hi' ? e.hi : e.en) : name;
}

// ─── Indian names and contexts for word problems ─────────────────────────────
// Replaces Tom / Jane, and euros with rupees.

export const NAMES_EN = ['Aarav', 'Priya', 'Rohan', 'Ananya', 'Kabir', 'Diya', 'Meera', 'Arjun'];
export const NAMES_HI = ['आरव', 'प्रिया', 'रोहन', 'अनन्या', 'कबीर', 'दिया', 'मीरा', 'अर्जुन'];

export function names(lang: Lang): string[] {
  return lang === 'hi' ? NAMES_HI : NAMES_EN;
}

/** Rupee amount, formatted for the active language. */
export function money(amount: number): string {
  return `₹${amount}`;
}

export const ITEMS: Record<string, { en: string; hi: string }> = {
  mangoes:  { en: 'mangoes',  hi: 'आम' },
  apples:   { en: 'apples',   hi: 'सेब' },
  pencils:  { en: 'pencils',  hi: 'पेंसिलें' },
  marbles:  { en: 'marbles',  hi: 'कंचे' },
  laddoos:  { en: 'laddoos',  hi: 'लड्डू' },
  books:    { en: 'books',    hi: 'किताबें' },
  flowers:  { en: 'flowers',  hi: 'फूल' },
  chocolates:{en: 'chocolates',hi: 'चॉकलेट' },
};

export function item(key: string, lang: Lang): string {
  const e = ITEMS[key];
  return e ? (lang === 'hi' ? e.hi : e.en) : key;
}
