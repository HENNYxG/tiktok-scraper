const chromium = require("chrome-aws-lambda");
const puppeteer = require("puppeteer-core");

module.exports = async (req, res) => {
  const { username, hashtag } = req.query;

  if (!username || !hashtag) {
    return res
      .status(400)
      .json({ error: "username and hashtag query parameters are required" });
  }

  let browser = null;
  try {
    // Get the path to the Chromium binary
    const executablePath = await chromium.executablePath;

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    const cleanUsername = username.replace("@", "");
    await page.goto(`https://www.tiktok.com/@${cleanUsername}`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for the container that holds video items (update the selector if needed)
    await page.waitForSelector("div.tiktok-yz6ijl-DivItemContainer", {
      timeout: 10000,
    });

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
            id: url.split("/").pop(), // simple ID extraction from URL
            datePosted: new Date().toISOString(), // Placeholder date
            url,
            description,
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

    return res.status(200).json(videos);
  } catch (error) {
    console.error("Scraping error:", error);
    return res.status(500).json({
      error: "Scraping failed",
      details: error.toString(),
    });
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
};
