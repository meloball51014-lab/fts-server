import express from "express";
import cors from "cors";
import fs from "fs";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 8787;
const DB = "./codes.json";

app.use(cors());
app.use(express.json());

function readDB() { return JSON.parse(fs.readFileSync(DB, "utf8")); }
function writeDB(data) { fs.writeFileSync(DB, JSON.stringify(data, null, 2)); }

// Redeem a code — locks it to a machine ID
app.post("/redeem", (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  const machineId = String(req.body.machineId || "").trim();

  if (!code) return res.status(400).json({ ok: false, error: "MISSING CODE" });
  if (!machineId) return res.status(400).json({ ok: false, error: "MISSING MACHINE ID" });

  let db;
  try { db = readDB(); }
  catch { return res.status(500).json({ ok: false, error: "Server error" }); }

  const item = db.codes[code];
  if (!item) return res.status(404).json({ ok: false, error: "INVALID CODE" });
  if (item.used) return res.status(409).json({ ok: false, error: "CODE ALREADY USED" });

  item.used = true;
  item.usedAt = new Date().toISOString();
  item.machineId = machineId;
  item.ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  const token = crypto.randomBytes(24).toString("hex");
  item.token = token;

  writeDB(db);
  return res.json({ ok: true, token });
});

// Verify token — checks machine ID matches
app.post("/verify", (req, res) => {
  const token = String(req.body.token || "").trim();
  const machineId = String(req.body.machineId || "").trim();

  if (!token) return res.status(400).json({ ok: false, error: "MISSING TOKEN" });

  let db;
  try { db = readDB(); }
  catch { return res.status(500).json({ ok: false, error: "Server error" }); }

  const found = Object.values(db.codes).find(c => c.token === token);

  if (!found) return res.status(404).json({ ok: false, error: "INVALID TOKEN" });
  if (found.revoked) return res.status(403).json({ ok: false, error: "ACCESS REVOKED" });

  // Machine ID check
  if (found.machineId && machineId && found.machineId !== machineId) {
    return res.status(403).json({ ok: false, error: "DEVICE NOT AUTHORIZED" });
  }

  return res.json({ ok: true });
});

// Revoke a code
app.post("/revoke", (req, res) => {
  const secret = req.headers["x-admin-secret"];
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  const code = String(req.body.code || "").trim().toUpperCase();

  let db;
  try { db = readDB(); }
  catch { return res.status(500).json({ ok: false, error: "Server error" }); }

  const item = db.codes[code];
  if (!item) return res.status(404).json({ ok: false, error: "CODE NOT FOUND" });

  item.revoked = true;
  writeDB(db);
  return res.json({ ok: true, message: "Code revoked" });
});

app.listen(PORT, () => console.log("FTS SERVER RUNNING ON PORT " + PORT));
