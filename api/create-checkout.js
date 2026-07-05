function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return json(res, 405, { error: "Method not allowed" });
    }

    const creemApiBase = process.env.CREEM_API_BASE || "https://api.creem.io/v1";
    const products = {
      ai: process.env.CREEM_AI_PRODUCT_ID,
      batch: process.env.CREEM_BATCH_PRODUCT_ID
    };

    if (!process.env.CREEM_API_KEY) {
      return json(res, 500, { error: "Creem API key is not configured." });
    }

    let body = {};
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    } catch {
      return json(res, 400, { error: "Invalid JSON body." });
    }

    const plan = body.plan === "batch" ? "batch" : body.plan === "ai" ? "ai" : null;
    if (!plan) {
      return json(res, 400, { error: "Unknown checkout plan." });
    }

    const productId = products[plan];
    if (!productId) {
      return json(res, 500, { error: `Creem product ID is not configured for ${plan}.` });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const requestId = `${plan}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

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
      return json(res, creemResponse.status, {
        error: data.error || data.message || "Creem checkout creation failed."
      });
    }

    if (!data.checkout_url) {
      return json(res, 502, { error: "Creem did not return a checkout URL." });
    }

    return json(res, 200, { checkoutUrl: data.checkout_url });
  } catch (error) {
    return json(res, 500, { error: error.message || "Checkout request failed." });
  }
};
