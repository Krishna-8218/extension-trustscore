// popup.js - Phase 5 Original

const scrapeBtn = document.getElementById("scrape");

scrapeBtn.addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");

  scrapeBtn.disabled = true;
  scrapeBtn.style.opacity = "0.7";

  document.getElementById("trust-score").innerText = "--";
  document.getElementById("authenticity-score").innerText = "...";
  document.getElementById("credibility-score").innerText = "...";
  
  const contentRing = document.getElementById("content-ring");
  const reviewerRing = document.getElementById("reviewer-ring");
  contentRing.style.strokeDashoffset = 226;
  reviewerRing.style.strokeDashoffset = 226;

  statusEl.innerText = "Initializing scan...";
  progressContainer.style.display = "block";
  progressBar.style.width = "10%";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: "SCRAPE_REVIEWS" }, async (response) => {
    if (chrome.runtime.lastError || !response || !response.reviews || response.reviews.length === 0) {
      statusEl.innerText = "Still searching for reviews... Scroll down slightly if needed.";
      statusEl.style.color = "#ffa502";
      
      setTimeout(() => {
          if (statusEl.innerText.includes("Still searching")) {
             statusEl.innerText = "No reviews detected. Scroll down and click Analyze again!";
             statusEl.style.color = "#ff4757";
             scrapeBtn.disabled = false;
             scrapeBtn.style.opacity = "1";
          }
      }, 6000); 
      return;
    }

    progressBar.style.width = "30%";
    const totalReviews = response.reviews.length;
    statusEl.innerText = `Captured ${totalReviews} reviews. Scanning History...`;

    // --- DEEP SCAN FLOW (Phase 5 - 50 Reviewers) ---
    const maxScan = 50; 
    const step = Math.max(1, Math.floor(totalReviews / maxScan));
    const reviewsToScan = [];
    for (let i = 0; i < totalReviews && reviewsToScan.length < maxScan; i += step) {
        reviewsToScan.push(response.reviews[i]);
    }
    
    const updatedReviews = [...response.reviews];

    for (let i = 0; i < reviewsToScan.length; i++) {
        const review = reviewsToScan[i];
        if (review.profileUrl) {
            statusEl.innerText = `Deep Scan [${i+1}/${reviewsToScan.length}]: ${review.reviewerName}...`;
            progressBar.style.width = `${30 + (i * (40 / reviewsToScan.length))}%`;
            
            try {
                const res = await chrome.runtime.sendMessage({ action: "FETCH_HISTORY", url: review.profileUrl });
                if (res && res.history) {
                    const originalIndex = response.reviews.indexOf(review);
                    if (originalIndex !== -1) updatedReviews[originalIndex].history = res.history;
                }
            } catch (err) { console.warn("History fetch failed", err); }
        }
    }

    const enrichedReviews = calculateCredibility(updatedReviews);
    const avgCredibility = Math.round(
      enrichedReviews.reduce((sum, r) => sum + r.credibilityScore, 0) / (enrichedReviews.length || 1)
    );

    progressBar.style.width = "85%";
    statusEl.innerText = `Finalizing AI Analysis...`;

    try {
      // Show current credibility while waiting for ML
      updateUI(-2, avgCredibility);
      await new Promise(r => setTimeout(r, 100)); // Brief pause for UI thread
      // 1. SMART SAMPLE: Pick top 40 reviews by length (most data for ML to analyze)
      const mlSample = [...response.reviews]
        .sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0))
        .slice(0, 40);

      const apiResult = await sendReviewsToAPIWithRetry(mlSample);
      if (apiResult && apiResult.platform_summary) {
        const rawAuthenticity = apiResult.platform_summary.platform_trust_score;
        updateUI(rawAuthenticity, avgCredibility);
        statusEl.innerText = `Scan Complete (${totalReviews} Reviews)`;
        statusEl.style.color = "var(--success)";
      } else {
        throw new Error("Invalid API Response");
      }
    } catch (err) {
      console.warn("Final API Failure:", err);
      statusEl.innerText = err.name === 'AbortError' ? "ML Timeout (Busy Server)" : "ML Scan Offline - Using Behavioral Data";
      statusEl.style.color = "#ffa502"; 
      updateUI(-1, avgCredibility);
    }

    progressBar.style.width = "100%";
    scrapeBtn.disabled = false;
    scrapeBtn.style.opacity = "1";
    setTimeout(() => { progressContainer.style.display = "none"; }, 1500);
  });
});

