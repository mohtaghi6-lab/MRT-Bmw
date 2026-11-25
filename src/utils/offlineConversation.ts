import { CarState } from "../types";
import { normalizePersianText, toEnglishDigits } from "./offlineEngine";

const HAFEZ_POEMS = [
  "الا یا ایها الساقی ادر کاسا و ناولها؛ که عشق آسان نمود اول ولی افتاد مشکل‌ها.",
  "شب تاریک و بیم موج و گردابی چنین هایل؛ کجا دانند حال ما سبکباران ساحل‌ها.",
  "صلاح کار کجا و من خراب کجا؛ ببین تفاوت ره کز کجاست تا به کجا.",
  "دوش وقت سحر از غصه نجاتم دادند؛ و اندر آن ظلمت شب آب حیاتم دادند.",
  "درخت دوستی بنشان که کام دل به بار آرد؛ نهال دشمنی برکن که رنج بی‌شمار آرد.",
  "آسایش دو گیتی تفسیر این دو حرف است؛ با دوستان مروت، با دشمنان مدارا.",
  "بیا تا گل برافشانیم و می در ساغر اندازیم؛ فلک را سقف بشکافیم و طرحی نو دراندازیم.",
  "هرگز نمیرد آن که دلش زنده شد به عشق؛ ثبت است بر جریده عالم دوام ما.",
  "یوسف گم‌گشته بازآید به کنعان غم مخور؛ کلبه احزان شود روزی گلستان غم مخور.",
  "سحر با باد می‌گفتم حدیث آرزومندی؛ خطاب آمد که واثق شو به الطاف خداوندی.",
  "من از بیگانگان دیگر ننالم؛ که با من هر چه کرد آن آشنا کرد.",
  "مزرع سبز فلک دیدم و داس مه نو؛ یادم از کشته خویش آمد و هنگام درو.",
];

const MOWLANA_POEMS = [
  "بشنو این نی چون شکایت می‌کند؛ از جدایی‌ها حکایت می‌کند.",
  "ای قوم به حج رفته کجایید کجایید؛ معشوق همین جاست بیایید بیایید.",
  "در دل و جان خانه کردی‌ عاقبت؛ هر دو را دیوانه کردی‌ عاقبت.",
  "تا توانی دلی به دست آور؛ دل شکستن هنر نمی‌باشد.",
  "هر لحظه به شکلی بت عیار برآمد؛ دل برد و نهان شد.",
];

const SAADI_POEMS = [
  "بنی آدم اعضای یکدیگرند؛ که در آفرینش ز یک گوهرند.",
  "سعدیا مرد نکونام نمیرد هرگز؛ مرده آن است که نامش به نکویی نبرند.",
  "خبرت هست که بی روی تو آرامم نیست؛ طاقت بار فراق این همه ایامم نیست.",
  "تن آدمی شریف است به جان آدمیت؛ نه همین لباس زیباست نشان آدمیت.",
];

const KHAYYAM_POEMS = [
  "این قافله عمر عجب می‌گذرد؛ دریاب دمی که با طرب می‌گذرد.",
  "اسرار ازل را نه تو دانی و نه من؛ وین حرف معما نه تو خوانی و نه من.",
  "برخیز و مخور غم جهان گذران؛ بنشین و دمی به شادمانی گذران.",
];

const FERDOWSI_POEMS = [
  "توانا بود هر که دانا بود؛ ز دانش دل پیر برنا بود.",
  "بسی رنج بردم در این سال سی؛ عجم زنده کردم بدین پارسی.",
  "چو ایران نباشد تن من مباد؛ بدین بوم و بر زنده یک تن مباد.",
];

const SOHRAB_POEMS = [
  "چشم‌ها را باید شست، جور دیگر باید دید؛ چترها را باید بست، زیر باران باید رفت.",
  "زندگی رسم خوشایندی است؛ زندگی بال و پری دارد با وسعت مرگ.",
  "اهل کاشانم، روزگارم بد نیست؛ تکه نانی دارم، خرده هوشی، سر سوزن ذوقی.",
];

