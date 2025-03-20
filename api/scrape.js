// /api/scrape.js - Serverless function for Vercel/Netlify

const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  // Handle OPTIONS request
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Check for required parameters
  const { username, hashtag } = req.query;
  if (!username || !hashtag) {
    return res
      .status(400)
      .json({ error: "Missing required parameters: username and hashtag" });
  }

  // Sanitize inputs
  const sanitizedUsername = username.replace("@", "");
  const sanitizedHashtag = hashtag.replace("#", "");

  try {
    // Launch browser with Chromium
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    // Start a new page
    const page = await browser.newPage();

    // Set user agent to avoid being blocked
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36"
    );

    // Go to TikTok profile page
    await page.goto(`https://www.tiktok.com/@${sanitizedUsername}`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Add a small delay to ensure page loads fully
    await page.waitForTimeout(2000);

    // Extract videos
    const videos = await page.evaluate((hashtag) => {
      const results = [];
      const videoElements = document.querySelectorAll(
        'div[data-e2e="user-post-item"]'
      );

      for (const videoEl of videoElements) {
        try {
          // Find link
          const linkEl = videoEl.querySelector("a");
          if (!linkEl) continue;

          const url = linkEl.href;
          const id = url.split("/").pop();

          // Find description (may need adjustments based on TikTok's DOM)
          const descriptionEl = videoEl.querySelector(
            '[data-e2e="video-desc"]'
          );
          const description = descriptionEl ? descriptionEl.textContent : "";

          // Only include videos that have the hashtag
          if (
            !description.toLowerCase().includes(`#${hashtag.toLowerCase()}`)
          ) {
            continue;
          }

          // Extract stats (these selectors may need updating as TikTok changes)
          const statsEls = videoEl.querySelectorAll(
            '[data-e2e="video-stats"] strong'
          );
          let views = 0;
          let likes = 0;
          let comments = 0;

          if (statsEls.length >= 3) {
            // Parse numbers (removing "K", "M", etc.)
            const parseCount = (text) => {
              const num = text.trim();

              if (num.endsWith("K")) {
                return parseFloat(num.replace("K", "")) * 1000;
              } else if (num.endsWith("M")) {
                return parseFloat(num.replace("M", "")) * 1000000;
              } else {
                return parseInt(num.replace(/[^\d]/g, "")) || 0;
              }
            };

            views = parseCount(statsEls[0].textContent);
            likes = parseCount(statsEls[1].textContent);
            comments = parseCount(statsEls[2].textContent);
          }

          // Extract date (this is challenging and may need updating)
          // TikTok often displays relative dates, so we'll estimate
          const datePosted = new Date().toISOString();

          results.push({
            id,
            url,
            description,
            datePosted,
            stats: {
              views,
              likes,
              comments,
            },
          });
        } catch (error) {
          console.error("Error parsing video:", error);
        }
      }

      return results;
    }, sanitizedHashtag);

    await browser.close();

    // Return results
    return res.status(200).json(videos);
  } catch (error) {
    console.error("Scraping error:", error);
    return res.status(500).json({
      error: "Error scraping TikTok",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};
