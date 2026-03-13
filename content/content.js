console.log("Content script running");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === "SCRAPE_REVIEWS") {
    
    // Use an async function inside the listener to handle loading
    (async () => {
      try {
        const host = window.location.hostname;
        
        // --- 1. AUTOMATED LOADING ---
        await loadAllReviews(host);

        let reviews = [];

        /* =========================
           MYNTRA SCRAPER
        ========================= */

        if (host.includes("myntra")) {
          const reviewBlocks = document.querySelectorAll('.user-review-main, [class^="detailed-reviews-user-review"], .user-review-reviewTextWrapper');
          
          reviewBlocks.forEach(el => {
            const textEl = el.querySelector('.user-review-reviewTextWrapper, [class^="detailed-reviews-reviewText"]') || el;
            const text = textEl.innerText.trim();
            
            const parent = el.closest('.user-review-main, .detailed-reviews-user-review') || el;
            const nameEl = parent.querySelector('.user-review-userName, [class^="detailed-reviews-userName"], .user-review-left + span');
            const name = nameEl ? nameEl.innerText.trim() : "Verified Buyer";
            
            const profileLinkEl = nameEl && nameEl.closest('a') ? nameEl.closest('a') : parent.querySelector('a[href*="/user-profile/"]');
            const profileUrl = profileLinkEl ? profileLinkEl.href : null;
            const ratingEl = parent.querySelector('.user-review-rating, [class^="detailed-reviews-rating"]');
            const rating = ratingEl ? parseInt(ratingEl.innerText) : 5;
            
            const dateEl = parent.querySelector('.user-review-left + span + span, [class^="detailed-reviews-date"]');
            const dateStr = dateEl ? dateEl.innerText.trim() : null;

            if (text && text.length > 5 && !reviews.some(r => r.text === text)) {
              reviews.push({ text, reviewerName: name, rating, profileUrl, date: dateStr });
            }
          });
        }

        /* =========================
           FLIPKART SCRAPER
        ========================= */
        else if (host.includes("flipkart")) {
          const reviewBlocks = document.querySelectorAll('div[class*="col._2w1uU_"], div[class*="XVM_io"], div[class*="_27M-uM"], div[class*="XVM-io"]');
          
          reviewBlocks.forEach(block => {
            const textEl = block.querySelector('div[class*="t-ZTKy"], ._6K-vST, [class*="XVM_io"] div, .Z_3No0');
            let text = textEl ? textEl.innerText.trim().replace(/READ MORE/g, "").replace(/\n/g, " ") : "";
            
            if (!text || text.length < 5) {
               const allDivs = block.querySelectorAll('div');
               text = Array.from(allDivs).reduce((max, d) => d.innerText.length > max.length ? d.innerText : max, "").trim();
            }

            const nameEl = block.querySelector('p[class*="_2sc77"], p[class*="_2V5E9v"], ._2V5E9v, ._2Ns8vY, ._3LYOAd');
            const name = nameEl ? nameEl.innerText.trim() : "Verified Buyer";
            
            const profileLink = block.querySelector('a[href*="/profile/"]');
            const profileUrl = profileLink ? (profileLink.href.startsWith('http') ? profileLink.href : window.location.origin + profileLink.getAttribute('href')) : null;
            
            const ratingEl = block.querySelector('div[class*="_3LWZlK"], div[class*="_31v8Ym"]');
            const rating = ratingEl ? parseInt(ratingEl.innerText) : 5;
            
            const dateEl = block.querySelector('p[class*="_2sc77"] + p, ._3n-S69, ._2V5E9v + p');
            const dateStr = dateEl ? dateEl.innerText.trim() : null;

            if (text && text.length > 5 && !reviews.some(r => r.text === text)) {
              reviews.push({ text, reviewerName: name, rating, profileUrl, date: dateStr });
            }
          });
        }
        
        // --- OTHER SCRAPERS (MEESHO, AMAZON, ETC.) ---
        else if (host.includes("amazon")) {
          const reviewBlocks = document.querySelectorAll('div[data-hook="review"]');
          reviewBlocks.forEach(block => {
            const text = block.querySelector('[data-hook="review-body"]')?.innerText.trim();
            const profileLinkEl = block.querySelector(".a-profile");
            const name = profileLinkEl?.innerText.trim() || "Anonymous";
            const profileUrl = profileLinkEl?.href || null;
            const ratingClasses = block.querySelector('[data-hook="review-star-rating"]')?.className;
            const ratingMatch = ratingClasses ? ratingClasses.match(/a-star-(\d)/) : null;
            const rating = ratingMatch ? parseInt(ratingMatch[1]) : 5;
            if (text) reviews.push({ text, reviewerName: name, rating, profileUrl });
          });
        }
        else if (host.includes("snapdeal")) {
          const reviewElements = document.querySelectorAll(".user-review");
          reviewElements.forEach(el => {
            const textEl = el.querySelector("p");
            if (!textEl) return;
            let text = textEl.innerText.trim().replace(/Verified Buyer/gi, "").replace(/\n+/g, " ").trim();
            const name = el.querySelector(".user-name")?.innerText.trim() || "Snapdeal User";
            if (text.length > 20) reviews.push({ text, reviewerName: name, rating: 5, profileUrl: null });
          });
        }

        sendResponse({ reviews: reviews });

      } catch (err) {
        console.error(err);
        sendResponse({ reviews: [] });
      }
    })();

    return true; // Keep channel open
  }
});

