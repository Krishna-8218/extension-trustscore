// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "FETCH_HISTORY") {
    fetch(request.url)
      .then(res => res.text())
      .then(html => {
        const history = [];
        
        // Simple extraction for Myntra/Flipkart profiles
        if (request.url.includes("myntra")) {
          // Detect multiple reviews in activity
          const matches = html.matchAll(/rating":(\d)/g);
          for (const m of matches) history.push({ rating: parseInt(m[1]) });
        } else {
          // Flipkart/Generic
          const matches = html.matchAll(/_2sc77">(\d)/g);
          for (const m of matches) history.push({ rating: parseInt(m[1]) });
        }
        
        sendResponse({ history });
      })
      .catch(err => {
        console.error(err);
        sendResponse({ history: [] });
      });
    return true;
  }
});