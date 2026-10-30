import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "DELETE") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return new Response("Missing log key", { status: 400 });
    }

    const store = getStore("post-logs");
    await store.delete(key);

    return new Response(JSON.stringify({ status: "deleted", key }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to delete log:", error);
    return new Response(JSON.stringify({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = { method: ["DELETE"] };