let animationIntervals = { trust: null };

function updateUI(authenticity, credibility) {
  const trustScoreEl = document.getElementById("trust-score");
  const authScoreEl = document.getElementById("authenticity-score");
  const credScoreEl = document.getElementById("credibility-score");
  const contentRing = document.getElementById("content-ring");
  const reviewerRing = document.getElementById("reviewer-ring");

  // Show base credibility as trust score while waiting/loading
  let finalTrustScore = credibility; 
  if (authenticity >= 0) {
    finalTrustScore = Math.round((authenticity * 0.6) + (credibility * 0.4));
  }

  animateScore(trustScoreEl, "trust", finalTrustScore);

  // Authenticity Ring
  if (authenticity >= 0) {
    authScoreEl.innerText = authenticity + "%";
    authScoreEl.style.color = "#fff";
    contentRing.style.strokeDashoffset = 226 * (1 - authenticity / 100);
  } else if (authenticity === -2) {
    authScoreEl.innerText = "...";
    authScoreEl.style.color = "#ffa502";
    contentRing.style.strokeDashoffset = 226;
  } else {
    authScoreEl.innerText = "ERR";
    authScoreEl.style.color = "#ff4757";
    contentRing.style.strokeDashoffset = 226;
  }
  
  // Credibility Ring
  if (credibility >= 0) {
    credScoreEl.innerText = credibility + "%";
    reviewerRing.style.strokeDashoffset = 226 * (1 - credibility / 100);
  } else {
    credScoreEl.innerText = "...";
  }
}

function animateScore(element, type, end) {
  if (animationIntervals[type]) clearInterval(animationIntervals[type]);
  
  let current = parseInt(element.innerText) || 0;
  const target = end;
  
  if (current === target) {
    element.innerText = target + "%";
    return;
  }

  const duration = 800;
  const steps = Math.abs(target - current) || 1;
  const stepTime = Math.max(10, Math.floor(duration / steps));

  animationIntervals[type] = setInterval(() => {
    if (current < target) current++;
    else if (current > target) current--;
    
    element.innerText = current + "%";
    
    if (current === target) {
      clearInterval(animationIntervals[type]);
      animationIntervals[type] = null;
    }
  }, stepTime);
}

function convertReviewsToCSV(reviews) {
  let csv = "review_id,seller_id,rating,review_text,review_date\n";
  reviews.forEach((r, index) => {
    const textValue = String(r.text || "").replace(/"/g, '""').replace(/\r?\n|\r/g, " ").trim();
    csv += `${index},demo_seller,${r.rating || 5},"${textValue}",2024-01-01\n`;
  });
  return csv;
}

async function sendReviewsToAPIWithRetry(reviews, retries = 1) {
  const statusEl = document.getElementById("status");
  for (let i = 0; i <= retries; i++) {
    try {
      if (i > 0) statusEl.innerText = `AI Service Busy... Retrying (${i}/${retries})`;
      
      const csv = convertReviewsToCSV(reviews);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const formData = new FormData();
      formData.append("file", blob, "reviews.csv");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); 

      const response = await fetch("https://trustscore-ml-model.onrender.com/api/analyze", {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn(`API Attempt ${i + 1} failed:`, error);
      if (i === retries) throw error;
      await new Promise(r => setTimeout(r, 1500)); 
    }
  }
}
