console.log("Content script running");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SCRAPE_REVIEWS") {
    (async () => {
      try {
        const host = window.location.hostname;
        
        // --- 1. AUTOMATED LOADING ---
        await loadAllReviews(host);

        let reviews = [];

        // BROAD SELECTORS (Handles multiple versions of Myntra/Flipkart)
        const myntraSelectors = '.user-review-main, [class^="detailed-reviews-user-review"], .user-review-reviewTextWrapper';
        const flipkartSelectors = 'div[class*="col._2w1uU_"], div[class*="XVM_io"], div[class*="_27M-uM"], div[class*="XVM-io"]';

        if (host.includes("myntra")) {
          const reviewBlocks = document.querySelectorAll(myntraSelectors);
          reviewBlocks.forEach(el => {
            const textEl = el.querySelector('.user-review-reviewTextWrapper, [class^="detailed-reviews-reviewText"]') || el;
            const text = textEl.innerText.trim();
            const parent = el.closest('.user-review-main, .detailed-reviews-user-review') || el;
            const nameEl = parent.querySelector('.user-review-userName, [class^="detailed-reviews-userName"]');
            const name = nameEl ? nameEl.innerText.trim() : "Verified Buyer";
            const profileLinkEl = parent.querySelector('a[href*="/user-profile/"]');
            const profileUrl = profileLinkEl ? profileLinkEl.href : null;
            const ratingEl = parent.querySelector('.user-review-rating, [class^="detailed-reviews-rating"]');
            const rating = ratingEl ? parseInt(ratingEl.innerText) : 5;

            if (text && text.length > 5 && !reviews.some(r => r.text === text)) {
              reviews.push({ text, reviewerName: name, rating, profileUrl });
            }
          });
        }
        else if (host.includes("flipkart")) {
          const reviewBlocks = document.querySelectorAll(flipkartSelectors);
          reviewBlocks.forEach(block => {
            const textEl = block.querySelector('div[class*="t-ZTKy"], ._6K-vST, [class*="XVM_io"] div, .Z_3No0');
            let text = textEl ? textEl.innerText.trim().replace(/READ MORE/g, "").replace(/\n/g, " ") : "";
            const nameEl = block.querySelector('p[class*="_2sc77"], p[class*="_2V5E9v"], ._2V5E9v, ._2Ns8vY');
            const name = nameEl ? nameEl.innerText.trim() : "Verified Buyer";
            const profileLink = block.querySelector('a[href*="/profile/"]');
            const profileUrl = profileLink ? (profileLink.href.startsWith('http') ? profileLink.href : window.location.origin + profileLink.getAttribute('href')) : null;
            const ratingEl = block.querySelector('div[class*="_3LWZlK"], div[class*="_31v8Ym"]');
            const rating = ratingEl ? parseInt(ratingEl.innerText) : 5;

            if (text && text.length > 5 && !reviews.some(r => r.text === text)) {
              reviews.push({ text, reviewerName: name, rating, profileUrl });
            }
          });
        }

        sendResponse({ reviews: reviews });
      } catch (err) {
        console.error(err);
        sendResponse({ reviews: [] });
      }
    })();
    return true;
  }
});

async function loadAllReviews(host) {
  console.log("Starting aggressive review loading...");
  
  // 1. Initial Deep Scroll to trigger lazy elements
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
                if (match) { 
                    targetCount = parseInt(match[1]); 
                    console.log(`Detected target count: ${targetCount}`);
                    break; 
                }
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

    const clickSelectors = ['.user-review-reviewTextWrapper + div span', '._27M-uM + div span', 'button[class*="load-more"]', '.detailed-reviews-allReviews'];
    for (const sel of clickSelectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null) { btn.click(); break; }
    }
  }
}