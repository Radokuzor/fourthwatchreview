import axios from "axios";
const key = process.env.SCRAPINGDOG_API_KEY;
console.log("Key present:", !!key, "| Prefix:", key?.slice(0, 10));

// Test 1: Google Maps search
console.log("\n--- Test 1: Google Maps search ---");
try {
  const r = await axios.get("https://api.scrapingdog.com/google/maps", {
    params: { api_key: key, query: "Starbucks New York", results: 3 },
    timeout: 20000,
  });
  console.log("Status:", r.status);
  console.log("Top-level keys:", Object.keys(r.data));
  console.log("local_results count:", r.data?.local_results?.length ?? "none");
  console.log("First result:", JSON.stringify(r.data?.local_results?.[0] ?? r.data).slice(0, 500));
} catch (e) {
  console.error("Error:", e.response?.status, JSON.stringify(e.response?.data ?? e.message).slice(0, 400));
}

// Test 2: Google Search (alternative)
console.log("\n--- Test 2: Google Search API ---");
try {
  const r = await axios.get("https://api.scrapingdog.com/google", {
    params: { api_key: key, query: "Starbucks New York site:google.com/maps", results: 3 },
    timeout: 20000,
  });
  console.log("Status:", r.status);
  console.log("Top-level keys:", Object.keys(r.data));
  console.log("Sample:", JSON.stringify(r.data).slice(0, 500));
} catch (e) {
  console.error("Error:", e.response?.status, JSON.stringify(e.response?.data ?? e.message).slice(0, 400));
}
