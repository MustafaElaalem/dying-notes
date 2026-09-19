// Golden-set evaluation for JEV note routing (docs/jev-plan.md).
// Usage: node scripts/eval-jev.mjs [workerUrl]   (default: the deployed worker)
// Grades note_kind routing against 40 hand-labeled utterances (10 per class),
// and reports language-detection accuracy on the non-filler cases.

const WORKER = (process.argv[2] || "https://dying-notes-api.mostafa-elaalem.workers.dev").replace(/\/+$/, "");
const CONF_GATE = 0.5;

// [expected_kind, transcript, expected_language_or_null]
const GOLDEN = [
  // ---- task_list (10) ----
  ["task_list", "خاصني نشري الخبز والحليب، ونعيط على بابا", "ar"],
  ["task_list", "أريد إنشاء مهام لبكرة: أتصل بالطبيب، أجدد جواز السفر، أشتري هدية لسارة", "ar"],
  ["task_list", "remind me to call the dentist and renew my passport", "en"],
  ["task_list", "shopping list: eggs, milk, bread, and coffee filters", "en"],
  ["task_list", "ذكرني أن أرد على الإيميلات غداً صباحاً", "ar"],
  ["task_list", "I need to book flights, reserve the hotel, and print the tickets before Friday", "en"],
  ["task_list", "خاصني نشري bread والحليب من المحل", "mixed"],
  ["task_list", "لا تنسى: تدفع فاتورة الكهرباء، وتصلح السيارة", "ar"],
  ["task_list", "todo for today: water the plants, feed the cat, fix the leaking tap", "en"],
  ["task_list", "بغيت ندير ليستة ديال الحوايج: ملابس، فرشاة، شامبوان، وملات", "ar"],
  // ---- note_with_tasks (10) ----
  ["note_with_tasks", "الحديقة كانت زوينة بزاف اليوم، الدخلة عشرين درهم، و خاصني نشري الخبز قبل الجمعة", "ar"],
  ["note_with_tasks", "Great meeting with the team today, everyone is aligned. I still owe Sam the budget spreadsheet by Monday.", "en"],
  ["note_with_tasks", "المقهى زوين والقهوة رخيصة، ولكن خاصني نجيب الحاسوب باش نخدم من там", "ar"],
  ["note_with_tasks", "Dinner at Mom's was lovely. Note to self: ask her for the lasagna recipe, and fix the porch light before winter.", "en"],
  ["note_with_tasks", "درس اليوم كان صعب، خاصني نراجع الفصل الثالث قبل الامتحان", "ar"],
  ["note_with_tasks", "The apartment viewing went well — it's bright and quiet. Need to send the landlord my documents this week.", "en"],
  ["note_with_tasks", "السينما الجديدة زوينة، الكراسي مريحين، وناسي نشري البوبكورن قبل الفيلم", "ar"],
  ["note_with_tasks", "قرأت مقالاً شيقاً عن التركيز، و قررت أن أطبق تقنية البومودورو غداً", "ar"],
  ["note_with_tasks", "Book club was fun — three people showed up. Next time I'm bringing the snacks I promised.", "en"],
  ["note_with_tasks", "السيارة تحتاج صيانة قريباً، الميكانيكي قال كل عشرين ألف كيلومتر، و خاصني نحدد موعد", "ar"],
  // ---- pure_note (10) ----
  ["pure_note", "The wifi password at the cafe downstairs is solstice2024, it changes every October apparently", "en"],
  ["pure_note", "الحديقة كانت زوينة بزاف اليوم، الدخلة غير عشرين درهم للشخص وتقضينا وقت ممتاز", "ar"],
  ["pure_note", "Interesting fact: octopuses have three hearts", "en"],
  ["pure_note", "الطقس اليوم كان دافئ رغم أن الوقت شتاء", "ar"],
  ["pure_note", "Idea for the novel: a lighthouse keeper who receives letters from the future", "en"],
  ["pure_note", "بابا قال أن الجد اشترى هذا البيت سنة 1962", "ar"],
  ["pure_note", "Sarah recommended the book Project Hail Mary — sounds fun", "en"],
  ["pure_note", "المقهى الجديد في الزنقة الرئيسية، يفتح من السابعة صباحاً", "ar"],
  ["pure_note", "The office moved to the fourth floor last month", "en"],
  ["pure_note", "قرأت أن القهوة بالحليب تفقد نكهتها بعد ربع ساعة", "ar"],
  // ---- not_a_note (10) ----
  ["not_a_note", "اه اه يعني", null],
  ["not_a_note", "ههههه", null],
  ["not_a_note", "um uh like you know", null],
  ["not_a_note", "test test 123", null],
  ["not_a_note", "...", null],
  ["not_a_note", "اممم", null],
  ["not_a_note", "hello hello", null],
  ["not_a_note", "ماذا؟", null],
  ["not_a_note", "okay okay okay", null],
  ["not_a_note", "la la la", null]
];

async function classify(transcript, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${WORKER}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://mustafaelaalem.github.io" },
        body: JSON.stringify({ transcript, input_mode: "voice" }),
        signal: AbortSignal.timeout(30_000)
      });
      if (!res.ok) return { error: `HTTP ${res.status}` };
      return await res.json();
    } catch (e) {
      if (i === tries - 1) return { error: String(e.message || e).slice(0, 80) };
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

const rows = [];
let kindCorrect = 0, langScored = 0, langCorrect = 0, gatedWouldFallback = 0, apiErrors = 0;

for (const [expected, transcript, expectedLang] of GOLDEN) {
  const j = await classify(transcript);
  if (j.error) { apiErrors++; rows.push({ expected, transcript: transcript.slice(0, 40), error: j.error }); continue; }
  const kind = j.answers.note_kind;
  const got = kind.choice;
  const conf = kind.confidence;
  const routed = conf >= CONF_GATE ? got : "FALLBACK";
  const ok = got === expected;
  if (ok) kindCorrect++;
  if (expectedLang) {
    langScored++;
    if (j.answers.language.choice === expectedLang) langCorrect++;
  }
  if (!ok && routed !== expected) gatedWouldFallback++;
  rows.push({ expected, got, conf: conf.toFixed(2), routed, ok, lang: j.answers.language.choice, transcript: transcript.slice(0, 38) });
}

console.log("\n===== per-case =====");
for (const r of rows) {
  console.log(
    (r.error ? "ERROR  " : r.ok ? "PASS   " : "FAIL   ") +
    `exp=${(r.expected || "").padEnd(16)} ` +
    (r.error ? `err=${r.error}` : `got=${(r.got || "").padEnd(16)} conf=${r.conf} lang=${(r.lang || "-").padEnd(5)} | ${r.transcript}`)
  );
}

const total = GOLDEN.length;
console.log("\n===== summary =====");
console.log(`kind accuracy:        ${kindCorrect}/${total} = ${(kindCorrect / total * 100).toFixed(1)}%`);
console.log(`language accuracy:    ${langCorrect}/${langScored} = ${(langCorrect / langScored * 100).toFixed(1)}% (non-filler)`);
console.log(`api errors:           ${apiErrors}`);
console.log(`gate (${CONF_GATE}): would-fallback count above is per-case "routed" column`);
