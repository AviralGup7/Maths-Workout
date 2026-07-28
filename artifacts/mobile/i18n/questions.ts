// ─── Question phrasebook ─────────────────────────────────────────────────────
// The generators' own words, in both languages.
//
// The defect this fixes: a Hindi-medium child met an English question stream.
// Measured before the fix, 4,642 of 9,000 sampled questions (51.6%) contained
// English words — every shapes, time, place-value, counting, geometry, data,
// factors, algebra and ratio question, plus most of money. `i18n/strings.ts`
// already had a `Q` map, but only a handful of generators consulted it and
// `generateQuestion` never even received a `lang` argument, so the dictionary
// could not be reached from the code that builds questions.
//
// SEMI-HINDI POLICY (the user's, and it is deliberate):
//   · numerals stay Western Arabic — "कक्षा 5", never "कक्षा ५"
//   · units stay Latin — km, kg, mL, %, ₹, °C
//   · algebraic letters stay Latin — x, y
//   · what is being LEARNED is translated; what is being NAVIGATED stays
//     recognisable in both scripts
// A guard test asserts no Devanagari digits ever reach a question.
//
// Every entry is a function so numbers interpolate at the right place in the
// sentence — Hindi word order is not English word order, and "How many sides
// does a Square have?" becomes "वर्ग में कितनी भुजाएँ हैं?" with the shape
// name FIRST. A template-with-placeholders approach would have produced
// grammatical nonsense.

import type { Lang } from './strings';

type P = { en: (...a: any[]) => string; hi: (...a: any[]) => string };

/**
 * Phrases used by the question generators.
 *
 * Keys are grouped by generator. Adding a question form means adding a key
 * here — the coverage guard fails a generator that emits a bare English
 * literal, so the two cannot drift apart.
 */
