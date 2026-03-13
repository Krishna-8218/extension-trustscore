/**
 * analyzer.js – Client-side sentiment analyser (no API key required).
 * Used by the AI Summary tab.
 */

const POSITIVE_KEYWORDS = [
  "excellent", "amazing", "awesome", "fantastic", "great", "good", "best",
  "superb", "outstanding", "perfect", "wonderful", "brilliant", "love",
  "loved", "nice", "beautiful", "stunning", "flawless", "premium", "top",
  "worth", "value", "affordable", "cheap", "reasonable", "budget", "deal",
  "fast", "quick", "on time", "early", "prompt", "speedy", "delivered",
  "comfortable", "soft", "smooth", "fit", "fits", "fitting", "perfect fit",
  "lightweight", "durable", "sturdy", "solid",
  "delicious", "tasty", "yummy", "fresh", "crispy", "hot",
  "satisfied", "happy", "recommend", "recommended", "repurchase", "again",
  "repeat", "buy again", "must buy", "impressed", "exceeded", "surprise"
];

const NEGATIVE_KEYWORDS = [
  "bad", "poor", "worst", "terrible", "horrible", "awful", "pathetic",
  "useless", "waste", "cheap quality", "broke", "broken", "damaged",
  "defective", "faulty", "fake", "duplicate", "counterfeit",
  "expensive", "overpriced", "not worth", "rip off", "ripoff", "costly",
  "late", "delayed", "missing", "lost", "wrong", "incorrect", "never arrived",
  "uncomfortable", "rough", "tight", "loose", "small", "large", "shrink",
  "faded", "stain", "smell", "odour", "itchy",
  "stale", "cold", "burnt", "raw", "undercooked", "bland",
  "disappointed", "disappointing", "regret", "return", "refund", "complaint",
  "cheated", "fraud", "scam", "beware", "avoid", "never again", "do not buy",
  "don't buy", "not recommended"
];

const CATEGORIES = {
  "Quality":  {
    pos: ["excellent","great","best","premium","durable","flawless","perfect","amazing","superb"],
    neg: ["bad","poor","fake","broken","damaged","defective","cheap quality","faulty"]
  },
  "Value":    {
    pos: ["worth","affordable","deal","value","reasonable","budget"],
    neg: ["expensive","overpriced","not worth","rip off","costly"]
  },
  "Delivery": {
    pos: ["fast","quick","on time","early","prompt","delivered"],
    neg: ["late","delayed","missing","lost","never arrived"]
  },
  "Comfort":  {
    pos: ["comfortable","soft","smooth","fit","lightweight"],
    neg: ["uncomfortable","rough","tight","loose","itchy","smell"]
  },
  "Overall":  {
    pos: ["love","happy","recommend","impressed","must buy","buy again"],
    neg: ["disappointed","regret","fraud","scam","avoid","never again"]
  }
};

function scoreReview(text) {
  const t = (typeof text === "object" && text !== null) ? text.text : text;
  const lower = (t || "").toLowerCase();
  let pos = 0, neg = 0;
  POSITIVE_KEYWORDS.forEach(kw => { if (lower.includes(kw)) pos++; });
  NEGATIVE_KEYWORDS.forEach(kw => { if (lower.includes(kw)) neg++; });
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

function categoryScores(reviews) {
  const scores = {};
  Object.keys(CATEGORIES).forEach(cat => { scores[cat] = { pos: 0, neg: 0 }; });
  reviews.forEach(r => {
    const text = (typeof r === "object" && r !== null) ? r.text : r;
    const lower = (text || "").toLowerCase();
    Object.entries(CATEGORIES).forEach(([cat, { pos, neg }]) => {
      pos.forEach(kw => { if (lower.includes(kw)) scores[cat].pos++; });
      neg.forEach(kw => { if (lower.includes(kw)) scores[cat].neg++; });
    });
  });
  return scores;
}

function buildSummary(verdict, total, posCount, negCount, catScores) {
  const topPos = Object.entries(catScores)
    .filter(([, v]) => v.pos > 0)
    .sort((a, b) => b[1].pos - a[1].pos)
    .slice(0, 2).map(([k]) => k.toLowerCase()).join(" and ");

  const topNeg = Object.entries(catScores)
    .filter(([, v]) => v.neg > 0)
    .sort((a, b) => b[1].neg - a[1].neg)
    .slice(0, 2).map(([k]) => k.toLowerCase()).join(" and ");

  const pct = Math.round((posCount / total) * 100);

  if (verdict === "BUY") {
    return `${pct}% of reviewers are satisfied${topPos ? ", especially praising " + topPos : ""}. Most buyers would recommend this product.`;
  }
  if (verdict === "SKIP") {
    return `${Math.round((negCount / total) * 100)}% of reviewers express dissatisfaction${topNeg ? ", mainly around " + topNeg : ""}. Consider alternatives.`;
  }
  return `Reviews are mixed${topPos ? " — positives around " + topPos : ""}${topNeg ? ", concerns about " + topNeg : ""}. Weigh your priorities before buying.`;
}

function analyzeReviews(reviews) {
  if (!reviews || reviews.length === 0) {
    return { positive: 0, negative: 0, neutral: 0, score: 0, verdict: "N/A",
      summary: "No reviews found. Please scrape reviews first.", categoryScores: {} };
  }

  let positive = 0, negative = 0, neutral = 0;
  reviews.forEach(r => {
    const s = scoreReview(r);
    if (s === "positive") positive++;
    else if (s === "negative") negative++;
    else neutral++;
  });

  const total = reviews.length;
  const score = Math.round(((positive + neutral * 0.5) / total) * 100);
  let verdict = score >= 65 ? "BUY" : score >= 40 ? "MIXED" : "SKIP";
  const catScores = categoryScores(reviews);
  const summary = buildSummary(verdict, total, positive, negative, catScores);

  return { positive, negative, neutral, total, score, verdict, summary, categoryScores: catScores };
}
