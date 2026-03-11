document.getElementById("scrape").addEventListener("click", async () => {

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  chrome.tabs.sendMessage(
    tab.id,
    { action: "SCRAPE_REVIEWS" },
    async (response) => {

      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        document.getElementById("output").value =
          "Content script not found. Refresh the page.";
        return;
      }

      if (!response) {
        document.getElementById("output").value =
          "No response received";
        return;
      }

      // Show scraped JSON
      document.getElementById("output").value =
        JSON.stringify(response, null, 2);

      // SEND DATA TO ML API
      const apiResult = await sendReviewsToAPI(response.reviews);
      console.log("API RESULT:", apiResult);

      const authenticity = apiResult.platform_summary.platform_trust_score;

      document.getElementById("output").value +=
        "\n\nAuthenticity Score: " + authenticity + "%";

    }
  );

});

function convertReviewsToCSV(reviews) {

  let csv = "review_id,seller_id,rating,review_text,review_date\n";

  reviews.forEach((review, index) => {

    csv += `${index},demo_seller,5,"${review}",2024-01-01\n`;

  });

  return csv;
}

async function sendReviewsToAPI(reviews) {

  try {

    // Convert reviews array → CSV
    const csv = convertReviewsToCSV(reviews);

    // Create CSV file blob
    const blob = new Blob([csv], { type: "text/csv" });

    // Create form data
    const formData = new FormData();
    formData.append("file", blob, "reviews.csv");

    const response = await fetch(
      "https://trustscore-ml-model.onrender.com/api/analyze",
      {
        method: "POST",
        body: formData
      }
    );

    const result = await response.json();

    return result;

  } catch (error) {

    console.error("API Error:", error);

  }

}

