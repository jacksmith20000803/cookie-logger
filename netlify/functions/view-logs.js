// netlify/functions/view-logs.js
import { getStore } from "@netlify/blobs";

export default async () => {
  const store = getStore("post-logs");
  // List all keys in the store
  const { keys } = await store.list();

  if (!keys || keys.length === 0) {
    return new Response("No logs found.", { status: 200 });
  }

  // Get the most recently added key (Blobs lists keys lexicographically)
  const latestKey = keys.sort().pop();
  const latestEntry = await store.get(latestKey, { type: "json" });

  return new Response(
    `Latest log (${latestKey}):\n${JSON.stringify(latestEntry, null, 2)}`,
    { status: 200, headers: { "Content-Type": "text/plain" } }
  );
};