export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!process.env.CREEM_API_KEY) {
      return res.status(500).json({ error: "Creem API key is not configured." });
    }

    const products = {
      ai: process.env.CREEM_AI_PRODUCT_ID,
      batch: process.env.CREEM_BATCH_PRODUCT_ID
    };

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const plan = body.plan === "batch" ? "batch" : body.plan === "ai" ? "ai" : null;
    if (!plan) {
      return res.status(400).json({ error: "Unknown checkout plan." });
    }

    const productId = products[plan];
    if (!productId) {
      return res.status(500).json({ error: `Creem product ID is not configured for ${plan}.` });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const requestId = `${plan}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const creemApiBase = process.env.CREEM_API_BASE || "https://api.creem.io/v1";

    const creemResponse = await fetch(`${creemApiBase}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.CREEM_API_KEY
      },
      body: JSON.stringify({
        product_id: productId,
        request_id: requestId,
        units: 1,
        success_url: `${origin}/?checkout=success&plan=${encodeURIComponent(plan)}`,
        metadata: {
          plan,
          source: "image-to-pixel-art-converter"
        }
      })
    });

    const data = await creemResponse.json().catch(() => ({}));
    if (!creemResponse.ok) {
      return res.status(creemResponse.status).json({
        error: data.error || data.message || "Creem checkout creation failed."
      });
    }

    if (!data.checkout_url) {
      return res.status(502).json({ error: "Creem did not return a checkout URL." });
    }

    return res.status(200).json({ checkoutUrl: data.checkout_url });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Checkout request failed." });
  }
}