export const QP = {
  // ── Counting ───────────────────────────────────────────────────────────────
  howManyOf:      { en: (e: string) => `How many ${e}?`,          hi: (e: string) => `कितने ${e} हैं?` },
  countBySeq:     { en: (s: number) => `Count by ${s}s:`,         hi: (s: number) => `${s} की छलांग में गिनें:` },

  // ── Number sense ───────────────────────────────────────────────────────────
  /**
   * The estimate-first rung of the interaction ladder (docs/27 P3-08).
   * Wraps an existing question stem rather than replacing it, so the child
   * meets the same mathematics with a different demand: roughly, not exactly.
   */
  roughlyHowMuch: { en: (stem: string) => `Roughly — ${stem}`,    hi: (stem: string) => `लगभग — ${stem}` },
  whichIsBigger:  { en: () => 'Which is bigger?',                 hi: () => 'कौन बड़ा है?' },
  orderSmallest:  { en: () => 'Put in order — SMALLEST first:',   hi: () => 'क्रम में रखें — सबसे छोटा पहले:' },
  orderWhatSmall: { en: () => 'Put in order. What is the SMALLEST?', hi: () => 'क्रम में रखें। सबसे छोटा कौन है?' },
  comesAfter:     { en: (n: number) => `What comes after ${n}?`,  hi: (n: number) => `${n} के बाद क्या आता है?` },
  comesBefore:    { en: (n: number) => `What comes before ${n}?`, hi: (n: number) => `${n} से पहले क्या आता है?` },
  oneMoreThan:    { en: (n: number) => `What is 1 more than ${n}?`, hi: (n: number) => `${n} से 1 अधिक क्या है?` },
  tenLessThan:    { en: (n: number) => `What is 10 less than ${n}?`, hi: (n: number) => `${n} से 10 कम क्या है?` },

  // ── Shapes ─────────────────────────────────────────────────────────────────
  howManySides:   { en: (s: string) => `How many sides does a ${s} have?`,   hi: (s: string) => `${s} में कितनी भुजाएँ हैं?` },
  howManyCorners: { en: (s: string) => `How many corners does a ${s} have?`, hi: (s: string) => `${s} में कितने कोने हैं?` },
  howManyRightAng:{ en: (s: string) => `How many right angles does a ${s} have?`, hi: (s: string) => `${s} में कितने समकोण हैं?` },
  shapeWithSides: { en: (n: string) => `A shape with ${n} sides is a ___?`,  hi: (n: string) => `${n} भुजाओं वाली आकृति कौन-सी है?` },
  whatShapeIs:    { en: (o: string) => `What shape is ${o}?`,                hi: (o: string) => `${o} किस आकृति का है?` },
  noSides:        { en: () => 'no',                                          hi: () => 'शून्य' },
  perimeterOfWithSide: { en: (t: string, s: number) => `What is the ${t} with side ${s}?`, hi: (t: string, s: number) => `भुजा ${s} वाले ${t} = ?` },
  periSquare:     { en: () => 'perimeter of a square',              hi: () => 'वर्ग का परिमाप' },
  periEquiTri:    { en: () => 'perimeter of an equilateral triangle', hi: () => 'समबाहु त्रिभुज का परिमाप' },

  // ── Time ───────────────────────────────────────────────────────────────────
  minsInHour:     { en: () => 'How many minutes are in 1 hour?',    hi: () => '1 घंटे में कितने मिनट होते हैं?' },
  hoursInDay:     { en: () => 'How many hours are in 1 day?',       hi: () => '1 दिन में कितने घंटे होते हैं?' },
  daysInWeek:     { en: () => 'How many days are in 1 week?',       hi: () => '1 सप्ताह में कितने दिन होते हैं?' },
  monthsInYear:   { en: () => 'How many months are in 1 year?',     hi: () => '1 वर्ष में कितने महीने होते हैं?' },
  daysInFeb:      { en: () => 'How many days are in February (non-leap year)?', hi: () => 'फरवरी में कितने दिन होते हैं (सामान्य वर्ष)?' },
  daysInWeeks:    { en: (w: number) => `How many days are in ${w} weeks?`, hi: (w: number) => `${w} सप्ताह में कितने दिन होते हैं?` },
  hoursInDays:    { en: (d: number) => `How many hours in ${d} days?`,     hi: (d: number) => `${d} दिनों में कितने घंटे होते हैं?` },
  minsInHours:    { en: (n: number) => `How many minutes in ${n} hours?`,  hi: (n: number) => `${n} घंटों में कितने मिनट होते हैं?` },
  secsInMins:     { en: (n: number) => `How many seconds in ${n} minutes?`, hi: (n: number) => `${n} मिनट में कितने सेकंड होते हैं?` },
  oclockUntil:    { en: (n: number) => `${n} o'clock — how many hours until ${n + 1} o'clock?`, hi: (n: number) => `${n} बजे हैं — ${n + 1} बजे तक कितने घंटे हैं?` },
  itIsOclockIn:   { en: (h: number, on: number) => `It is ${h} o'clock.\nWhat time will it be in ${on} hour${on > 1 ? 's' : ''}?`, hi: (h: number, on: number) => `अभी ${h} बजे हैं।\n${on} घंटे बाद क्या समय होगा?` },
  minsPastHour:   { en: (m: number) => `It is ${m} minutes past the hour.\nHow many minutes until the next hour?`, hi: (m: number) => `घंटे के ${m} मिनट बीत चुके हैं।\nअगले घंटे तक कितने मिनट बचे हैं?` },
  dayAfter:       { en: (d: string) => `What day comes straight after ${d}?`, hi: (d: string) => `${d} के ठीक बाद कौन-सा दिन आता है?` },
  monthAfter:     { en: (m: string) => `Which month comes straight after ${m}?`, hi: (m: string) => `${m} के ठीक बाद कौन-सा महीना आता है?` },
  lessonStarts:   { en: (h: number, a: number) => `A lesson starts at ${h}:00 and lasts ${a} hour${a > 1 ? 's' : ''}.\nWhat hour does it end?`, hi: (h: number, a: number) => `एक कक्षा ${h}:00 बजे शुरू होती है और ${a} घंटे चलती है।\nयह किस बजे समाप्त होगी?` },
  schoolStarts:   { en: (h: number, a: number) => `School starts at ${h}:00 and lasts ${a} hours.\nWhat hour does it finish?`, hi: (h: number, a: number) => `विद्यालय ${h}:00 बजे शुरू होता है और ${a} घंटे चलता है।\nयह किस बजे समाप्त होगा?` },
  gameLasts:      { en: (m: number) => `A game lasts ${m} minutes and starts on the hour.\nHow many minutes before the next hour does it end?`, hi: (m: number) => `एक खेल ठीक घंटे पर शुरू होकर ${m} मिनट चलता है।\nयह अगले घंटे से कितने मिनट पहले समाप्त होगा?` },
  busLeaves:      { en: (m: number) => `A bus leaves ${m} minutes past the hour.\nHow many minutes is that before the next hour?`, hi: (m: number) => `एक बस घंटे के ${m} मिनट बाद चलती है।\nयह अगले घंटे से कितने मिनट पहले है?` },
  filmStarts:     { en: (h: number, m: number) => `A film starts at ${h}:00 and is ${m} minutes long.\nHow many minutes past ${h} does it end?`, hi: (h: number, m: number) => `एक फ़िल्म ${h}:00 बजे शुरू होती है और ${m} मिनट लंबी है।\nयह ${h} बजे के कितने मिनट बाद समाप्त होगी?` },
  hoursFromTo:    { en: (a: number, b: number) => `How many hours from ${a}:00 to ${b}:00?`, hi: (a: number, b: number) => `${a}:00 से ${b}:00 तक कितने घंटे हैं?` },
  weeksEqDays:    { en: (n: number) => `${n} weeks = ___ days?`,    hi: (n: number) => `${n} सप्ताह = ___ दिन?` },
  clockReads:     { en: (l: string, h: number) => `The clock reads ${l} ${h}.\nHow many minutes past ${h}:00 is that?`, hi: (l: string, h: number) => `घड़ी में ${h} ${l} दिख रहा है।\nयह ${h}:00 से कितने मिनट बाद है?` },
  quarterPast:    { en: () => 'quarter past',                       hi: () => 'बजकर सवा' },
  halfPast:       { en: () => 'half past',                          hi: () => 'बजकर साढ़े' },
  quarterTo:      { en: () => 'quarter to',                         hi: () => 'बजने में पौन' },

  // ── Money ──────────────────────────────────────────────────────────────────
  haveSpendLeft:  { en: (a: number, b: number) => `I have ${a}c and spend ${b}c.\nHow much is left?`, hi: (a: number, b: number) => `मेरे पास ${a}c हैं और मैं ${b}c खर्च करता हूँ।\nकितने बचे?` },
  coinsAltogether:{ en: (n: number, c: number) => `${n} × ${c}c coins.\nHow much altogether?`, hi: (n: number, c: number) => `${n} × ${c}c के सिक्के।\nकुल कितने हुए?` },
  priceIPayChange:{ en: (p: number, y: number) => `Price is ${p}c.\nI pay ${y}c. Change?`, hi: (p: number, y: number) => `कीमत ${p}c है।\nमैं ${y}c देता हूँ। शेष कितना?` },
  itemsCostEach:  { en: (a: number, p: number) => `${a} items cost ${p}c each.\nTotal cost?`, hi: (a: number, p: number) => `${a} वस्तुएँ, हर एक ${p}c की।\nकुल कीमत?` },
  booksCostEach:  { en: (a: number, p: number) => `${a} books cost ${p}c each.\nTotal cost?`, hi: (a: number, p: number) => `${a} किताबें, हर एक ${p}c की।\nकुल कीमत?` },
  costsPayRupee:  { en: (p: number) => `An item costs ${p}c.\nI pay ₹1.00. Change = ___c?`, hi: (p: number) => `एक वस्तु की कीमत ${p}c है।\nमैं ₹1.00 देता हूँ। शेष = ___c?` },
  costsPayChange: { en: (p: number, y: number) => `An item costs ${p}c.\nI pay ₹${y}. Change = ___c?`, hi: (p: number, y: number) => `एक वस्तु की कीमत ${p}c है।\nमैं ₹${y} देता हूँ। शेष = ___c?` },
  booksTotalOne:  { en: (a: number, t: string) => `${a} books cost ₹${t} in total.\nOne book costs ___c?`, hi: (a: number, t: string) => `${a} किताबों की कुल कीमत ₹${t} है।\nएक किताब की कीमत ___c?` },

  // ── Place value ────────────────────────────────────────────────────────────
  tensDigitIn:    { en: (n: number) => `What is the TENS digit in ${n}?`,  hi: (n: number) => `${n} में दहाई का अंक क्या है?` },
  unitsDigitIn:   { en: (n: number) => `What is the UNITS digit in ${n}?`, hi: (n: number) => `${n} में इकाई का अंक क्या है?` },
  tensAndUnits:   { en: (t: number, u: number) => `${t} tens and ${u} units = ?`, hi: (t: number, u: number) => `${t} दहाई और ${u} इकाई = ?` },
  hundredsDigitIn:{ en: (n: number) => `What digit is in the HUNDREDS place in ${n}?`, hi: (n: number) => `${n} में सैकड़े के स्थान पर कौन-सा अंक है?` },
  valueHundreds:  { en: (n: number) => `What is the value of the hundreds digit in ${n}?`, hi: (n: number) => `${n} में सैकड़े के अंक का मान क्या है?` },
  howManyTensIn:  { en: (n: number) => `How many tens are in ${n}?`,       hi: (n: number) => `${n} में कितनी दहाइयाँ हैं?` },
  hundredsTensOnes:{ en: (h: number, t: number, o: number) => `${h} hundreds, ${t} tens and ${o} ones = ?`, hi: (h: number, t: number, o: number) => `${h} सैकड़ा, ${t} दहाई और ${o} इकाई = ?` },
  valueOfDigitIn: { en: (d: number, n: number) => `What is the value of ${d} in the number ${n}?`, hi: (d: number, n: number) => `संख्या ${n} में ${d} का मान क्या है?` },
  thousandsDigitIn:{ en: (n: number) => `What is the THOUSANDS digit in ${n}?`, hi: (n: number) => `${n} में हज़ार का अंक क्या है?` },
  thHTO:          { en: (th: number, h: number, t: number, o: number) => `${th} thousands, ${h} hundreds, ${t} tens, ${o} ones = ?`, hi: (th: number, h: number, t: number, o: number) => `${th} हज़ार, ${h} सैकड़ा, ${t} दहाई, ${o} इकाई = ?` },

  // ── Fractions ──────────────────────────────────────────────────────────────
  glyphOf:        { en: (g: string, w: number) => `${g} of ${w} = ?`,     hi: (g: string, w: number) => `${w} का ${g} = ?` },
  fracOfWhole:    { en: (n: number, d: number, w: number) => `${n}/${d} of ${w} = ?`, hi: (n: number, d: number, w: number) => `${w} का ${n}/${d} = ?` },
  completeSum:    { en: (d: number) => `Complete: 1/${d} + 1/${d} = ?/${d}`, hi: (d: number) => `पूरा करें: 1/${d} + 1/${d} = ?/${d}` },
  simplifyTo:     { en: (n: number, d: number) => `Simplify ${n}/${d} = 1/?`, hi: (n: number, d: number) => `${n}/${d} को सरल करें = 1/?` },
  hcfSimplify:    { en: (a: number, b: number) => `What is the HCF (simplify):\n${a}/${b}? (HCF = ?)`, hi: (a: number, b: number) => `म.स. क्या है (सरल करें):\n${a}/${b}? (म.स. = ?)` },
  wholeAndFrac:   { en: (n: number, d: number, w: number) => `What is ${n} whole and 1/${d} of ${w}?\n(${n} × ${w}) + (${w}/${d}) = ?`, hi: (n: number, d: number, w: number) => `${n} पूर्ण और ${w} का 1/${d} कितना है?\n(${n} × ${w}) + (${w}/${d}) = ?` },

  // ── Decimals ───────────────────────────────────────────────────────────────
  roundToWhole:   { en: (n: number | string) => `Round ${n} to the nearest whole number`, hi: (n: number | string) => `${n} को निकटतम पूर्ण संख्या तक पूर्णांकित करें` },
  roundTo1dp:     { en: (n: number | string) => `Round ${n} to 1 decimal place`, hi: (n: number | string) => `${n} को 1 दशमलव स्थान तक पूर्णांकित करें` },

  // ── Factors & primes ───────────────────────────────────────────────────────
  howManyFactors: { en: (n: number) => `How many factors does ${n} have?`, hi: (n: number) => `${n} के कितने गुणनखंड हैं?` },
  whichIsPrime:   { en: () => 'Which of these is a prime number?\n(a prime has exactly 2 factors)', hi: () => 'इनमें से कौन अभाज्य संख्या है?\n(अभाज्य के ठीक 2 गुणनखंड होते हैं)' },
  whichNotPrime:  { en: () => 'Which of these is NOT a prime number?', hi: () => 'इनमें से कौन अभाज्य संख्या नहीं है?' },
  isFactorOf:     { en: (d: number, n: number) => `Is ${d} a factor of ${n}?`, hi: (d: number, n: number) => `क्या ${d}, ${n} का गुणनखंड है?` },
  largestFactor:  { en: (n: number) => `What is the largest factor of ${n} that is smaller than ${n}?`, hi: (n: number) => `${n} का सबसे बड़ा गुणनखंड जो ${n} से छोटा हो?` },
  smallestPrimeFactor: { en: (n: number) => `What is the smallest prime factor of ${n}?`, hi: (n: number) => `${n} का सबसे छोटा अभाज्य गुणनखंड क्या है?` },
  multipleAfter:  { en: (m: number, v: number) => `Which multiple of ${m} comes straight after ${v}?`, hi: (m: number, v: number) => `${v} के ठीक बाद ${m} का कौन-सा गुणज आता है?` },
  hcfOf:          { en: (a: number, b: number) => `What is the HCF of ${a} and ${b}?`, hi: (a: number, b: number) => `${a} और ${b} का म.स. क्या है?` },
  lcmOf:          { en: (a: number, b: number) => `What is the LCM of ${a} and ${b}?`, hi: (a: number, b: number) => `${a} और ${b} का ल.स. क्या है?` },
  hcfEq:          { en: (a: number, b: number) => `HCF of ${a} and ${b} = ?`, hi: (a: number, b: number) => `${a} और ${b} का म.स. = ?` },
  lcmEq:          { en: (a: number, b: number) => `LCM of ${a} and ${b} = ?`, hi: (a: number, b: number) => `${a} और ${b} का ल.स. = ?` },
  nthPrime:       { en: (i: number) => `What is the ${i}th prime number?`, hi: (i: number) => `${i}वीं अभाज्य संख्या कौन-सी है?` },
  yes:            { en: () => 'Yes',                                hi: () => 'हाँ' },
  no:             { en: () => 'No',                                 hi: () => 'नहीं' },

  // ── Geometry ───────────────────────────────────────────────────────────────
  areaSquareSide: { en: (s: number) => `Area of a square with side ${s} = ?`, hi: (s: number) => `भुजा ${s} वाले वर्ग का क्षेत्रफल = ?` },
  periSquareSide: { en: (s: number) => `Perimeter of a square with side ${s} = ?`, hi: (s: number) => `भुजा ${s} वाले वर्ग का परिमाप = ?` },
  areaRect:       { en: (a: number, b: number) => `Area of a rectangle ${a} × ${b} = ?`, hi: (a: number, b: number) => `${a} × ${b} आयत का क्षेत्रफल = ?` },
  periRect:       { en: (a: number, b: number) => `Perimeter of a rectangle ${a} × ${b} = ?`, hi: (a: number, b: number) => `${a} × ${b} आयत का परिमाप = ?` },
  areaTriangle:   { en: (b: number, h: number) => `Area of triangle, base ${b} cm, height ${h} cm = ?`, hi: (b: number, h: number) => `त्रिभुज का क्षेत्रफल, आधार ${b} cm, ऊँचाई ${h} cm = ?` },
  volumeCube:     { en: (s: number) => `Volume of a cube with side ${s} cm = ?`, hi: (s: number) => `भुजा ${s} cm वाले घन का आयतन = ?` },
  degRightAngle:  { en: () => 'How many degrees in a right angle?',  hi: () => 'समकोण में कितनी डिग्री होती हैं?' },
  degStraightLine:{ en: () => 'How many degrees in a straight line?', hi: () => 'सरल रेखा में कितनी डिग्री होती हैं?' },
  triAnglesSum:   { en: () => 'Angles in a triangle add up to ___°?', hi: () => 'त्रिभुज के कोणों का योग ___° होता है?' },
  quadAnglesSum:  { en: () => 'Angles in a quadrilateral add up to ___°?', hi: () => 'चतुर्भुज के कोणों का योग ___° होता है?' },
  fullTurnDeg:    { en: () => 'Angles on a full turn (circle) = ___°?', hi: () => 'पूरे चक्कर (वृत्त) के कोण = ___°?' },
  twoAnglesRight: { en: (a: number) => `Two angles make a right angle.\nOne is ${a}°. What is the other?`, hi: (a: number) => `दो कोण मिलकर समकोण बनाते हैं।\nएक ${a}° है। दूसरा क्या है?` },
  twoAnglesLine:  { en: (a: number) => `Two angles sit on a straight line.\nOne is ${a}°. What is the other?`, hi: (a: number) => `दो कोण एक सरल रेखा पर हैं।\nएक ${a}° है। दूसरा क्या है?` },
  twoAnglesPoint: { en: (a: number) => `Two angles meet at a point on a full turn.\nOne is ${a}°. What is the other?`, hi: (a: number) => `पूरे चक्कर में एक बिंदु पर दो कोण मिलते हैं।\nएक ${a}° है। दूसरा क्या है?` },
  quadFourth:     { en: (a: number, b: number, c: number) => `Three angles of a quadrilateral are ${a}°, ${b}° and ${c}°.\nThe fourth angle = ?`, hi: (a: number, b: number, c: number) => `चतुर्भुज के तीन कोण ${a}°, ${b}° और ${c}° हैं।\nचौथा कोण = ?` },
  squarePeriSide: { en: (p: number) => `A square has perimeter ${p}.\nHow long is each side?`, hi: (p: number) => `एक वर्ग का परिमाप ${p} है।\nहर भुजा कितनी लंबी है?` },
  squareAreaSide: { en: (a: number) => `A square has area ${a}.\nHow long is each side?`, hi: (a: number) => `एक वर्ग का क्षेत्रफल ${a} है।\nहर भुजा कितनी लंबी है?` },
  rectLongWide:   { en: (l: number, w: number) => `A rectangle is ${l} long and ${w} wide.\nHow much longer is it than it is wide?`, hi: (l: number, w: number) => `एक आयत ${l} लंबा और ${w} चौड़ा है।\nयह चौड़ाई से कितना अधिक लंबा है?` },

  areaTriangleBH: { en: (b: number, h: number) => `Area of a triangle, base ${b}, height ${h}:\n(½ × base × height) = ?`, hi: (b: number, h: number) => `त्रिभुज का क्षेत्रफल, आधार ${b}, ऊँचाई ${h}:\n(½ × आधार × ऊँचाई) = ?` },
  rectAreaWidthLen:{ en: (a: number, w: number) => `A rectangle has area ${a} and width ${w}.\nWhat is its length?`, hi: (a: number, w: number) => `एक आयत का क्षेत्रफल ${a} और चौड़ाई ${w} है।\nइसकी लंबाई क्या है?` },
  triThirdAngle:  { en: (a: number, b: number) => `Two angles of a triangle are ${a}° and ${b}°.\nThe third angle = ?`, hi: (a: number, b: number) => `त्रिभुज के दो कोण ${a}° और ${b}° हैं।\nतीसरा कोण = ?` },

  // ── Percentages ────────────────────────────────────────────────────────────
  percentOf:      { en: (p: number, n: number) => `${p}% of ${n} = ?`, hi: (p: number, n: number) => `${n} का ${p}% = ?` },
  increaseBy:     { en: (n: number, p: number) => `Increase ${n} by ${p}% = ?`, hi: (n: number, p: number) => `${n} को ${p}% बढ़ाएँ = ?` },
  decreaseBy:     { en: (n: number, p: number) => `Decrease ${n} by ${p}% = ?`, hi: (n: number, p: number) => `${n} को ${p}% घटाएँ = ?` },
  whatPercentOf:  { en: (a: number, b: number) => `${a} is what % of ${b}?`, hi: (a: number, b: number) => `${a}, ${b} का कितने % है?` },

  // ── Data ───────────────────────────────────────────────────────────────────
  findMean:       { en: (l: string) => `Find the mean of:\n${l}`,   hi: (l: string) => `इनका माध्य ज्ञात करें:\n${l}` },
  findMedian:     { en: (l: string) => `Find the median of:\n${l}`, hi: (l: string) => `इनका माध्यिका ज्ञात करें:\n${l}` },
  findMode:       { en: (l: string) => `Find the mode of:\n${l}`,   hi: (l: string) => `इनका बहुलक ज्ञात करें:\n${l}` },
  findRange:      { en: (l: string) => `Find the range of:\n${l}`,  hi: (l: string) => `इनका परिसर ज्ञात करें:\n${l}` },

  // ── Ratio ──────────────────────────────────────────────────────────────────
  ratioSmaller:   { en: (a: number, b: number, t: number) => `Ratio ${a}:${b}, total = ${t}.\nSmaller part = ?`, hi: (a: number, b: number, t: number) => `अनुपात ${a}:${b}, कुल = ${t}।\nछोटा भाग = ?` },
  ratioLarger:    { en: (a: number, b: number, t: number) => `Ratio ${a}:${b}, total = ${t}.\nLarger part = ?`, hi: (a: number, b: number, t: number) => `अनुपात ${a}:${b}, कुल = ${t}।\nबड़ा भाग = ?` },
  simplifyRatio:  { en: (a: number, b: number) => `Simplify the ratio ${a}:${b}\nFirst number = ?`, hi: (a: number, b: number) => `अनुपात ${a}:${b} को सरल करें\nपहली संख्या = ?` },
  shareInRatio:   { en: (t: number, a: number, b: number) => `Share ₹${t} in the ratio ${a}:${b}.\nHow much is the larger share?`, hi: (t: number, a: number, b: number) => `₹${t} को ${a}:${b} के अनुपात में बाँटें।\nबड़ा हिस्सा कितना है?` },

  // ── Integers ───────────────────────────────────────────────────────────────
  whichIsColder:  { en: (a: number, b: number) => `Which is colder: ${a}°C or ${b}°C?`, hi: (a: number, b: number) => `कौन अधिक ठंडा है: ${a}°C या ${b}°C?` },
  tempRises:      { en: (a: number, r: number) => `Temperature is ${a}°C and rises ${r}°C.\nNew temperature?`, hi: (a: number, r: number) => `तापमान ${a}°C है और ${r}°C बढ़ता है।\nनया तापमान?` },
  tempFalls:      { en: (a: number, r: number) => `Temperature is ${a}°C and falls ${r}°C.\nNew temperature?`, hi: (a: number, r: number) => `तापमान ${a}°C है और ${r}°C गिरता है।\nनया तापमान?` },

  // ── Algebra ────────────────────────────────────────────────────────────────
  findX:          { en: () => 'Find x:',                            hi: () => 'x ज्ञात करें:' },

  // ── Percentages (extra forms) ──────────────────────────────────────────────
  whatPercentIs:  { en: (n: number, k: number) => `What % of ${n} is ${k}?`, hi: (n: number, k: number) => `${k}, ${n} का कितने % है?` },

  // ── Data (extra forms) ─────────────────────────────────────────────────────
  whatIsModeOf:   { en: (l: string) => `What is the mode of:\n${l}`, hi: (l: string) => `इनका बहुलक क्या है:\n${l}` },
  meanOfEq:       { en: (l: string) => `Mean of ${l} = ?`,          hi: (l: string) => `${l} का माध्य = ?` },
  medianOf:       { en: (l: string) => `Median of:\n${l}`,          hi: (l: string) => `इनकी माध्यिका:\n${l}` },

  // ── Ratio (extra forms) ────────────────────────────────────────────────────
  simplifyRatioIs:{ en: (a: number, b: number, x: number) => `Simplify ${a}:${b}.\nThe simplified ratio is ${x}:?`, hi: (a: number, b: number, x: number) => `${a}:${b} को सरल करें।\nसरल अनुपात ${x}:? है` },
  pensCost:       { en: (n: number, t: number, k: number) => `${n} pens cost ₹${t}.\nHow much do ${k} pens cost?`, hi: (n: number, t: number, k: number) => `${n} पेन की कीमत ₹${t} है।\n${k} पेन की कीमत कितनी होगी?` },
  divideInRatio:  { en: (t: number, a: number, b: number) => `Divide ${t} in ratio ${a}:${b}.\nLarger share = ?`, hi: (t: number, a: number, b: number) => `${t} को ${a}:${b} के अनुपात में बाँटें।\nबड़ा हिस्सा = ?` },
  shareRupeeRatio:{ en: (t: number, a: number, b: number) => `Share ₹${t} in ratio ${a}:${b}.\nLarger share = ₹?`, hi: (t: number, a: number, b: number) => `₹${t} को ${a}:${b} के अनुपात में बाँटें।\nबड़ा हिस्सा = ₹?` },
  scaleMapReal:   { en: (s: number, m: number) => `Scale 1:${s}. Map length = ${m} cm.\nReal length = ___ cm?`, hi: (s: number, m: number) => `पैमाना 1:${s}। मानचित्र पर लंबाई = ${m} cm।\nवास्तविक लंबाई = ___ cm?` },

  // ── Integers (extra forms) ─────────────────────────────────────────────────
  absoluteValue:  { en: (n: number) => `|−${n}| = ?  (absolute value)`, hi: (n: number) => `|−${n}| = ?  (निरपेक्ष मान)` },
  whichColderNeg: { en: (a: number, b: number) => `Which is colder: −${a}°C or −${b}°C?`, hi: (a: number, b: number) => `कौन अधिक ठंडा है: −${a}°C या −${b}°C?` },

  // ── Algebra (extra forms) ──────────────────────────────────────────────────
  divHint:        { en: (a: number) => `(Hint: x = ? × ${a})`,      hi: (a: number) => `(संकेत: x = ? × ${a})` },
  xPositive:      { en: () => '(x is positive)',                    hi: () => '(x धनात्मक है)' },

  // ── Measurement ────────────────────────────────────────────────────────────
  // Unit symbols stay Latin on both sides — policy, and they are what a child
  // will see on a ruler and a packet.
  convert:        { en: (n: number, from: string, to: string) => `${n} ${from} = ___ ${to}?`, hi: (n: number, from: string, to: string) => `${n} ${from} = ___ ${to}?` },
} satisfies Record<string, P>;

