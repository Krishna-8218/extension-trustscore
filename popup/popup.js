document.getElementById("scrape").addEventListener("click", async () => {

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  chrome.tabs.sendMessage(
    tab.id,
    { action: "SCRAPE_REVIEWS" },
    (response) => {

      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        document.getElementById("output").value =
          "Content script not found. Refresh the page.";
        return;
      }

      if (!response) {
        document.getElementById("output").value = "No response received";
        return;
      }

      document.getElementById("output").value =
        JSON.stringify(response, null, 2);

    }
  );

});