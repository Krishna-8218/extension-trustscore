console.log("TrustScore Unified Scraper running");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SCRAPE_REVIEWS") {
    (async () => {
      try {
        const host = window.location.hostname;
        await loadAllReviews(host);

        let reviews = [];

        // --- 1. MYNTRA ---
        if (host.includes("myntra")) {
          const blocks = document.querySelectorAll('.user-review-main, [class^="detailed-reviews-user-review"], .user-review-reviewTextWrapper');
          blocks.forEach(el => {
            const textEl = el.querySelector('.user-review-reviewTextWrapper, [class^="detailed-reviews-reviewText"]') || el;
            const parent = el.closest('.user-review-main, .detailed-reviews-user-review') || el;
            const nameEl = parent.querySelector('.user-review-userName, [class^="detailed-reviews-userName"], .user-review-left + span');
            const profileLinkEl = nameEl && nameEl.closest('a') ? nameEl.closest('a') : parent.querySelector('a[href*="/user-profile/"]');
            const ratingEl = parent.querySelector('.user-review-rating, [class^="detailed-reviews-rating"]');
            
            const text = textEl.innerText.trim();
            if (text && text.length > 5 && !reviews.some(r => r.text === text)) {
              reviews.push({
                text,
                reviewerName: nameEl ? nameEl.innerText.trim() : "Verified Buyer",
                rating: ratingEl ? parseInt(ratingEl.innerText) : 5,
                profileUrl: profileLinkEl ? profileLinkEl.href : null
              });
            }
          });
        }
        // --- 2. FLIPKART ---
        else if (host.includes("flipkart")) {
          // Broadened selectors for Flipkart's changing class names
          const blocks = document.querySelectorAll('div[class*="col._2w1uU_"], div[class*="XVM_io"], div[class*="_27M-uM"], div[class*="XVM-io"], div[class*="EKo_a_"], div[class*="RcXBOT"], div[class*="Zmyqqu"]');
          blocks.forEach(block => {
            const textEl = block.querySelector('div[class*="t-ZTKy"], ._6K-vST, [class*="XVM_io"] div, .Z_3No0, div[class*="Zmyqqu"], div[class*="yH_9y2"]');
            const text = textEl ? textEl.innerText.trim().replace(/READ MORE/g, "").replace(/\n/g, " ") : "";
            const nameEl = block.querySelector('p[class*="_2sc77"], p[class*="_2V5E9v"], ._2V5E9v, ._2Ns8vY, ._3LYOAd, p[class*="_2Ns8vY"]');
            const profileLink = block.querySelector('a[href*="/profile/"]');
            const ratingEl = block.querySelector('div[class*="_3LWZlK"], div[class*="_31v8Ym"], div[class*="XQDdHH"]');

            if (text && text.length > 5 && !reviews.some(r => r.text === text)) {
              reviews.push({
                text,
                reviewerName: nameEl ? nameEl.innerText.trim() : "Verified Buyer",
                rating: ratingEl ? parseInt(ratingEl.innerText) : 5,
                profileUrl: profileLink ? (profileLink.href.startsWith('http') ? profileLink.href : window.location.origin + profileLink.getAttribute('href')) : null
              });
            }
          });
        }
        // --- 3. AMAZON ---
        else if (host.includes("amazon")) {
          const blocks = document.querySelectorAll('div[data-hook="review"]');
          blocks.forEach(block => {
            const textEl = block.querySelector('[data-hook="review-body"]');
            const text = textEl ? textEl.innerText.trim() : "";
            const profileLinkEl = block.querySelector(".a-profile");
            const ratingClasses = block.querySelector('[data-hook="review-star-rating"]')?.className;
            const ratingMatch = ratingClasses ? ratingClasses.match(/a-star-(\d)/) : null;

            if (text && text.length > 5) {
              reviews.push({
                text,
                reviewerName: profileLinkEl?.innerText.trim() || "Anonymous",
                rating: ratingMatch ? parseInt(ratingMatch[1]) : 5,
                profileUrl: profileLinkEl?.href || null
              });
            }
          });
        }
        // --- 4. MEESHO ---
        else if (host.includes("meesho")) {
          const blocks = document.querySelectorAll('div[class*="Comment__CommentContainer"]');
          blocks.forEach(block => {
            const textEl = block.querySelector('div[class*="Comment__CommentText"]');
            const nameEl = block.querySelector('span[class*="Comment__CommenterName"]');
            const ratingEl = block.querySelectorAll('svg[class*="Star__StarIcon"]').length; // Simple count

            if (textEl) {
              reviews.push({
                text: textEl.innerText.trim(),
                reviewerName: nameEl ? nameEl.innerText.trim() : "Meesho Buyer",
                rating: ratingEl || 5,
                profileUrl: null
              });
            }
          });
        }
        // --- 5. SNAPDEAL ---
        else if (host.includes("snapdeal")) {
          const blocks = document.querySelectorAll(".user-review");
          blocks.forEach(el => {
            const textEl = el.querySelector("p");
            if (textEl) {
              const text = textEl.innerText.trim().replace(/Verified Buyer/gi, "").replace(/\n+/g, " ").trim();
              const name = el.querySelector(".user-name")?.innerText.trim() || "Snapdeal User";
              if (text.length > 20) reviews.push({ text, reviewerName: name, rating: 5, profileUrl: null });
            }
          });
        }

        sendResponse({ reviews });
      } catch (err) {
        console.error("Scrape Error:", err);
        sendResponse({ reviews: [] });
      }
    })();
    return true;
  }
});

async function loadAllReviews(host) {
  console.log("Triggering aggressive load...");
  
  // 1. Initial Deep Scroll to wake up page
  if (window.scrollY < 500) {
      window.scrollTo(0, 3000); 
      await new Promise(r => setTimeout(r, 1200));
  }

  let targetCount = 30; // Fallback
  try {
    const selectors = {
      myntra: ['.user-review-title', '.user-review-count', '.customer-reviews-title', '[class*="detailed-reviews-title"]'],
      flipkart: ['span[class*="_2_R_DZ"]', '._2RngDP', '.row._2af86k span:last-child', '._2-uX6L', '[class*="XVM_io"] span']
    };
    const platform = host.includes("myntra") ? "myntra" : host.includes("flipkart") ? "flipkart" : null;
    if (platform) {
        for (const sel of selectors[platform]) {
            const el = document.querySelector(sel);
            if (el) {
                const match = el.innerText.match(/\((\d+)\)/) || el.innerText.match(/(\d+)/);
                if (match) { targetCount = parseInt(match[1]); break; }
            }
        }
    }
  } catch (e) {}

  let lastCount = 0;
  for (let i = 0; i < 15; i++) {
    const currentCount = document.querySelectorAll('.user-review-main, [class^="detailed-reviews-user-review"], div[class*="col._2w1uU_"], div[class*="XVM_io"]').length;
    if (currentCount >= targetCount && targetCount > 0) break;
    if (currentCount === lastCount && i > 3) break;
    lastCount = currentCount;

    // Stepped scroll to trigger lazy-load
    for (let j = 0; j < 3; j++) {
        window.scrollBy(0, 400);
        await new Promise(r => setTimeout(r, 300));
    }

    const clickSelectors = ['.user-review-reviewTextWrapper + div span', '._27M-uM + div span', 'button[class*="load-more"]', '.detailed-reviews-allReviews', 'a[href*="product-reviews"]'];
    for (const sel of clickSelectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null) { btn.click(); break; }
    }
  }
}