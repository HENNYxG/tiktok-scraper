// /api/scrape.js - Updated serverless function for Vercel/Netlify

const axios = require("axios");
const cheerio = require("cheerio");

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
    // Use axios to fetch the TikTok user page
    const response = await axios.get(
      `https://www.tiktok.com/@${sanitizedUsername}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        timeout: 10000, // 10 second timeout
      }
    );

    // Use cheerio to parse HTML
    const $ = cheerio.load(response.data);
    const videos = [];

    // Extract video information - this may need to be updated as TikTok changes
    $('div[data-e2e="user-post-item"]').each((i, element) => {
      try {
        const videoEl = $(element);
        const linkEl = videoEl.find("a");

        if (linkEl.length === 0) return;

        const url = linkEl.attr("href");
        if (!url) return;

        const id = url.split("/").pop();

        // Find description
        const descriptionEl = videoEl.find('[data-e2e="video-desc"]');
        const description =
          descriptionEl.length > 0 ? descriptionEl.text() : "";

        // Only include videos with the hashtag
        if (
          !description
            .toLowerCase()
            .includes(`#${sanitizedHashtag.toLowerCase()}`)
        ) {
          return;
        }

        // Extract stats
        const statsEls = videoEl.find('[data-e2e="video-stats"] strong');

        // Parse numbers (removing "K", "M", etc.)
        const parseCount = (text) => {
          if (!text) return 0;
          const num = text.trim();

          if (num.endsWith("K")) {
            return parseFloat(num.replace("K", "")) * 1000;
          } else if (num.endsWith("M")) {
            return parseFloat(num.replace("M", "")) * 1000000;
          } else {
            return parseInt(num.replace(/[^\d]/g, "")) || 0;
          }
        };

        let views = 0;
        let likes = 0;
        let comments = 0;

        if (statsEls.length >= 3) {
          views = parseCount($(statsEls[0]).text());
          likes = parseCount($(statsEls[1]).text());
          comments = parseCount($(statsEls[2]).text());
        }

        // Add to results
        videos.push({
          id,
          url: `https://www.tiktok.com/@${sanitizedUsername}/video/${id}`,
          description,
          datePosted: new Date().toISOString(), // Default to current date as TikTok doesn't show exact dates easily
          stats: {
            views,
            likes,
            comments,
          },
        });
      } catch (err) {
        console.error("Error parsing video element:", err);
      }
    });

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
