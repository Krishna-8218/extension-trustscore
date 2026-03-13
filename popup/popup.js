/**
 * popup.js – TrustScore v3.5 (Robust Merger)
 * Combined our high-accuracy rubrics with the Premium v3.0 UI.
 */

let scrapedReviews = []; 
let animationIntervals = { trust: null };

/* ══════════════════════════════════════════
   INIT: Detect platform on load
   ══════════════════════════════════════════ */
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  const tab = tabs[0];
  if (!tab || !tab.url) return;
  try {
    const host = new URL(tab.url).hostname;
    const platformMap = {
      myntra: "Myntra", meesho: "Meesho", flipkart: "Flipkart",
      amazon: "Amazon", ajio: "Ajio", nykaa: "Nykaa",
      snapdeal: "Snapdeal", makemytrip: "MakeMyTrip",
      zomato: "Zomato", swiggy: "Swiggy"
    };
    const badge = document.getElementById("platform-badge");
    const found = Object.keys(platformMap).find(k => host.includes(k));
    if (found) {
      badge.textContent = "🔗 " + platformMap[found];
      badge.style.color = "#34d399";
    } else {
      badge.textContent = "Not Supported";
      badge.style.color = "#f59e0b";
    }
  } catch(e) { }
});

/* ══════════════════════════════════════════
   TAB SWITCHING
   ══════════════════════════════════════════ */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

/* ══════════════════════════════════════════
   REVIEWS TAB — SCRAPE
   ══════════════════════════════════════════ */
document.getElementById("btn-scrape").addEventListener("click", () => {
  const btn = document.getElementById("btn-scrape");
  btn.disabled = true;
  btn.innerHTML = "<span>⏳</span> Scraping...";
  setStatus("reviews-status-bar", "reviews-status-text", "loading", "Analyzing page and expanding reviews...");

  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0];
    if (!tab) return resetScrapeBtn("Cannot access tab.");

    chrome.tabs.sendMessage(tab.id, { action: "SCRAPE_REVIEWS" }, response => {
      if (chrome.runtime.lastError || !response || !response.reviews || response.reviews.length === 0) {
        // Use our high-patience fallback message
        setStatus("reviews-status-bar", "reviews-status-text", "loading", "Still searching... Scroll down slightly if needed.");
        setTimeout(() => {
          if (document.getElementById("reviews-status-text").innerText.includes("Still searching")) {
            resetScrapeBtn("No reviews detected. Scroll down and try again.");
          }
        }, 6000);
        return;
      }

      scrapedReviews = response.reviews;
      const count = scrapedReviews.length;
      setStatus("reviews-status-bar", "reviews-status-text", "success", `✅ Found ${count} reviews. Analysis ready.`);
      renderReviews(scrapedReviews);
      document.getElementById("action-row").style.display = "flex";
      btn.disabled = false;
      btn.innerHTML = "<span>⚡</span> Scrape Reviews";
    });
  });

  function resetScrapeBtn(msg) {
    btn.disabled = false;
    btn.innerHTML = "<span>⚡</span> Scrape Reviews";
    setStatus("reviews-status-bar", "reviews-status-text", "error", msg);
    renderEmptyList();
  }
});

function renderReviews(reviews) {
  const list = document.getElementById("reviews-list");
  list.innerHTML = "";
  reviews.forEach(r => {
    const text = r.text || "";
    const name = r.reviewerName || "Verified Buyer";
    const rating = r.rating || 5;
    
    // Quick local sentiment for the preview badge
    const sentiment = scoreReview(text);
    const bc = sentiment === "positive" ? "pos" : sentiment === "negative" ? "neg" : "neu";
    const bl = sentiment.toUpperCase();

    const card = document.createElement("div");
    card.className = "review-card";
    card.innerHTML = `
      <span class="badge ${bc}">${bl}</span><br/>
      ${esc(text)}
      <div class="review-meta">👤 ${esc(name)} · ⭐ ${rating}/5</div>
    `;
    list.appendChild(card);
  });
}

function renderEmptyList() {
  document.getElementById("reviews-list").innerHTML = `
    <div class="empty-state">
      <div class="big">📦</div>
      <p>No reviews found.<br/>Try scrolling down on the product page.</p>
    </div>`;
  document.getElementById("action-row").style.display = "none";
}