const PERSIAN_JOKES = [
  "یه نفر ماشینش خراب میشه میبره مکانیکی، مکانیک میگه ماشینت هیچیش نیست فقط دلتنگی جاده گرفته، یه گاز بده خوب میشه!",
  "به راننده می‌گن چرا این‌قدر آروم میری؟ میگه آخه جلو راهم تابلو زده بود راننده عزیز آهسته برانید، دیدم به من گفته عزیز، روم نشد تند برم!",
  "یه بنده خدایی میره پمپ بنزین میگه باک رو پر کن، مسئولش میگه کارت سوخت داری؟ میگه نه ولی یه ب‌ام‌و دارم که قلبش شش سیلندره!",
  "از یه نفر می‌پرسن بهترین ساعت بیدار شدن کی هست؟ میگه هر ساعتی که خودت بیدار شی، نه ساعتی که آلارم زنگ بزنه!",
];

const PERSIAN_PROVERBS = [
  "از تو حرکت، از خدا برکت؛ هر مسیر بلندی با اولین قدم شروع میشه.",
  "کار نیکو کردن از پر کردن است؛ با صبر و حوصله هر سختی‌ای حل میشه.",
  "صبر تلخ است ولیکن بر شیرین دارد.",
  "با دوستان مروت و با دشمنان مدارا؛ آرامش توی همین دو کلمه است.",
];

const SHORT_STORIES = [
  "روزی مسافری از پیرمردی پرسید این جاده چقدر طول می‌کشه؟ پیرمرد گفت راه بیفت تا بهت بگم! مسافر چند قدم که رفت، پیرمرد صداش زد: با این قدم‌های محکم و آرام، زودتر از اون‌چه فکرش رو کنی می‌رسی.",
  "می‌گن هر وقت جاده پیچ‌درپیچ شد، نشونه اینه که داری به منظره قشنگ‌تری نزدیک می‌شی؛ فقط کافیه با آرامش و تمرکز فرمون رو نگه داری.",
];

const DRIVING_TIPS = [
  "در سفرهای طولانی هر دو ساعت یک ربع استراحت کنید و کمی آب بنوشید تا تمرکزتان بالا بماند.",
  "فاصله ایمنی با خودروی جلویی را حداقل سه ثانیه حفظ کنید، به‌خصوص وقتی سرعت بالای ۹۰ کیلومتر بر ساعت است.",
  "قبل از سبقت در جاده‌های دوطرفه، علاوه بر آینه، نقطه کور کناری را هم چک کنید.",
];

let roundRobinIdx = 0;
let lastLiteraryMode: "hafez" | "poem" | "joke" | "story" = "hafez";

function pickNext<T>(items: T[]): T {
  roundRobinIdx = (roundRobinIdx + 1) % items.length;
  return items[roundRobinIdx];
}

function trySolveMath(normInput: string): string | null {
  const clean = toEnglishDigits(normInput)
    .replace(/ضرب\s*در|ضربدر|(?<=^|\s)در(?=\s)/g, " * ")
    .replace(/تقسیم\s*بر|تقسیم/g, " / ")
    .replace(/به\s*علاوه|بعلاوه|جمع\s*با|(?<=^|\s)با(?=\s)/g, " + ")
    .replace(/منهای|منها|کم\s*کن/g, " - ");

  const percentMatch = clean.match(/(\d+(?:\.\d+)?)\s*درصد\s*(?:از\s*)?(\d+(?:\.\d+)?)/);
  if (percentMatch) {
    const p = Number(percentMatch[1]);
    const total = Number(percentMatch[2]);
    if (Number.isFinite(p) && Number.isFinite(total)) {
      const val = Number(((p / 100) * total).toFixed(2));
      return `${p} درصد از ${total} می‌شود ${val}.`;
    }
  }

  const exprMatch = clean.match(/(\d+(?:\.\d+)?)\s*([+\-*/])\s*(\d+(?:\.\d+)?)/);
  if (exprMatch) {
    const a = Number(exprMatch[1]);
    const op = exprMatch[2];
    const b = Number(exprMatch[3]);
    let res = 0;
    if (op === "+") res = a + b;
    else if (op === "-") res = a - b;
    else if (op === "*") res = a * b;
    else if (op === "/") {
      if (b === 0) return "تقسیم بر صفر امکان‌پذیر نیست.";
      res = Number((a / b).toFixed(2));
    }
    return `نتیجه برابر است با ${res}.`;
  }
  return null;
}

