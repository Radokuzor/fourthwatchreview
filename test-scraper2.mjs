import axios from "axios";

const key = process.env.SCRAPINGDOG_API_KEY;
console.log("Key:", key?.slice(0, 10));

// Test the correct ScrapingDog Google Maps Places endpoint
console.log("\n--- Test: Google Maps Places (correct endpoint) ---");
try {
  const r = await axios.get("https://api.scrapingdog.com/google_maps", {
    params: {
      api_key: key,
      query: "Starbucks New York",
      type: "search",
    },
    timeout: 20000,
  });
  console.log("Status:", r.status);
  console.log("Keys:", Object.keys(r.data));
  console.log("Sample:", JSON.stringify(r.data).slice(0, 600));
} catch (e) {
  console.error("Error:", e.response?.status, JSON.stringify(e.response?.data ?? e.message).slice(0, 300));
}

// Test: SerpAPI-style Google Maps
console.log("\n--- Test: /google with type=maps ---");
try {
  const r = await axios.get("https://api.scrapingdog.com/google", {
    params: {
      api_key: key,
      query: "Starbucks New York",
      results: 5,
      type: "maps",
    },
    timeout: 20000,
  });
  console.log("Status:", r.status);
  console.log("Keys:", Object.keys(r.data));
  console.log("Sample:", JSON.stringify(r.data).slice(0, 600));
} catch (e) {
  console.error("Error:", e.response?.status, JSON.stringify(e.response?.data ?? e.message).slice(0, 300));
}

// Test: Google Places API via ScrapingDog
console.log("\n--- Test: /places endpoint ---");
try {
  const r = await axios.get("https://api.scrapingdog.com/places", {
    params: {
      api_key: key,
      query: "Starbucks New York",
    },
    timeout: 20000,
  });
  console.log("Status:", r.status);
  console.log("Keys:", Object.keys(r.data));
  console.log("Sample:", JSON.stringify(r.data).slice(0, 600));
} catch (e) {
  console.error("Error:", e.response?.status, JSON.stringify(e.response?.data ?? e.message).slice(0, 300));
}