export type QPKey = keyof typeof QP;

/**
 * Render a question phrase in the active language.
 *
 * Typed against `QP`, so a mistyped key is a compile error rather than a
 * silently English question — which is exactly how the previous `q()` helper
 * let phrases drift out of the dictionary unnoticed.
 */
export function qp<K extends QPKey>(
  key: K, lang: Lang, ...args: Parameters<(typeof QP)[K]['en']>
): string {
  const entry = QP[key] as P;
  return (lang === 'hi' ? entry.hi : entry.en)(...args);
}

// ─── Localised word lists ────────────────────────────────────────────────────

export const DAY_NAMES = {
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  hi: ['सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार', 'रविवार'],
};

export const MONTH_NAMES = {
  en: ['January', 'February', 'March', 'April', 'May', 'June',
       'July', 'August', 'September', 'October', 'November', 'December'],
  hi: ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
       'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
};

/** Everyday objects used to ask "what shape is …?". */
export const SHAPE_OBJECTS: Record<string, { en: string[]; hi: string[] }> = {
  Circle:    { en: ['a wheel', 'a chapati', 'a coin', 'a clock face'],
               hi: ['पहिया', 'चपाती', 'सिक्का', 'घड़ी का चेहरा'] },
  Square:    { en: ['a carrom board', 'a chessboard', 'a window pane'],
               hi: ['कैरम बोर्ड', 'शतरंज की बिसात', 'खिड़की का शीशा'] },
  Rectangle: { en: ['a door', 'a book cover', 'a cricket pitch', 'a blackboard'],
               hi: ['दरवाज़ा', 'किताब का आवरण', 'क्रिकेट पिच', 'श्यामपट'] },
  Triangle:  { en: ['a samosa', 'a slice of pizza', 'a road sign'],
               hi: ['समोसा', 'पिज़्ज़ा का टुकड़ा', 'सड़क का चिह्न'] },
  Pentagon:  { en: ['a home plate', 'a football patch'],
               hi: ['होम प्लेट', 'फुटबॉल का टुकड़ा'] },
  Hexagon:   { en: ['a honeycomb cell', 'a pencil end'],
               hi: ['मधुमक्खी के छत्ते का खाना', 'पेंसिल का सिरा'] },
  // "STOP" stays Latin: that is what the sign says on an Indian road, and
  // translating it would make the question harder to recognise, not easier.
  Octagon:   { en: ['a STOP sign'], hi: ['STOP का चिह्न'] },
};

export function dayNames(lang: Lang): string[] {
  return lang === 'hi' ? DAY_NAMES.hi : DAY_NAMES.en;
}

export function monthNames(lang: Lang): string[] {
  return lang === 'hi' ? MONTH_NAMES.hi : MONTH_NAMES.en;
}

export function shapeObjects(shape: string, lang: Lang): string[] | undefined {
  const e = SHAPE_OBJECTS[shape];
  if (!e) return undefined;
  return lang === 'hi' ? e.hi : e.en;
}
