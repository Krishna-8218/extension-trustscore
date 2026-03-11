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

        const reviewElements =
          document.querySelectorAll(".user-review-reviewTextWrapper");

        reviewElements.forEach(el => {

          const text = el.innerText.trim();

          if (text) {
            reviews.push(text);
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

        const reviewElements = document.querySelectorAll("span.css-1qaijid");

        reviewElements.forEach(el => {

            const text = el.innerText.trim();

            if (text) {
            reviews.push(text);
            }

        });

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

        const reviewElements =
            document.querySelectorAll('span[data-hook="review-body"]');

        reviewElements.forEach(el => {

            const text = el.innerText.trim();

            if (text) {
            reviews.push(text);
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