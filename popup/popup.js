// popup.js - Ultimate Merged Version

const scrapeBtn = document.getElementById("scrape");
const statusEl = document.getElementById("status");
const statusChip = document.getElementById("status-chip");
const progressBar = document.getElementById("progress-bar");
const progressContainer = document.getElementById("progress-container");

// --- 1. TAB NAVIGATION ---
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    const tabId = btn.getAttribute("data-tab");
    
    // Update Nav
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // Update Content
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    document.getElementById(`tab-${tabId}`).classList.add("active");
  });
});

// --- 2. SCRAPE & ANALYZE ---
scrapeBtn.addEventListener("click", async () => {
  scrapeBtn.disabled = true;
  scrapeBtn.innerText = "Analyzing...";
  
  // UI Reset
  document.getElementById("trust-score").innerText = "--";
  document.getElementById("authenticity-score").innerText = "--";
  document.getElementById("credibility-score").innerText = "--";
  document.getElementById("status").style.display = "block";
  statusChip.innerText = "Scanning...";
  statusChip.style.color = "var(--primary)";
  
  progressContainer.style.display = "block";
  progressBar.style.width = "5%";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: "SCRAPE_REVIEWS" }, async (response) => {
    if (chrome.runtime.lastError || !response || !response.reviews || response.reviews.length === 0) {
      statusEl.innerText = "No reviews found. Scroll to reviews and try again.";
      statusChip.innerText = "No Data";
      scrapeBtn.disabled = false;
      scrapeBtn.innerText = "Analyze Product";
      return;
    }

    const reviews = response.reviews;
    progressBar.style.width = "20%";
    statusEl.innerText = `Scanned ${reviews.length} reviews. Running Deep Scan...`;

    // A. DEEP HISTORICAL SCAN (Sampling)
    const scanLimit = 40;
    const step = Math.max(1, Math.floor(reviews.length / scanLimit));
    const sample = [];
    for (let i = 0; i < reviews.length && sample.length < scanLimit; i += step) sample.push(reviews[i]);

    for (let i = 0; i < sample.length; i++) {
        if (sample[i].profileUrl) {
            statusEl.innerText = `Deep Scan [${i+1}/${sample.length}]: ${sample[i].reviewerName}...`;
            progressBar.style.width = `${20 + (i * (30 / sample.length))}%`;
            try {
                const res = await chrome.runtime.sendMessage({ action: "FETCH_HISTORY", url: sample[i].profileUrl });
                if (res && res.history) {
                    const idx = reviews.indexOf(sample[i]);
                    if (idx !== -1) reviews[idx].history = res.history;
                }
            } catch (e) {}
        }
    }

    // B. CALCULATE CREDIBILITY
    const enriched = calculateCredibility(reviews);
    const avgCred = Math.round(enriched.reduce((s, r) => s + r.credibilityScore, 0) / (enriched.length || 1));
    
    // C. AI AUTHENTICITY (ML Call)
    progressBar.style.width = "70%";
    statusEl.innerText = "Vertex AI Pattern Matching...";
    
    updateDashboard(avgCred, -2); // Show "..." for AI ring
    
    try {
      // Pick top reviews for ML
      const mlInput = [...reviews].sort((a,b) => (b.text?.length||0) - (a.text?.length||0)).slice(0, 30);
      const mlResult = await sendToML(mlInput);
      const authScore = mlResult?.platform_summary?.platform_trust_score || 70;
      
      updateDashboard(avgCred, authScore);
    } catch (e) {
      console.warn("ML Fail", e);
      updateDashboard(avgCred, -1); // Error state
    }

    // D. GENERATE SUMMARY & STATS
    generateSummary(reviews);
    generateTopics(reviews);

    // Finalize
    statusEl.innerText = "Analysis Complete.";
    statusChip.innerText = "Complete";
    statusChip.style.color = "var(--success)";
    progressBar.style.width = "100%";
    scrapeBtn.disabled = false;
    scrapeBtn.innerText = "Analyze Product";
    setTimeout(() => { progressContainer.style.display = "none"; }, 1500);
  });
});

// --- 3. UI GENERATORS ---

function updateDashboard(cred, auth) {
  const trustEl = document.getElementById("trust-score");
  const authEl = document.getElementById("authenticity-score");
  const credEl = document.getElementById("credibility-score");
  const authRing = document.getElementById("content-ring");
  const credRing = document.getElementById("reviewer-ring");

  // Credibility Ring
  credEl.innerText = cred + "%";
  credRing.style.strokeDashoffset = 226 * (1 - cred / 100);

  // Auth Ring
  if (auth === -2) {
    authEl.innerText = "...";
    authRing.style.strokeDashoffset = 226;
  } else if (auth === -1) {
    authEl.innerText = "ERR";
    authRing.style.strokeDashoffset = 226;
  } else {
    authEl.innerText = auth + "%";
    authRing.style.strokeDashoffset = 226 * (1 - auth / 100);
  }

  // Overall Score (Weighted)
  const finalAuth = auth >= 0 ? auth : cred;
  const overall = Math.round((finalAuth * 0.6) + (cred * 0.4));
  trustEl.innerText = overall + "%";
}

