console.log("Content script running");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === "SCRAPE_REVIEWS") {

    try {

      const host = window.location.hostname;

      let reviews = [];

      /* =========================
         MYNTRA SCRAPER
      ========================= */

      if (host.includes("myntra")) {

        const reviewBlocks = document.querySelectorAll(".user-review-reviewTextWrapper");

        reviewBlocks.forEach(el => {
          const text = el.innerText.trim();
          const parent = el.closest(".user-review-main");
          const nameEl = parent ? parent.querySelector(".user-review-userName") : null;
          const name = nameEl ? nameEl.innerText.trim() : "Anonymous";
          // Capture profile link if it exists
          const profileUrl = nameEl && nameEl.closest("a") ? nameEl.closest("a").href : null;
          const ratingElement = parent ? parent.querySelector(".user-review-rating") : null;
          const rating = ratingElement ? parseInt(ratingElement.innerText) : 5;
          const date = parent ? parent.querySelector(".user-review-date")?.innerText.trim() : null;

          if (text) {
            reviews.push({ text, reviewerName: name, rating, date, profileUrl });
          }
        });

      }

      /* =========================
         MEESHO SCRAPER
      ========================= */

      else if (host.includes("meesho")) {

        const reviewElements =
          document.querySelectorAll('[class*="Comment__CommentText"]');

        reviewElements.forEach(el => {

          const text = el.innerText.trim();

          if (text) {
            reviews.push(text);
          }

        });

      }
      else if (host.includes("flipkart")) {
        // 1. PRIMARY: Look for modern review blocks via partial class matches
        let blocks = document.querySelectorAll('div[class*="XVM_io"], div[class*="_27M-uM"], div[class*="col _2w1uU_"]');
        
        if (blocks.length === 0) {
            // 2. SECONDARY: Look for anything containing "Verified Purchase" or star ratings
            const allDivs = document.querySelectorAll('div');
            const potentialBlocks = [];
            allDivs.forEach(d => {
                if (d.innerText.includes("Verified Purchase") && d.childElementCount > 2) {
                    potentialBlocks.push(d.parentElement);
                }
            });
            blocks = potentialBlocks.length > 0 ? potentialBlocks : blocks;
        }

        blocks.forEach(block => {
          // Robust text selection
          const textElements = block.querySelectorAll('div, span');
          let text = "";
          let maxLen = 0;
          textElements.forEach(te => {
              if (te.innerText.length > maxLen && te.childElementCount === 0) {
                  maxLen = te.innerText.length;
                  text = te.innerText.trim();
              }
          });

          const nameEl = block.querySelector('p[class*="_2sc77"], p[class*="_2V5E9v"], ._2V5E9v');
          const name = nameEl ? nameEl.innerText.trim() : "Anonymous";
          const profileLink = block.querySelector('a[href*="/profile/"]');
          const profileUrl = profileLink ? profileLink.href : null;
          
          const ratingEl = block.querySelector('div[class*="_3LWZlK"], div[class*="_31v8Ym"]');
          const rating = ratingEl ? parseInt(ratingEl.innerText) : 5;

          if (text && text.length > 5 && !reviews.some(r => r.text === text)) {
            reviews.push({ text, reviewerName: name, rating, profileUrl });
          }
        });

        // 3. CATCH-ALL: Aggressive fallback
        if (reviews.length === 0) {
            const stars = document.querySelectorAll('div[class*="_3LWZlK"]');
            stars.forEach(s => {
                const parent = s.closest('div[class*="col"]');
                if (parent) {
                    const text = parent.innerText.split('\n').find(t => t.length > 20);
                    if (text) reviews.push({ text: text.trim(), reviewerName: "Verified User", rating: parseInt(s.innerText) || 5 });
                }
            });
        }
      }
      else if (host.includes("makemytrip")) {

        const reviewElements = document.querySelectorAll("p.reviewText");

        reviewElements.forEach(el => {

            const text = el.innerText.trim();

            if (text) {
            reviews.push(text);
            }

        });

      }
      /* AMAZON */

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
          const date = block.querySelector('[data-hook="review-date"]')?.innerText.trim();

          if (text) {
            reviews.push({ text, reviewerName: name, rating, date, profileUrl });
          }
        });

        }
                /* AJIO */

        else if (host.includes("ajio")) {

        const reviewElements =
            document.querySelectorAll(".pdp-review__comment");

        reviewElements.forEach(el => {

            const text = el.innerText.trim();

            if (text) {
            reviews.push(text);
            }

        });

        }
        /* NYKAA */

        else if (host.includes("nykaa")) {

        const reviewElements =
            document.querySelectorAll("p.css-1n0nrdk");

        reviewElements.forEach(el => {

            const text = el.innerText.trim();

            if (text) {
            reviews.push(text);
            }

        });

        }
        /* SNAPDEAL */

        else if (host.includes("snapdeal")) {

        const reviewElements = document.querySelectorAll(".user-review p");

        reviewElements.forEach(el => {

            let text = el.innerText.trim();

            /* remove Verified Buyer */
            text = text.replace(/Verified Buyer/gi, "");

            /* remove extra new lines */
            text = text.replace(/\n+/g, " ").trim();

            /* ignore short text */
            if (text.length > 20) {
            reviews.push(text);
            }

        });

        /* remove duplicates */
        reviews = [...new Set(reviews)];

        }
        /* ZOMATO */

        else if (host.includes("zomato")) {

        const reviewElements = document.querySelectorAll("p");

        reviewElements.forEach(el => {

            const text = el.innerText.trim();

            if (
            text.length > 20 &&
            !text.includes("Votes") &&
            !text.includes("Comments") &&
            !text.includes("Create account") &&
            !text.includes("Reviews are better")
            ) {
            reviews.push(text);
            }

        });

        }
                /* SWIGGY */

        else if (host.includes("swiggy")) {

        const reviewElements =
            document.querySelectorAll("p._1n2p3");

        reviewElements.forEach(el => {

            const text = el.innerText.trim();

            if (text) {
            reviews.push(text);
            }

        });

        }

      sendResponse({ reviews: reviews });

    } catch (err) {

      console.error(err);

      sendResponse({ reviews: [] });

    }

  }

  return true;

});