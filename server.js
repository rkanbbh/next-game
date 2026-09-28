const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const IS_PRODUCTION = String(process.env.MIDTRANS_IS_PRODUCTION).toLowerCase() === "true";

if (!SERVER_KEY) {
  console.warn("MIDTRANS_SERVER_KEY belum diatur. Pembayaran belum bisa dibuat.");
}

const SNAP_URL = IS_PRODUCTION
  ? "https://app.midtrans.com/snap/v1/transactions"
  : "https://app.sandbox.midtrans.com/snap/v1/transactions";

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "";

function send(res, status, body, type="application/json") {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*"
  });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error("JSON tidak valid")); }
    });
    req.on("error", reject);
  });
}

async function createPayment(req, res) {
  if (!SERVER_KEY) return send(res, 500, {error:"Server payment belum dikonfigurasi."});

  const body = await readBody(req);
  const game = String(body.game || "").trim();
  const playerId = String(body.playerId || "").trim();
  const nominal = String(body.nominal || "").trim();
  const price = Number(body.price);
  const payment = String(body.payment || "").trim();

  if (!game || !playerId || !nominal || !Number.isInteger(price) || price <= 0) {
    return send(res, 400, {error:"Data pesanan tidak lengkap."});
  }

  const orderId = "NG-" + Date.now() + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();

  const payload = {
    transaction_details: {
      order_id: orderId,
      gross_amount: price
    },
    custom_field1: game,
    custom_field2: playerId,
    custom_field3: nominal
  };

  // The selected payment method is sent as a preference where supported.
  // Snap can still show the enabled methods configured in the merchant account.
  if (payment === "gopay") {
    payload.enabled_payments = ["gopay"];
  } else if (payment === "shopeepay") {
    payload.enabled_payments = ["shopeepay"];
  } else if (payment === "qris") {
    payload.enabled_payments = ["qris"];
  } else if (payment === "bank_transfer") {
    payload.enabled_payments = ["bca_va","bni_va","bri_va","permata_va"];
  }

  const auth = Buffer.from(SERVER_KEY + ":").toString("base64");

  const response = await fetch(SNAP_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": "Basic " + auth
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("Midtrans error:", result);
    return send(res, 502, {error:"Payment gateway menolak transaksi.", detail: result});
  }

  // Redirect URL is returned by Snap. Save orderId + product data in a real database
  // before fulfilling the game top-up.
  send(res, 200, {
    order_id: orderId,
    redirect_url: result.redirect_url,
    token: result.token
  });
}

async function notification(req, res) {
  const body = await readBody(req);

  // Verify notification signature before treating payment as successful.
  const raw = String(body.order_id || "") +
              String(body.status_code || "") +
              String(body.gross_amount || "") +
              String(SERVER_KEY || "");

  const expected = crypto.createHash("sha512").update(raw).digest("hex");

  if (!SERVER_KEY || body.signature_key !== expected) {
    return send(res, 401, {error:"Invalid signature"});
  }

  const success =
    body.transaction_status === "settlement" ||
    (body.transaction_status === "capture" && body.fraud_status === "accept");

  console.log("PAYMENT NOTIFICATION", {
    order_id: body.order_id,
    status: body.transaction_status,
    success
  });

  // IMPORTANT: In production, look up the order in your database using order_id,
  // mark it paid only after verification, then call the authorized game supplier API.
  send(res, 200, {ok:true});
}

function serveStatic(req, res) {
  let urlPath = new URL(req.url, "http://localhost").pathname;
  if (urlPath === "/") urlPath = "/index.html";

  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const file = path.join(__dirname, safe);

  if (!file.startsWith(__dirname)) return send(res, 403, {error:"Forbidden"});

  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, {error:"Not found"});
    const ext = path.extname(file);
    const types = {
      ".html":"text/html; charset=utf-8",
      ".css":"text/css; charset=utf-8",
      ".js":"text/javascript; charset=utf-8"
    };
    send(res, 200, data, types[ext] || "application/octet-stream");
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin":"*",
      "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
      "Access-Control-Allow-Headers":"Content-Type"
    });
    return res.end();
  }

  try {
    if (req.method === "POST" && req.url === "/api/create-payment") {
      return await createPayment(req, res);
    }
    if (req.method === "POST" && req.url === "/api/midtrans-notification") {
      return await notification(req, res);
    }
    if (req.method === "GET" && req.url === "/api/health") {
      return send(res, 200, {ok:true});
    }
    serveStatic(req, res);
  } catch (err) {
    console.error(err);
    send(res, 500, {error:"Server error"});
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Next Game running on ${HOST}:${PORT}`);
});
