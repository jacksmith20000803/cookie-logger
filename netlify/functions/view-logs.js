// netlify/functions/view-logs.js
import { getStore } from "@netlify/blobs";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getBlobKeys(result) {
  if (!result) return [];
  if (Array.isArray(result.keys)) return result.keys;
  if (Array.isArray(result.blobs)) {
    return result.blobs.map((blob) => typeof blob === "string" ? blob : blob.key);
  }
  return [];
}

export default async (req) => {
  if (req?.method && req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const store = getStore("post-logs");
    const listed = store.list({ paginate: true });
    const results = [];

    if (listed && typeof listed[Symbol.asyncIterator] === "function") {
      for await (const page of listed) results.push(page);
    } else if (listed && typeof listed.then === "function") {
      const result = await listed;
      if (result && typeof result[Symbol.asyncIterator] === "function") {
        for await (const page of result) results.push(page);
      } else {
        results.push(result);
      }
    } else {
      results.push(listed);
    }

    const keys = [...new Set(results.flatMap(getBlobKeys).filter(Boolean))]
      .sort()
      .reverse();

    let entries = [];
    if (keys.length > 0) {
      entries = await Promise.all(keys.map(async (key) => {
        try {
          const entry = await store.get(key, { type: "json" });
          return entry ? { key, entry } : null;
        } catch (error) {
          return { key, entry: { error: "Unable to read stored value" } };
        }
      }));
      entries = entries.filter(Boolean);
    }

    const cards = entries.length === 0
      ? '<p class="empty">No logs found.</p>'
      : entries.map(({ key, entry }, index) => {
          const payload = JSON.stringify(entry, null, 2);
          return `
            <article class="log-card">
              <header>
                <div class="log-title">
                  <h2>Log ${entries.length - index}</h2>
                  <code>${escapeHtml(key)}</code>
                </div>
                <button class="delete-button" type="button" data-key="${escapeHtml(key)}">Delete</button>
              </header>
              <pre>${escapeHtml(payload)}</pre>
            </article>`;
        }).join("\n");

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>POST logs</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    body { margin: 0; background: #111827; color: #e5e7eb; }
    main { max-width: 960px; margin: 0 auto; padding: 32px 20px; }
    h1 { margin: 0 0 24px; }
    .log-card { background: #1f2937; border: 1px solid #374151; border-radius: 10px; margin: 16px 0; overflow: hidden; }
    .log-card header { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 12px 16px; border-bottom: 1px solid #374151; }
    .log-title { min-width: 0; }
    .log-card h2 { margin: 0; font-size: 16px; }
    .log-card code { color: #9ca3af; overflow-wrap: anywhere; }
    .delete-button { flex-shrink: 0; border: 1px solid #b91c1c; border-radius: 6px; background: #991b1b; color: #fff; padding: 8px 12px; cursor: pointer; }
    .delete-button:hover { background: #b91c1c; }
    .delete-button:disabled { opacity: 0.6; cursor: wait; }
    pre { margin: 0; padding: 16px; white-space: pre-wrap; overflow-wrap: anywhere; }
    .empty { padding: 24px; text-align: center; border: 1px dashed #4b5563; border-radius: 10px; }
  </style>
</head>
<body>
  <main>
    <h1 id="log-count">Incoming POST logs (${entries.length})</h1>
    ${cards}
  </main>
  <script>
    function refreshLogLabels() {
      const cards = [...document.querySelectorAll(".log-card")];
      document.querySelector("#log-count").textContent = "Incoming POST logs (" + cards.length + ")";
      cards.forEach((card, index) => {
        card.querySelector("h2").textContent = "Log " + (cards.length - index);
      });
    }

    document.querySelectorAll(".delete-button").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!window.confirm("Delete this log?")) return;

        button.disabled = true;
        try {
          const key = encodeURIComponent(button.dataset.key || "");
          const response = await fetch("/api/log/delete?key=" + key, { method: "DELETE" });
          if (!response.ok) {
            throw new Error(await response.text());
          }
          button.closest(".log-card").remove();
          refreshLogLabels();
        } catch (error) {
          window.alert("Failed to delete log: " + (error.message || error));
          button.disabled = false;
        }
      });
    });
  </script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Failed to view logs:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export const config = { method: ["GET"] };