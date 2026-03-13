chrome.runtime.onInstalled.addListener(() => {
  console.log("Review Scraper Installed");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "FETCH_HISTORY") {
    fetchReviewerHistory(request.url)
      .then(history => sendResponse({ history }))
      .catch(err => {
        console.error("Background fetch error:", err);
        sendResponse({ history: null });
      });
    return true; // Keep channel open for async response
  }
});

async function fetchReviewerHistory(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    
    // Note: DOMParser is NOT available in Service Workers, so we use regex for extraction.
    // Actually, we can use regex for basic stats extraction to avoid the complexity of offscreen documents
    
    let totalReviews = 0;
    let avgRating = 0;

    if (url.includes("amazon")) {
      const match = html.match(/"totalReviewCount":(\d+)/) || html.match(/(\d+)\s*(?:global\s*)?reviews/i);
      totalReviews = match ? parseInt(match[1]) : 0;
      const rateMatch = html.match(/"averageRating":(\d+\.?\d*)/);
      avgRating = rateMatch ? parseFloat(rateMatch[1]) : 4.5;
    } else if (url.includes("myntra")) {
      const match = html.match(/user-profile-statValue">(\d+)/) || html.match(/"totalReviews":(\d+)/);
      totalReviews = match ? parseInt(match[1]) : 0;
      // Myntra profile doesn't show avg rating easily, we infer from recent stars if possible or default to a "suspicious high" if unknown
      avgRating = 4.8; 
    } else if (url.includes("flipkart")) {
        const match = html.match(/_2V5E9v">(\d+)/) || html.match(/"reviewCount":(\d+)/) || html.match(/(\d+)\s*Reviews/);
        totalReviews = match ? parseInt(match[1]) : 0;
        const rateMatch = html.match(/_2cy7U_">(\d+\.?\d*)/) || html.match(/"averageRating":(\d+\.?\d*)/);
        avgRating = rateMatch ? parseFloat(rateMatch[1]) : 4.0;
    }

    console.log(`Fetched history for ${url}:`, { totalReviews, avgRating });

    return { totalReviews, avgRating };
  } catch (e) {
    console.error("Deep Scan Error for URL:", url, e);
    return null;
  }
}