export function answerOfflineConversation(
  rawMessage: string,
  carState: Partial<CarState> = {},
  history: Array<{ role: string; text: string }> = []
): string | null {
  const input = normalizePersianText(rawMessage);
  if (!input) return null;

  const nowFaTime = new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
  const nowFaDate = new Date().toLocaleDateString("fa-IR", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const prevAssistantTurn = [...history]
    .reverse()
    .find((t) => t && t.role !== "user" && t.role !== "driver" && t.text);
  const prevUserTurn = [...history]
    .reverse()
    .find((t) => t && (t.role === "user" || t.role === "driver") && t.text);

  // Follow-up repeat / continuation requests
  if (
    input.includes("یکی دیگه") ||
    input.includes("یدونه دیگه") ||
    input.includes("یه دونه دیگه") ||
    input.includes("بازم بخون") ||
    input.includes("بازم بگو")
  ) {
    if (lastLiteraryMode === "joke") return pickNext(PERSIAN_JOKES);
    if (lastLiteraryMode === "story") return pickNext(SHORT_STORIES);
    if (lastLiteraryMode === "poem") {
      const allPoems = [...HAFEZ_POEMS, ...MOWLANA_POEMS, ...SAADI_POEMS, ...KHAYYAM_POEMS];
      return `این هم یک بیت دیگر: ${pickNext(allPoems)}`;
    }
    return `یک بیت دیگر از حافظ: ${pickNext(HAFEZ_POEMS)}`;
  }

  // Natural conversational continuations ("چرا؟", "بیشتر بگو", "راه حلش چیه؟", "بعدش چی؟")
  if (
    (input === "چرا" ||
      input === "بیشتر بگو" ||
      input === "بیشتر توضیح بده" ||
      input === "ادامه بده" ||
      input === "راه حلش چیه" ||
      input === "چیکار کنم") &&
    prevAssistantTurn
  ) {
    const prevTxt = normalizePersianText(prevAssistantTurn.text);
    if (prevTxt.includes("استرس") || prevTxt.includes("خسته") || prevTxt.includes("نگران")) {
      return "بهترین راه اینه که اول چند نفس عمیق بکشی و ذهنت رو از شلوغی کارها خالی کنی. بعد فقط اولین قدم کوچیک که امروز از دستت برمیاد رو انتخاب کن؛ درباره چی بیشتر ذهنت درگیره؟";
    }
    if (prevTxt.includes("سفر") || prevTxt.includes("جاده")) {
      return "برای سفر راحت‌تر همیشه بهتره صبح زود راه بیفتی، فشار باد لاستیک‌ها رو قبل حرکت چک کنی و یک پلی‌لیست آروم همراهت باشه. الان قصد سفر به شهر خاصی داری؟";
    }
    return `در ادامه همون موضوع، نکته مهمش اینه که قدم‌به‌قدم و با حوصله جلو بری. دوست داری دقیق‌تر درباره چه بخشیش با هم مشورت کنیم؟`;
  }

  // 1. Hafez & Fal-e Hafez
  if (input.includes("حافظ") || input.includes("فال") || input.includes("غزل")) {
    lastLiteraryMode = "hafez";
    const verse = pickNext(HAFEZ_POEMS);
    if (input.includes("فال")) {
      return `فال حافظ شما این شد: ${verse} نیتتون خیره و مسیر پیش رو روشنه.`;
    }
    return `تقدیم به شما از دیوان حافظ: ${verse}`;
  }

  // 2. Other classic & modern Persian poets
  if (input.includes("مولانا") || input.includes("مولوی") || /(?:^|\s)شمس(?:\s|$)/.test(input)) {
    lastLiteraryMode = "poem";
    return `از حضرت مولانا: ${pickNext(MOWLANA_POEMS)}`;
  }
  if (input.includes("سعدی")) {
    lastLiteraryMode = "poem";
    return `از سعدی شیرازی: ${pickNext(SAADI_POEMS)}`;
  }
  if (input.includes("خیام")) {
    lastLiteraryMode = "poem";
    return `از حکیم عمر خیام: ${pickNext(KHAYYAM_POEMS)}`;
  }
  if (input.includes("فردوسی") || input.includes("شاهنامه")) {
    lastLiteraryMode = "poem";
    return `از حکیم ابوالقاسم فردوسی: ${pickNext(FERDOWSI_POEMS)}`;
  }
  if (input.includes("سهراب") || input.includes("سپهری")) {
    lastLiteraryMode = "poem";
    return `از سهراب سپهری: ${pickNext(SOHRAB_POEMS)}`;
  }

  // 3. Generic poem
  if (
    input.includes("شعر") ||
    input.includes("بیت") ||
    input.includes("مشاعره") ||
    input.includes("رباعی") ||
    input.includes("دکلمه")
  ) {
    lastLiteraryMode = "poem";
    const allPoems = [...HAFEZ_POEMS, ...MOWLANA_POEMS, ...SAADI_POEMS, ...KHAYYAM_POEMS];
    return `با کمال میل؛ این بیت زیبا تقدیم شما: ${pickNext(allPoems)}`;
  }

  // 4. Jokes & stories & proverbs
  if (
    input.includes("جوک") ||
    input.includes("لطیفه") ||
    input.includes("بخند") ||
    input.includes("خنده") ||
    input.includes("شوخی")
  ) {
    lastLiteraryMode = "joke";
    return pickNext(PERSIAN_JOKES);
  }
  if (input.includes("قصه") || input.includes("داستان")) {
    lastLiteraryMode = "story";
    return pickNext(SHORT_STORIES);
  }
  if (input.includes("ضرب المثل") || input.includes("مثل بگو") || input.includes("پند") || input.includes("حکمت")) {
    return pickNext(PERSIAN_PROVERBS);
  }

  // 5. Math
  const mathAns = trySolveMath(input);
  if (mathAns) return mathAns;

  // 6. Time & date
  if (input.includes("ساعت") || input.includes("تاریخ") || input.includes("امروز چندم") || input.includes("چه روزی")) {
    return `الان ساعت ${nowFaTime} و امروز ${nowFaDate} است. برنامه‌ات برای امروز چیه؟`;
  }

  // 7. Two-person Emotional / Life Counseling & Guidance (like ChatGPT Live Voice)
  if (
    input.includes("استرس") ||
    input.includes("نگران") ||
    input.includes("اضطراب") ||
    input.includes("دلم گرفته") ||
    input.includes("ناراحت") ||
    input.includes("غصه") ||
    input.includes("اعصابم") ||
    input.includes("کلافه")
  ) {
    return "درکت می‌کنم، گاهی فشار روزمره آدم رو واقعاً خسته می‌کنه. یه نفس عمیق بکش و چند لحظه فقط روی جاده و خودت تمرکز کن؛ دوست داری بگی چی باعث شده ذهنت این‌قدر درگیر بشه تا با هم راجع بهش حرف بزنیم؟";
  }

  if (
    input.includes("خوابم میاد") ||
    input.includes("خسته ام") ||
    input.includes("خستم") ||
    input.includes("بی حوصله") ||
    input.includes("حوصلم سر") ||
    input.includes("حوصله ام سر")
  ) {
    return "اگه خسته‌ای یا حوصله‌ات سر رفته، یه کم باد خنک کولر رو روشن کن یا یه استراحت کوتاه کنار جاده داشته باش. می‌خوای با هم یه گپ دوستانه بزنیم، یا برات یه لطیفه و شعر بخونم؟";
  }

  if (
    input.includes("انگیزه") ||
    input.includes("ناامید") ||
    input.includes("تصمیم") ||
    input.includes("راهنمایی") ||
    input.includes("مشورت") ||
    input.includes("کمکم کن") ||
    input.includes("چیکار باید بکنم") ||
    input.includes("نظرت چیه")
  ) {
    return "من همیشه پای حرفات هستم و هر تصمیمی بخوای بگیری می‌تونیم کنار هم سبک‌سنگینش کنیم. بگو دقیقاً سر چه موضوعی دو دل هستی تا نظر و پیشنهادم رو صمیمی بهت بگم.";
  }

  if (
    input.includes("کار") ||
    input.includes("شغل") ||
    input.includes("درآمد") ||
    input.includes("پول") ||
    input.includes("پروژه") ||
    input.includes("موفقیت")
  ) {
    return "توی کار و کسب‌وکار، تمرکز روی یه مهارت مشخص، نظم روزانه و صبر روی نتیجه از همه چیز مهم‌تره. الان دنبال راه‌اندازی کار جدیدی هستی یا می‌خوای کارت رو توسعه بدی؟";
  }

  // 8. Travel & places suggestions
  if (
    input.includes("کجا برم") ||
    input.includes("مسافرت") ||
    input.includes("سفر") ||
    input.includes("تفریح") ||
    input.includes("گردش")
  ) {
    return "اگه دنبال هوای خنک و طبیعت هستی جاده‌های شمال و ییلاقات، و اگه دنبال تاریخ و آرامش شهری هستی شیراز و اصفهان فوق‌العاده‌ان. برای آخر هفته قصد سفر داری یا یه گشت کوتاه داخل شهر؟";
  }

  // 9. Food / Cooking / Drinks
  if (
    input.includes("غذا") ||
    input.includes("شام") ||
    input.includes("ناهار") ||
    input.includes("صبحانه") ||
    input.includes("گرسنمه") ||
    input.includes("چی بخورم") ||
    input.includes("قهوه") ||
    input.includes("چای")
  ) {
    return "برای تو جاده یا بعد از رانندگی، اگه یه چیز سبک و مقوی بخوای کباب کوبیده یا جوجه با ماست، و برای سرحال شدن یه فنجون قهوه یا چای تازه‌دم عالیه! الان بیشتر هوس غذای سنتی داری یا فست‌فود؟";
  }

  // 10. Health & wellness
  if (
    input.includes("سردرد") ||
    input.includes("کمردرد") ||
    input.includes("سلامتی") ||
    input.includes("ورزش") ||
    input.includes("رژیم") ||
    input.includes("خواب")
  ) {
    return "سلامتی همیشه در اولویته؛ نوشیدن آب کافی، کشش عضلات بعد از رانندگی طولانی و خواب منظم شبانه معجزه می‌کنه. اگه الان درد یا بی‌حالی داری، بهتره چند دقیقه ماشین رو پارک کنی و استراحت کنی.";
  }

  // 11. Car maintenance, mechanics & BMW 728Li facts
  if (
    input.includes("مشخصات") ||
    input.includes("موتور ماشین") ||
    input.includes("چند اسب") ||
    input.includes("چند سیلندر") ||
    input.includes("728") ||
    input.includes("۷۲۸")
  ) {
    return "ب‌ام‌و ۷۲۸ ال‌آی نسل E38 یه سدان لوکس با موتور شش سیلندر خطی M52TUB28، حجم ۲۸۰۰ سی‌سی و سیستم دبل وانوس هست که ۱۹۳ اسب بخار قدرت داره و سواری بسیار نرمی توی جاده می‌ده.";
  }

  if (
    input.includes("لنت") ||
    input.includes("گیربکس") ||
    input.includes("تسمه") ||
    input.includes("شمع") ||
    input.includes("تعمیر") ||
    input.includes("مکانیک") ||
    input.includes("سرویس دوره ای")
  ) {
    return "برای نگهداری بی‌نقص از ب‌ام‌و سری ۷، روغن موتور تمام سینتتیک رو هر ۷ هزار کیلومتر، روغن گیربکس اتوماتیک رو هر ۶۰ هزار کیلومتر و سیستم خنک‌کننده و واترپمپ رو مرتب چک کن تا موتور شش سیلندرش سال‌ها مثل ساعت کار کنه.";
  }

  if (input.includes("نکته رانندگی") || input.includes("توصیه رانندگی") || input.includes("ایمنی رانندگی")) {
    return pickNext(DRIVING_TIPS);
  }

  // 12. Warm human greetings & casual chat
  if (
    input.includes("سلام") ||
    input.includes("چطوری") ||
    input.includes("حالت") ||
    input.includes("خوبی") ||
    input.includes("چه خبر") ||
    input.includes("عشقی") ||
    input.includes("دمت گرم") ||
    input.includes("قربانت") ||
    input.includes("فدات")
  ) {
    return "سلام رفیق! من عالی‌ام و با انرژی کنارتم. امروز اوضاع چطور پیش می‌ره؟ در مورد هر موضوعی دوست داری گپ بزنیم یا کاری برات انجام بدم، در خدمتم.";
  }

  if (input.includes("هوا چطوره") || input.includes("دما چنده")) {
    return `دمای هوای بیرون طبق سنسور ب‌ام‌و الان ${carState.outsideTemp ?? 22} درجه و دمای داخل کابین ${carState.acTemp ?? 22} درجه هست. دوست داری دما رو برات خنک‌تر یا گرم‌تر کنم؟`;
  }

  if (input.includes("دوستت دارم") || input.includes("عزیزی") || input.includes("باهوشی") || input.includes("خوشم میاد")) {
    return "لطف داری رفیق! منم از هم‌صحبتی با تو توی این ب‌ام‌و خیلی لذت می‌برم. همیشه کنارت هستم.";
  }

  // 13. AI, Technology, Programming & Digital World
  if (
    input.includes("هوش مصنوعی") ||
    input.includes("chatgpt") ||
    input.includes("چت جی پی تی") ||
    input.includes("چت جی‌پی‌تی") ||
    input.includes("جمنای") ||
    input.includes("gemini")
  ) {
    return "هوش مصنوعی امروز تقریباً وارد همه کارها از دستیار صوتی و ترجمه گرفته تا برنامه‌نویسی، پزشکی و خودروهای هوشمند شده. به عنوان هم‌صحبتت هر وقت به من متصل باشی می‌تونیم روی ایده، متن، کد یا هر سؤال علمی با هم فکر کنیم. درباره چه بخشیش کنجکاوی؟";
  }

  if (
    input.includes("برنامه نویسی") ||
    input.includes("کدنویسی") ||
    input.includes("پایتون") ||
    input.includes("جاوااسکریپت") ||
    input.includes("سایت") ||
    input.includes("اپلیکیشن") ||
    input.includes("فناوری") ||
    input.includes("تکنولوژی")
  ) {
    return "توی دنیای فناوری و برنامه‌نویسی، یادگیری یک زبان کاربردی مثل پایتون یا تایپ‌اسکریپت و ساخت پروژه‌های واقعی بهترین راه پیشرفته. اگه ایده یا پروژه‌ای توی ذهنت داری بگو تا قدم‌به‌قدم راجع بهش مشورت کنیم.";
  }

  // 14. Economy, Crypto, Gold, Business & Investing
  if (
    input.includes("بورس") ||
    input.includes("ارز دیجیتال") ||
    input.includes("بیت کوین") ||
    input.includes("دلار") ||
    input.includes("طلا") ||
    input.includes("سرمایه") ||
    input.includes("اقتصاد")
  ) {
    return "در مدیریت سرمایه و بازارهای مالی، هیچ‌وقت کل سرمایه رو یک‌جا ریسک نکن، تنوع سبد دارایی داشته باش و تصمیم احساسی توی هیجان بازار نگیر. الان دنبال بررسی استراتژی سرمایه‌گذاری هستی یا مدیریت بودجه شخصی؟";
  }

  // 15. Movies, Books, Music & Culture
  if (
    input.includes("فیلم") ||
    input.includes("سریال") ||
    input.includes("سینما") ||
    input.includes("کتاب") ||
    input.includes("رمان") ||
    input.includes("پادکست")
  ) {
    return "اگه فیلم هیجان‌انگیز و فکری دوست داری Interstellar و Inception عالی‌اند، و برای کتاب خوندن هم اثرهایی مثل «عادت‌های اتمی» یا ادبیات کلاسیک خودمون حسابی دید آدم رو باز می‌کنن. چه ژانری بیشتر سلیقه توئه؟";
  }

  // 16. Sports & Fitness
  if (
    input.includes("فوتبال") ||
    input.includes("بدنسازی") ||
    input.includes("باشگاه") ||
    input.includes("کاهش وزن") ||
    input.includes("تناسب اندام") ||
    input.includes("تمرین")
  ) {
    return "راز نتیجه گرفتن توی ورزش و تناسب اندام، استمرار سه تا چهار جلسه در هفته، خواب کافی و پروتئین مناسب در غذاست نه فشار مقطعی و شدید. هدفت عضله‌سازی و قدرته یا چربی‌سوزی و آمادگی جسمانی؟";
  }

  // 17. Phone / Gadgets / Daily Tech
  if (
    input.includes("گوشی") ||
    input.includes("موبایل") ||
    input.includes("آیفون") ||
    input.includes("سامسونگ") ||
    input.includes("لپ تاپ") ||
    input.includes("لپتاپ")
  ) {
    return "موقع خرید گوشی یا لپ‌تاپ، عمر باتری، کیفیت نمایشگر، پشتیبانی نرم‌افزاری و کاربری واقعی خودت مهم‌تر از عدد مگاپیکسل و تبلیغاته. بین چه مدل‌هایی مردد شدی یا دنبال چه ویژگی خاصی هستی؟";
  }

  // If user is asking about a general topic not matched above (handled next by Wikipedia lookup / cloud LLM)
  void prevUserTurn;
  return null;
}