async function loadAllReviews(host) {
  console.log("Starting aggressive review loading...");
  
  // 1. Aggressive Initial Search: If we are at the top, scroll to find the review section
  const reviewHeaders = document.querySelectorAll('h1, h2, h3, span, div');
  const reviewKeywords = ["Reviews", "Ratings", "Customer Reviews", "Verified Buyers"];
  let reviewSectionAnchor = null;

  for (const header of reviewKeywords) {
      const match = Array.from(reviewHeaders).find(el => el.innerText.includes(header) && el.offsetParent !== null);
      if (match) {
          reviewSectionAnchor = match;
          break;
      }
  }

  if (reviewSectionAnchor) {
      console.log("Found review section anchor, scrolling...");
      reviewSectionAnchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(r => setTimeout(r, 1000));
  } else if (window.scrollY < 500) {
      console.log("No anchor found, performing blind scroll to wake up lazy-loader...");
      window.scrollTo(0, 2500); // Typical review section depth
      await new Promise(r => setTimeout(r, 1200));
  }

  // 1. Detect Target Count from UI
  let targetCount = 30; // Default fallback
  try {
    const selectors = {
      myntra: ['.user-review-title', '.user-review-count', '.customer-reviews-title', '[class*="detailed-reviews-title"]'],
      flipkart: ['span[class*="_2_R_DZ"]', '._2RngDP', '.row._2af86k span:last-child', '._2-uX6L', '[class*="XVM_io"] span']
    };

    const siteKey = host.includes("myntra") ? "myntra" : host.includes("flipkart") ? "flipkart" : null;
    if (siteKey) {
        for (const sel of selectors[siteKey]) {
            const el = document.querySelector(sel);
            if (el) {
                const match = el.innerText.match(/\((\d+)\)/) || el.innerText.match(/(\d+)/);
                if (match) {
                    targetCount = parseInt(match[1]);
                    break;
                }
            }
        }
    }
  } catch (e) { console.warn("Failed to detect target count", e); }

  console.log(`Detected target review count: ${targetCount}`);

  let lastCount = 0;
  let stagnantCycles = 0;

  for (let i = 0; i < 20; i++) { // Increased to 20 cycles
    const selectors = [
      '.user-review-main', '[class^="detailed-reviews-user-review"]', '.user-review-reviewTextWrapper',
      'div[class*="col._2w1uU_"]', 'div[class*="XVM_io"]', 'div[data-hook="review"]'
    ];
    const currentReviews = document.querySelectorAll(selectors.join(','));
    const currentCount = currentReviews.length;
    
    console.log(`Cycle ${i}: Found ${currentCount}/${targetCount} reviews`);
    
    if (currentCount >= targetCount && targetCount > 0) {
      console.log("Reached target count, stopping.");
      break;
    }
    
    if (currentCount === lastCount) {
      stagnantCycles++;
      // If we found NO reviews at all, be very patient (wait for lazy load)
      const maxStagnant = currentCount === 0 ? 4 : 2; 
      if (stagnantCycles >= maxStagnant) {
        console.log(`No new reviews found after ${stagnantCycles} cycles, stopping.`);
        break;
      }
    } else {
      stagnantCycles = 0;
    }
    lastCount = currentCount;

    // Detect and Click "Load More" / "View All"
    const clickSelectors = [
      '.user-review-reviewTextWrapper + div span', 
      '._27M-uM + div span', 
      '.detailed-reviews-allReviews',
      'button[class*="load-more"]',
      'span[class*="show-more"]',
      'a[href*="product-reviews"]'
    ];
    
    let clicked = false;
    for (const selector of clickSelectors) {
      const btn = document.querySelector(selector);
      if (btn && btn.offsetParent !== null) {
        btn.click();
        clicked = true;
        break;
      }
    }
    
    // Aggressive stepped scroll to trigger stubborn lazy loading
    for (let j = 0; j < 3; j++) {
        window.scrollBy(0, 400);
        await new Promise(r => setTimeout(r, 300));
    }
    
    // If we've scrolled a lot but still see nothing, try a very deep scroll once
    if (currentCount === 0 && i === 1) {
      window.scrollTo(0, 4000);
      await new Promise(r => setTimeout(r, 800));
    }
  }
}