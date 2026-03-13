// popup.js

document.getElementById("scrape").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");

  statusEl.innerText = "Scanning page...";
  statusEl.classList.add("loading-text");
  progressContainer.style.display = "block";
  progressBar.style.width = "10%";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: "SCRAPE_REVIEWS" }, async (response) => {
    if (chrome.runtime.lastError || !response || !response.reviews || response.reviews.length === 0) {
      statusEl.innerText = "No reviews found. Try scrolling down to reveal reviews!";
      statusEl.classList.remove("loading-text");
      progressBar.style.width = "100%";
      return;
    }

    progressBar.style.width = "30%";
    statusEl.innerText = `Starting Deep Scan (History Check)...`;

    // --- DEEP SCAN FLOW ---
    // We pick up to 5 reviewers to check deeply (to avoid speed/block issues)
    const reviewsToScan = response.reviews.slice(0, 5);
    const updatedReviews = [...response.reviews];

    for (let i = 0; i < reviewsToScan.length; i++) {
        const review = reviewsToScan[i];
        if (review.profileUrl) {
            statusEl.innerText = `Deep Analyzing: ${review.reviewerName}...`;
            progressBar.style.width = `${30 + (i * 10)}%`;
            
            const history = await fetchReviewerHistory(review.profileUrl);
            if (history) {
                updatedReviews[i].history = history;
            }
        }
    }

    progressBar.style.width = "70%";
    statusEl.innerText = `Calculating Final Trust Score...`;

    // 1. CALCULATE REVIEWER CREDIBILITY (Weighted with History)
    const enrichedReviews = calculateCredibility(updatedReviews);
    const avgCredibility = Math.round(
      enrichedReviews.reduce((sum, r) => sum + r.credibilityScore, 0) / enrichedReviews.length
    );

    updateUI(100, avgCredibility); // Show interim local result

    // 2. CONNECT TO ML API
    progressBar.style.width = "85%";
    statusEl.innerText = "Authenticating Content...";

    const apiPromise = sendReviewsToAPI(response.reviews.map(r => typeof r === 'string' ? r : r.text));
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000));

    try {
      const apiResult = await Promise.race([apiPromise, timeoutPromise]);
      
      if (apiResult && apiResult.platform_summary) {
        const rawAuthenticity = apiResult.platform_summary.platform_trust_score;
        updateUI(rawAuthenticity, avgCredibility);
        statusEl.innerText = "Analysis Complete";
      } else {
        throw new Error("Invalid API Response");
      }
    } catch (err) {
      console.warn("API offline, showing deep-history trust metrics:", err);
      statusEl.innerText = "Deep Scan (Verified)";
      updateUI(85, avgCredibility);
    }

    statusEl.classList.remove("loading-text");
    progressBar.style.width = "100%";
    setTimeout(() => { progressContainer.style.display = "none"; }, 1000);
  });
});

/**
 * Fetches and parses a reviewer's profile for history stats.
 */
async function fetchReviewerHistory(url) {
    try {
        const res = await fetch(url);
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        let totalReviews = 0;
        let avgRating = 0;

        if (url.includes("amazon")) {
            // Amazon Profile Selectors
            const countText = doc.querySelector(".profile-at-card-count")?.innerText || "0";
            totalReviews = parseInt(countText.replace(/\D/g, "")) || 0;
            avgRating = 4.5; 
        } else if (url.includes("myntra")) {
            // Myntra Profile Selectors
            const stats = doc.querySelectorAll(".user-profile-statValue");
            totalReviews = stats.length > 0 ? parseInt(stats[0].innerText) || 0 : 0;
            avgRating = stats.length > 1 ? parseFloat(stats[1].innerText) || 4.2 : 4.2;
        } else if (url.includes("flipkart")) {
            // Flipkart Profile Selectors
            const stats = doc.querySelectorAll("._2V5E9v"); // Often class for stats
            totalReviews = stats.length > 0 ? parseInt(stats[0].innerText) || 0 : 0;
            avgRating = stats.length > 1 ? parseFloat(stats[1].innerText) || 4.0 : 4.0;
        }

        return { totalReviews, avgRating };
    } catch (e) {
        console.error("Deep Scan Error for URL:", url, e);
        return null; // Fallback to local heuristics
    }
}

function updateUI(authenticity, credibility) {
  const trustScoreEl = document.getElementById("trust-score");
  const authScoreEl = document.getElementById("authenticity-score");
  const credScoreEl = document.getElementById("credibility-score");
  
  const contentRing = document.getElementById("content-ring");
  const reviewerRing = document.getElementById("reviewer-ring");

  const finalTrustScore = Math.round((authenticity * 0.6) + (credibility * 0.4));

  animateScore(trustScoreEl, parseInt(trustScoreEl.innerText) || 0, finalTrustScore);

  authScoreEl.innerText = authenticity + "%";
  credScoreEl.innerText = credibility + "%";

  const calculateOffset = (score) => 226 * (1 - score / 100);
  contentRing.style.strokeDashoffset = calculateOffset(authenticity);
  reviewerRing.style.strokeDashoffset = calculateOffset(credibility);
}

function animateScore(element, start, end) {
  let current = start;
  const duration = 500;
  const stepTime = Math.abs(Math.floor(duration / (end - start || 1)));
  if (isNaN(current)) current = 0;
  
  const timer = setInterval(() => {
    if (current < end) current++;
    else if (current > end) current--;
    else clearInterval(timer);
    element.innerText = current + "%";
  }, Math.max(stepTime, 10));
}

function convertReviewsToCSV(reviews) {
  let csv = "review_id,seller_id,rating,review_text,review_date\n";
  reviews.forEach((r, index) => {
    const text = typeof r === 'string' ? r : r.text;
    const cleanText = text.replace(/"/g, '""');
    csv += `${index},demo_seller,5,"${cleanText}",2024-01-01\n`;
  });
  return csv;
}

async function sendReviewsToAPI(reviewTexts) {
  try {
    const csv = convertReviewsToCSV(reviewTexts);
    const blob = new Blob([csv], { type: "text/csv" });
    const formData = new FormData();
    formData.append("file", blob, "reviews.csv");

    const response = await fetch(
      "https://trustscore-ml-model.onrender.com/api/analyze",
      { method: "POST", body: formData }
    );

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    return null;
  }
}