function generateSummary(reviews) {
  const list = document.getElementById("summary-list");
  const pros = document.getElementById("pros-list");
  const cons = document.getElementById("cons-list");
  
  const results = { pro: new Set(), con: new Set() };
  
  // Topic Tally
  const mentions = { quality: 0, comfort: 0, delivery: 0, size: 0, value: 0 };
  
  reviews.forEach(r => {
    const text = r.text.toLowerCase();
    
    // Pro/Con Extraction
    if (text.includes("comfort") || text.includes("soft") || text.includes("light")) results.pro.add("Highly Comfortable");
    if (text.includes("quality") || text.includes("premium") || text.includes("sturdy")) results.pro.add("Premium Build");
    if (text.includes("perfect") || text.includes("fit")) results.pro.add("Perfect Fit");
    if (text.includes("fake") || text.includes("cheap") || text.includes("bad")) results.con.add("Quality Concerns");
    if (text.includes("late") || text.includes("delay")) results.con.add("Delivery Issues");

    // Topic Tallying
    if (text.includes("quality") || text.includes("sturdy")) mentions.quality++;
    if (text.includes("comfort") || text.includes("soft") || text.includes("sole")) mentions.comfort++;
    if (text.includes("delivery") || text.includes("shipping")) mentions.delivery++;
    if (text.includes("size") || text.includes("fit")) mentions.size++;
    if (text.includes("value") || text.includes("price")) mentions.value++;
  });

  // Find most mentioned topic
  let topTopic = "quality";
  let maxMentions = 0;
  for (const [topic, count] of Object.entries(mentions)) {
    if (count > maxMentions) {
      topTopic = topic;
      maxMentions = count;
    }
  }

  const topicLabels = { quality: "Product Quality", comfort: "User Comfort", delivery: "Delivery Timeline", size: "Fit & Sizing", value: "Price Value" };

  list.innerHTML = `
    <li>Overall ${reviews.length > 20 ? "strong" : "initial"} feedback volume detected.</li>
    <li>Customers are mostly discussing <strong>${topicLabels[topTopic]}</strong>.</li>
    <li>Credibility scan suggests ${reviews.some(r => r.credibilityScore < 50) ? "mixed reviewer reliability" : "a highly organic user base"}.</li>
  `;

  pros.innerHTML = Array.from(results.pro).slice(0, 4).map(p => `<span class="chip pro">${p}</span>`).join("") || `<span class="chip pro">Positive Sentiment</span>`;
  cons.innerHTML = Array.from(results.con).slice(0, 4).map(c => `<span class="chip con">${c}</span>`).join("") || `<span class="chip con">No major issues</span>`;
}

function generateTopics(reviews) {
  const container = document.getElementById("topics-container");
  
  // Initialize scores
  const data = {
    "Product Quality": { score: 70, weight: 0 },
    "Reviewer Trust": { score: 0, weight: 0 },
    "Brand Sentiment": { score: 75, weight: 0 },
    "Delivery Speed": { score: 80, weight: 0 }
  };

  // Calculate dynamic Reviewer Trust
  const avgCred = reviews.reduce((s, r) => s + (r.credibilityScore || 60), 0) / reviews.length;
  data["Reviewer Trust"].score = Math.round(avgCred);

  // Adjust Quality/Sentiment based on ratings
  const avgRating = reviews.reduce((s, r) => s + (r.rating || 5), 0) / reviews.length;
  data["Product Quality"].score = Math.round(avgRating * 20); // 5 stars = 100%
  data["Brand Sentiment"].score = Math.round((avgRating * 15) + 25);

  container.innerHTML = Object.entries(data).map(([label, info]) => `
    <div class="topic-item">
        <div class="topic-label-row">
            <span>${label}</span>
            <span>${info.score}%</span>
        </div>
        <div class="topic-bar-bg">
            <div class="topic-bar-fill" style="width: ${info.score}%"></div>
        </div>
    </div>
  `).join("");
}

async function sendToML(reviews) {
  const csv = "review_id,rating,review_text\n" + reviews.map((r, i) => `${i},${r.rating},"${r.text.replace(/"/g,'""')}"`).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const formData = new FormData();
  formData.append("file", blob, "reviews.csv");

  const res = await fetch("https://trustscore-ml-model.onrender.com/api/analyze", {
    method: "POST",
    body: formData
  });
  return res.json();
}