function esc(str) {
  return (str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* Copy & Download */
document.getElementById("btn-copy").addEventListener("click", () => {
  const json = JSON.stringify({ reviews: scrapedReviews }, null, 2);
  navigator.clipboard.writeText(json).then(() => {
    const b = document.getElementById("btn-copy");
    b.textContent = "✅ Copied!";
    setTimeout(() => { b.innerHTML = "📋 Copy JSON"; }, 1800);
  });
});

document.getElementById("btn-download").addEventListener("click", () => {
  const json = JSON.stringify({ reviews: scrapedReviews }, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "reviews.json"; a.click();
  URL.revokeObjectURL(url);
});


/* ══════════════════════════════════════════
   AI SUMMARY TAB — ANALYSE (Sentiment Chart)
   ══════════════════════════════════════════ */
document.getElementById("btn-analyse").addEventListener("click", () => {
  if (!scrapedReviews.length) return alert("Please scrape reviews first.");
  const result = analyzeReviews(scrapedReviews);
  renderSummary(result);
});

function renderSummary(r) {
  document.getElementById("summary-prompt").style.display = "none";
  document.getElementById("summary-content").style.display = "block";

  const badge = document.getElementById("verdict-badge");
  badge.className = "verdict-badge " + (r.verdict === "N/A" ? "NA" : r.verdict);
  const icon = r.verdict === "BUY" ? "✅" : r.verdict === "SKIP" ? "❌" : r.verdict === "MIXED" ? "⚠️" : "—";
  badge.textContent = icon + " " + r.verdict;
  document.getElementById("verdict-summary").textContent = r.summary;

  const ring = document.getElementById("ring-fg");
  ring.style.strokeDashoffset = 188 - (r.score / 100) * 188;
  ring.style.stroke = r.verdict === "BUY" ? "#10b981" : r.verdict === "SKIP" ? "#ef4444" : "#f59e0b";
  document.getElementById("ring-pct").textContent = r.score + "%";

  document.getElementById("stat-pos").textContent = r.positive;
  document.getElementById("stat-neg").textContent = r.negative;
  document.getElementById("stat-neu").textContent = r.neutral;

  const posP = r.total ? Math.round((r.positive / r.total) * 100) : 0;
  const negP = r.total ? Math.round((r.negative / r.total) * 100) : 0;
  const neuP = 100 - posP - negP;
  document.getElementById("leg-pos").textContent = `Positive – ${posP}%`;
  document.getElementById("leg-neg").textContent = `Negative – ${negP}%`;
  document.getElementById("leg-neu").textContent = `Neutral – ${neuP}%`;

  drawDonut(r.positive, r.negative, r.neutral, r.total);
  drawBar(r.categoryScores);
}

/* ══════════════════════════════════════════
   TRUST SCORE TAB — Deep Rubric + ML Scan
   ══════════════════════════════════════════ */
document.getElementById("btn-trust-scan").addEventListener("click", async () => {
  const btn = document.getElementById("btn-trust-scan");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");

  if (!scrapedReviews.length) {
    setStatus("trust-status-bar", "trust-status-text", "error", "No reviews yet. Scrape first!");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = "<span>⏳</span> Scanning...";
  setStatus("trust-status-bar", "trust-status-text", "loading", "Scanning reviewer history...");
  progressContainer.style.display = "block";
  progressBar.style.width = "10%";

  // 1. DEEP SCAN (Our robust rubric logic)
  const totalReviews = scrapedReviews.length;
  const maxScan = 50; 
  const step = Math.max(1, Math.floor(totalReviews / maxScan));
  const reviewsToDeepScan = [];
  for (let i = 0; i < totalReviews && reviewsToDeepScan.length < maxScan; i += step) {
    reviewsToDeepScan.push(scrapedReviews[i]);
  }

  const updatedReviews = [...scrapedReviews];
  for (let i = 0; i < reviewsToDeepScan.length; i++) {
    const r = reviewsToDeepScan[i];
    if (r.profileUrl) {
      progressBar.style.width = `${10 + (i * (40 / reviewsToDeepScan.length))}%`;
      const res = await chrome.runtime.sendMessage({ action: "FETCH_HISTORY", url: r.profileUrl }).catch(() => null);
      if (res && res.history) {
        const idx = scrapedReviews.indexOf(r);
        if (idx !== -1) updatedReviews[idx].history = res.history;
      }
    }
  }

  // 2. Credibility + AI Transition
  const enriched = calculateCredibility(updatedReviews);
  const avgCred = Math.round(enriched.reduce((s, r) => s + (r.credibilityScore || 0), 0) / (enriched.length || 1));
  
  // Show base trust immediately (using our Responsive UI fix)
  updateTrustUI(-2, avgCred); 
  progressBar.style.width = "75%";
  setStatus("trust-status-bar", "trust-status-text", "loading", "Finalizing AI Analysis...");

  try {
    // SMART SAMPLE: Top 40 detailed reviews for ML
    const mlSample = [...scrapedReviews]
      .sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0))
      .slice(0, 40);

    const apiResult = await sendReviewsToAPIWithRetry(mlSample);
    if (apiResult && apiResult.platform_summary) {
      const auth = apiResult.platform_summary.platform_trust_score;
      updateTrustUI(auth, avgCred);
      setStatus("trust-status-bar", "trust-status-text", "success", `✅ Complete (${totalReviews} reviews analyzed)`);
    } else throw new Error("API Invalid");
  } catch (err) {
    console.warn("ML API Error", err);
    updateTrustUI(-1, avgCred);
    setStatus("trust-status-bar", "trust-status-text", "success", "✅ Complete (Behavioral score only - AI Busy)");
  }

  progressBar.style.width = "100%";
  btn.disabled = false;
  btn.innerHTML = "<span>🛡️</span> Run Trust Scan";
  setTimeout(() => progressContainer.style.display = "none", 1500);
});

function updateTrustUI(authenticity, credibility) {
  const trustEl = document.getElementById("trust-score");
  const authEl = document.getElementById("authenticity-score");
  const credEl = document.getElementById("credibility-score");
  const contentRing = document.getElementById("content-ring");
  const reviewerRing = document.getElementById("reviewer-ring");

  // Calculate overall reliability
  let finalScore = 0;
  if (authenticity >= 0) finalScore = Math.round(authenticity * 0.6 + credibility * 0.4);
  else finalScore = credibility; // "Base Trust" while loading or on error

  animateCount(trustEl, finalScore, "%");

  // AI Authenticity state
  if (authenticity === -2) {
    authEl.textContent = "...";
    authEl.style.color = "#ffa502";
    contentRing.style.strokeDashoffset = 226;
    contentRing.style.stroke = "#ffa502";
  } else if (authenticity === -1) {
    authEl.textContent = "ERR";
    authEl.style.color = "#ff4757";
    contentRing.style.strokeDashoffset = 226;
  } else {
    authEl.textContent = Math.round(authenticity) + "%";
    authEl.style.color = "#fff";
    contentRing.style.stroke = "#818cf8";
    contentRing.style.strokeDashoffset = 226 * (1 - authenticity / 100);
  }

  // Reviewer History state
  credEl.textContent = credibility + "%";
  reviewerRing.style.strokeDashoffset = 226 * (1 - credibility / 100);
}

function animateCount(el, end, suffix = "") {
  if (animationIntervals.trust) clearInterval(animationIntervals.trust);
  let cur = parseInt(el.textContent) || 0;
  animationIntervals.trust = setInterval(() => {
    if (cur < end) cur++; else if (cur > end) cur--; else clearInterval(animationIntervals.trust);
    el.textContent = cur + suffix;
  }, 10);
}

/* ── ML API with Robustness ── */
async function sendReviewsToAPIWithRetry(reviewTexts, retries = 1) {
  const statusEl = document.getElementById("trust-status-text");
  for (let i = 0; i <= retries; i++) {
    try {
      if (i > 0) statusEl.innerText = `AI Service Busy... Retrying (${i}/${retries})`;
      
      let csv = "review_id,seller_id,rating,review_text,review_date\n";
      reviewTexts.forEach((r, idx) => {
        const text = String(r.text || r).replace(/"/g, '""').replace(/\r?\n|\r/g, " ");
        csv += `${idx},demo,${r.rating || 5},"${text}",2024-01-01\n`;
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const formData = new FormData();
      formData.append("file", blob, "reviews.csv");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); 

      const res = await fetch("https://trustscore-ml-model.onrender.com/api/analyze", { 
        method: "POST", body: formData, signal: controller.signal 
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

function setStatus(barId, textId, type, msg) {
  const bar = document.getElementById(barId);
  bar.className = "status-bar " + type;
  document.getElementById(textId).textContent = msg;
}

/* Donut & Bar Chart Helpers (from analyzer.js requirement) */
function drawDonut(pos, neg, neu, total) {
  const canvas = document.getElementById("donut-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  const cx = W/2, cy = H/2, r = W/2-10, T = 12;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.strokeStyle="rgba(255,255,255,0.05)"; ctx.lineWidth=T; ctx.stroke();
  if(!total) return;
  let start = -Math.PI/2;
  [{v:pos,c:"#10b981"},{v:neg,c:"#ef4444"},{v:neu,c:"#4b5563"}].forEach(s => {
    if(s.v<=0) return;
    const sweep = (s.v/total)*Math.PI*2;
    ctx.beginPath(); ctx.arc(cx,cy,r,start,start+sweep); ctx.strokeStyle=s.c; ctx.lineWidth=T; ctx.stroke();
    start += sweep;
  });
  ctx.fillStyle="#fff"; ctx.font="bold 15px Inter"; ctx.textAlign="center"; ctx.fillText(total, cx, cy+5);
}

function drawBar(catScores) {
  const canvas = document.getElementById("bar-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  const cats = Object.keys(catScores);
  const rowH = H / (cats.length || 1);
  cats.forEach((cat, i) => {
    const y = i * rowH + rowH/2;
    ctx.fillStyle="#94a3b8"; ctx.font="10px Inter"; ctx.textAlign="right"; ctx.fillText(cat, 60, y+4);
    const score = catScores[cat];
    const max = 10; // Normalized
    const px = (score.pos / max) * 100;
    const nx = (score.neg / max) * 100;
    ctx.fillStyle="#10b981"; ctx.fillRect(70, y-4, px, 8);
    ctx.fillStyle="#ef4444"; ctx.fillRect(180, y-4, nx, 8);
  });
}
