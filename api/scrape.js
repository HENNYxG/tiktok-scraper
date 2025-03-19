const puppeteer = require("puppeteer");

module.exports = async (req, res) => {
  const { username, hashtag } = req.query;

  if (!username || !hashtag) {
    res
      .status(400)
      .json({ error: "username and hashtag query parameters are required" });
    return;
  }

  try {
    // Remove '@' from username if present
    const cleanUsername = username.replace("@", "");
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(`https://www.tiktok.com/@${cleanUsername}`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    // Wait for the video container (update selector if needed)
    await page.waitForSelector("div.tiktok-yz6ijl-DivItemContainer", {
      timeout: 10000,
    });

    // Extract video data from the page
    const videos = await page.evaluate((hashtag) => {
      const videoElements = document.querySelectorAll(
        "div.tiktok-yz6ijl-DivItemContainer"
      );
      const results = [];
      videoElements.forEach((el) => {
        const linkEl = el.querySelector("a");
        const url = linkEl ? linkEl.href : "";
        const descEl = el.querySelector("p") || el.querySelector("h3");
        const description = descEl ? descEl.innerText : "";
        if (description.toLowerCase().includes("#" + hashtag.toLowerCase())) {
          results.push({
            id: url.split("/").pop(), // Extract last segment as an ID
            datePosted: new Date().toISOString(), // Placeholder date
            url: url,
            description: description,
            stats: {
              views: 0,
              likes: 0,
              comments: 0,
            },
          });
        }
      });
      return results;
    }, hashtag);

    await browser.close();
    res.status(200).json(videos);
  } catch (error) {
    console.error("Scraping error:", error);
    res
      .status(500)
      .json({ error: "Scraping failed", details: error.toString() });
  }
};
