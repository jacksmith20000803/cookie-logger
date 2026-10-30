// netlify/functions/record-post.js
import { getStore } from "@netlify/blobs";

// CORS headers applied to every response.
// "*" is safe here because we don't send cookies/credentials.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400", // cache preflight for 24 hours
};

export default async (req, context) => {
  // 1. Handle CORS preflight FIRST — before any method check.
  //    Browsers send this automatically before the real POST.
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  // 2. Only allow POST for the actual data request
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  try {
    // 3. Parse JSON when possible, while still logging plain-text and
    //    form-encoded POST bodies instead of dropping them on parse errors.
    let data;
    const contentType = req.headers.get("content-type") || "";
    try {
      data = await req.json();
    } catch (jsonError) {
      const rawBody = typeof req.text === "function" ? await req.text() : "";
      if (contentType.includes("application/x-www-form-urlencoded") && rawBody) {
        data = Object.fromEntries(new URLSearchParams(rawBody).entries());
      } else {
        data = rawBody;
      }
    }

    // 4. Build the log entry
    const timestamp = new Date().toISOString();
    const logEntry = {
      receivedAt: timestamp,
      payload: data,
      userAgent: req.headers.get("user-agent") || "unknown",
    };

    // 5. Persist to Netlify Blobs (survives cold starts and redeploys)
    const store = getStore("post-logs");
    await store.setJSON(timestamp, logEntry);

    // 6. Return success with CORS headers
    return new Response(
      JSON.stringify({ status: "logged", key: timestamp }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Failed to record POST:", error);
    return new Response("Internal Server Error", {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
};

// IMPORTANT: Allow both POST and OPTIONS so the preflight reaches this function.
// Using just "POST" here would cause Netlify to return 405 to the browser's
// OPTIONS preflight, and the real POST would never be sent.
export const config = {
  method: ["POST", "OPTIONS"],
};