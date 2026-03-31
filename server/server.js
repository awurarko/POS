const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const bcrypt  = require("bcryptjs");
const crypto  = require("crypto");
const jwt     = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const path = require("path");
const db      = require("./db");
require("dotenv").config({ path: "env.env" });

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "replace-this-secret-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const VALID_ROLES = new Set(["Admin", "Manager", "Cashier"]);
const VALID_STATUS = new Set(["Active", "Inactive"]);
const VALID_PAYMENT_METHODS = new Set(["Cash", "Card", "Mobile Money"]);
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";
const PAYSTACK_INITIATE_URL = process.env.PAYSTACK_INITIATE_URL || "https://api.paystack.co/transaction/initialize";
const PAYSTACK_VERIFY_URL_TEMPLATE = process.env.PAYSTACK_VERIFY_URL_TEMPLATE || "https://api.paystack.co/transaction/verify/{reference}";
const PAYSTACK_CALLBACK_URL = process.env.PAYSTACK_CALLBACK_URL || "";

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);

// Keep Helmet protections, but disable CSP because this app currently relies on
// inline scripts and inline event handlers in HTML templates.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.length === 0) {
            const localOrigins = [
                "http://localhost:3001",
                "http://127.0.0.1:3001",
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ];
            return cb(null, localOrigins.includes(origin));
        }
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error("Origin not allowed by CORS"));
    }
}));
app.use(express.json({ limit: "1mb" }));

const frontendDir = path.resolve(__dirname, "..", "pos-system");
app.use(express.static(frontendDir, {
    etag: false,
    maxAge: 0,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html") || filePath.endsWith(".css") || filePath.endsWith(".js")) {
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
            res.setHeader("Surrogate-Control", "no-store");
        }
    }
}));
app.get("/", (req, res) => {
    res.sendFile(path.join(frontendDir, "index.html"));
});

const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many authentication attempts. Please try again later." },
});

const checkoutRequestCache = new Map();
const CHECKOUT_CACHE_TTL_MS = 15 * 60 * 1000;

function pruneCheckoutCache() {
    const now = Date.now();
    for (const [key, value] of checkoutRequestCache.entries()) {
        if (now - value.time > CHECKOUT_CACHE_TTL_MS) {
            checkoutRequestCache.delete(key);
        }
    }
}

function cleanText(value, maxLen = 255) {
    if (typeof value !== "string") return "";
    return value.trim().replace(/\s+/g, " ").slice(0, maxLen);
}

function toPositiveInt(value) {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) && n > 0 ? n : null;
}

function toNonNegativeInt(value) {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) && n >= 0 ? n : null;
}

function toNonNegativeNumber(value) {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

function getPaystackHeaders() {
    if (!PAYSTACK_SECRET_KEY) {
        throw new Error("Paystack secret key is not configured.");
    }
    return {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
    };
}

async function paystackRequest(url, method = "GET", payload = null) {
    if (!url) {
        throw new Error("Paystack endpoint URL is not configured.");
    }

    const response = await fetch(url, {
        method,
        headers: getPaystackHeaders(),
        body: payload ? JSON.stringify(payload) : undefined,
    });

    const text = await response.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch (err) {
        data = { raw: text };
    }

    if (!response.ok) {
        const message = data.message || data.error || `Paystack request failed with ${response.status}`;
        throw new Error(message);
    }

    return data;
}

function normalizePaystackStatus(payload) {
    const raw = String(
        payload.data?.status ||
        payload.status ||
        payload.gateway_response ||
        ""
    ).toLowerCase();

    if (["success", "successful", "paid", "completed"].includes(raw)) return "SUCCESS";

    // Explicit terminal failure states.
    if (["failed", "abandoned", "cancelled", "canceled", "reversed", "declined", "error"].includes(raw)) {
        return "FAILED";
    }

    // Treat every other state as in-flight so checkout can keep polling.
    return "PENDING";
}

function issueAccessToken(user) {
    return jwt.sign(
        { sub: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.slice(7).trim();
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

function allowRoles(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        next();
    };
}

// â”€â”€ Helper: random ID generation with uniqueness check â”€â”€â”€â”€â”€â”€â”€â”€
async function nextId(table, prefix, totalLen = 10) {
    const suffixLen = totalLen - prefix.length;
    if (suffixLen <= 0) throw new Error("Invalid ID configuration.");

    for (let i = 0; i < 20; i++) {
        const max = 10 ** suffixLen;
        const rand = Math.floor(Math.random() * max);
        const candidate = `${prefix}${String(rand).padStart(suffixLen, "0")}`;
        const [[row]] = await db.query(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`, [candidate]);
        if (!row) return candidate;
    }

    throw new Error("Could not generate a unique ID. Please retry.");
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AUTH
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// GET /api/setup/status
app.get("/api/setup/status", async (req, res) => {
    try {
        const [[{ count }]] = await db.query("SELECT COUNT(*) AS count FROM users");
        res.json({ hasUsers: count > 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/setup/first-admin
app.post("/api/setup/first-admin", authLimiter, async (req, res) => {
    try {
        const username = cleanText(req.body.username, 60);
        const password = cleanText(req.body.password, 255);
        const fullName = cleanText(req.body.fullName, 100);
        if (!username || !password || !fullName) {
            return res.status(400).json({ error: "Username, password, and full name are required." });
        }

        const [[{ count }]] = await db.query("SELECT COUNT(*) AS count FROM users");
        if (count > 0) {
            return res.status(409).json({ error: "Setup already completed." });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const id = await nextId("users", "U", 10);
        await db.query(
            "INSERT INTO users (id, username, password, full_name, role, status) VALUES (?,?,?,?,?,?)",
            [id, username, passwordHash, fullName, "Admin", "Active"]
        );
        res.json({ id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/login
app.post("/api/login", authLimiter, async (req, res) => {
    try {
        const username = cleanText(req.body.username, 60);
        const password = cleanText(req.body.password, 255);
        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required." });
        }

        const [rows] = await db.query(
            "SELECT * FROM users WHERE username = ? AND status = 'Active'",
            [username]
        );
        if (rows.length === 0) {
            console.warn(`[AUTH_FAIL] unknown username: ${username}`);
            return res.status(401).json({ error: "Invalid username or password." });
        }

        const u = rows[0];
        let valid = false;
        if (typeof u.password === "string" && u.password.startsWith("$2")) {
            valid = await bcrypt.compare(password, u.password);

            // Backward compatibility: older app versions bcrypt-hashed client SHA-256 output.
            if (!valid) {
                const legacySha = crypto.createHash("sha256").update(password).digest("hex");
                const legacyValid = await bcrypt.compare(legacySha, u.password);
                if (legacyValid) {
                    valid = true;
                    const upgradedHash = await bcrypt.hash(password, 12);
                    await db.query("UPDATE users SET password=? WHERE id=?", [upgradedHash, u.id]);
                }
            }
        } else {
            valid = u.password === password;
            if (valid) {
                const migratedHash = await bcrypt.hash(password, 12);
                await db.query("UPDATE users SET password=? WHERE id=?", [migratedHash, u.id]);
            }
        }

        if (!valid) {
            console.warn(`[AUTH_FAIL] invalid password for username: ${username}`);
            return res.status(401).json({ error: "Invalid username or password." });
        }

        const token = issueAccessToken({ id: u.id, username: u.username, role: u.role });
        res.json({
            token,
            user: { id: u.id, username: u.username, fullName: u.full_name, role: u.role },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PAYSTACK PAYMENTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

app.post("/api/payments/paystack/initiate", requireAuth, async (req, res) => {
    try {
        const amount = toNonNegativeNumber(req.body.amount);
        const customerMsisdn = cleanText(req.body.customerMsisdn, 20);
        const customerEmail = cleanText(req.body.customerEmail, 120).toLowerCase();
        const channel = cleanText(req.body.channel, 20).toLowerCase();
        const customerName = cleanText(req.body.customerName || "Walk-in Customer", 100);
        const description = cleanText(req.body.description || "POS mobile money payment", 160);
        const externalReference = cleanText(req.body.externalReference, 80);

        if (amount == null || amount <= 0) {
            return res.status(400).json({ error: "Amount must be greater than zero." });
        }
        if (!customerMsisdn) {
            return res.status(400).json({ error: "Customer mobile number is required." });
        }
        if (!customerEmail || !customerEmail.includes("@")) {
            return res.status(400).json({ error: "A valid customer email is required for Paystack." });
        }
        if (!["mtn-gh", "tgo-gh", "vodafone-gh", "airteltigo-gh"].includes(channel)) {
            return res.status(400).json({ error: "Invalid mobile money network." });
        }

        const reference = externalReference || `MM-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
        const payload = {
            email: customerEmail,
            amount: Math.round(Number.parseFloat(amount.toFixed(2)) * 100),
            currency: "GHS",
            reference,
            channels: ["mobile_money"],
            ...(PAYSTACK_CALLBACK_URL ? { callback_url: PAYSTACK_CALLBACK_URL } : {}),
            metadata: {
                customer_name: customerName,
                customer_msisdn: customerMsisdn,
                channel,
                description,
            },
        };

        const data = await paystackRequest(PAYSTACK_INITIATE_URL, "POST", payload);
        res.json({
            ok: true,
            reference: data.data?.reference || reference,
            authorizationUrl: data.data?.authorization_url || "",
            status: normalizePaystackStatus(data),
            data,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/payments/paystack/status/:reference", requireAuth, async (req, res) => {
    try {
        const reference = cleanText(req.params.reference, 80);
        if (!reference) {
            return res.status(400).json({ error: "Reference is required." });
        }
        if (!PAYSTACK_VERIFY_URL_TEMPLATE.includes("{reference}")) {
            return res.status(500).json({ error: "Paystack verify URL template is not configured." });
        }

        const statusUrl = PAYSTACK_VERIFY_URL_TEMPLATE.replace("{reference}", encodeURIComponent(reference));
        const data = await paystackRequest(statusUrl, "GET");
        res.json({ ok: true, reference, status: normalizePaystackStatus(data), data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// USERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

app.get("/api/users", requireAuth, allowRoles("Admin"), async (req, res) => {
    try {
        const [rows] = await db.query("SELECT id, username, full_name, role, status FROM users ORDER BY id");
        res.json(rows.map(u => ({ id: u.id, username: u.username, fullName: u.full_name, role: u.role, status: u.status })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/users", requireAuth, allowRoles("Admin"), async (req, res) => {
    try {
        const username = cleanText(req.body.username, 60);
        const password = cleanText(req.body.password, 255);
        const fullName = cleanText(req.body.fullName, 100);
        const role = cleanText(req.body.role, 20);
        const status = cleanText(req.body.status, 20);
        if (!username || !password || !fullName || !role || !status) {
            return res.status(400).json({ error: "Missing required user fields." });
        }
        if (!VALID_ROLES.has(role) || !VALID_STATUS.has(status)) {
            return res.status(400).json({ error: "Invalid role or status." });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const id = await nextId("users", "U", 10);
        await db.query(
            "INSERT INTO users (id, username, password, full_name, role, status) VALUES (?,?,?,?,?,?)",
            [id, username, passwordHash, fullName, role, status]
        );
        res.json({ id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/users/:id", requireAuth, allowRoles("Admin"), async (req, res) => {
    try {
        const username = cleanText(req.body.username, 60);
        const password = cleanText(req.body.password, 255);
        const fullName = cleanText(req.body.fullName, 100);
        const role = cleanText(req.body.role, 20);
        const status = cleanText(req.body.status, 20);
        if (!username || !fullName || !VALID_ROLES.has(role) || !VALID_STATUS.has(status)) {
            return res.status(400).json({ error: "Invalid user payload." });
        }
        if (password) {
            const passwordHash = await bcrypt.hash(password, 12);
            await db.query(
                "UPDATE users SET username=?, password=?, full_name=?, role=?, status=? WHERE id=?",
                [username, passwordHash, fullName, role, status, req.params.id]
            );
        } else {
            await db.query(
                "UPDATE users SET username=?, full_name=?, role=?, status=? WHERE id=?",
                [username, fullName, role, status, req.params.id]
            );
        }
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/users/:id", requireAuth, allowRoles("Admin"), async (req, res) => {
    try {
        await db.query("DELETE FROM users WHERE id=?", [req.params.id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PRODUCTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

app.get("/api/products", requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM products ORDER BY id");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/products/barcode/:code", requireAuth, async (req, res) => {
    try {
        const code = (req.params.code || "").trim();
        const [[row]] = await db.query("SELECT * FROM products WHERE barcode = ? LIMIT 1", [code]);
        if (!row) return res.status(404).json({ error: "Product not found for this barcode." });
        res.json(row);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/products", requireAuth, allowRoles("Admin", "Manager"), async (req, res) => {
    try {
        const name = cleanText(req.body.name, 120);
        const category = cleanText(req.body.category, 80);
        const barcode = cleanText(req.body.barcode, 80);
        const supplier = cleanText(req.body.supplier, 120);
        const price = parseFloat(req.body.price);
        const stock = parseInt(req.body.stock, 10);
        if (!name || !category || Number.isNaN(price) || Number.isNaN(stock) || price < 0 || stock < 0) {
            return res.status(400).json({ error: "Invalid product payload." });
        }
        const id = await nextId("products", "P", 10);
        await db.query(
            "INSERT INTO products (id, name, category, price, stock, barcode, supplier) VALUES (?,?,?,?,?,?,?)",
            [id, name, category, price, stock, barcode, supplier || null]
        );
        res.json({ id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/products/:id", requireAuth, allowRoles("Admin", "Manager"), async (req, res) => {
    try {
        const name = cleanText(req.body.name, 120);
        const category = cleanText(req.body.category, 80);
        const barcode = cleanText(req.body.barcode, 80);
        const supplier = cleanText(req.body.supplier, 120);
        const price = parseFloat(req.body.price);
        const stock = parseInt(req.body.stock, 10);
        if (!name || !category || Number.isNaN(price) || Number.isNaN(stock) || price < 0 || stock < 0) {
            return res.status(400).json({ error: "Invalid product payload." });
        }
        await db.query(
            "UPDATE products SET name=?, category=?, price=?, stock=?, barcode=?, supplier=? WHERE id=?",
            [name, category, price, stock, barcode, supplier || null, req.params.id]
        );
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/products/:id", requireAuth, allowRoles("Admin", "Manager"), async (req, res) => {
    try {
        await db.query("DELETE FROM products WHERE id=?", [req.params.id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CUSTOMERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

app.get("/api/customers", requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM customers ORDER BY id");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/customers", requireAuth, async (req, res) => {
    try {
        const name = cleanText(req.body.name, 120);
        const phone = cleanText(req.body.phone, 40);
        const email = cleanText(req.body.email, 120);
        const address = cleanText(req.body.address, 200);
        const parsedPoints = toNonNegativeInt(req.body.points);
        const points = parsedPoints == null ? 0 : parsedPoints;
        if (!name) {
            return res.status(400).json({ error: "Customer name is required." });
        }
        const id = await nextId("customers", "C", 10);
        await db.query(
            "INSERT INTO customers (id, name, phone, email, address, points) VALUES (?,?,?,?,?,?)",
            [id, name, phone, email || null, address || null, points || 0]
        );
        res.json({ id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/customers/:id", requireAuth, async (req, res) => {
    try {
        const name = cleanText(req.body.name, 120);
        const phone = cleanText(req.body.phone, 40);
        const email = cleanText(req.body.email, 120);
        const address = cleanText(req.body.address, 200);
        const parsedPoints = toNonNegativeInt(req.body.points);
        const points = parsedPoints == null ? 0 : parsedPoints;
        if (!name) {
            return res.status(400).json({ error: "Customer name is required." });
        }
        await db.query(
            "UPDATE customers SET name=?, phone=?, email=?, address=?, points=? WHERE id=?",
            [name, phone, email || null, address || null, points || 0, req.params.id]
        );
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/customers/:id", requireAuth, allowRoles("Admin", "Manager"), async (req, res) => {
    try {
        await db.query("DELETE FROM customers WHERE id=?", [req.params.id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Award loyalty points
app.post("/api/customers/:id/points", requireAuth, async (req, res) => {
    try {
        const points = toPositiveInt(req.body.points);
        if (points == null) {
            return res.status(400).json({ error: "Points must be a positive integer." });
        }
        await db.query("UPDATE customers SET points = points + ? WHERE id=?", [points, req.params.id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SALES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

app.get("/api/sales", requireAuth, async (req, res) => {
    try {
        let sales;
        try {
            [sales] = await db.query(`
                SELECT s.*, IFNULL(c.name, s.customer_name_manual) AS customer_name
                FROM sales s
                LEFT JOIN customers c ON s.customer_id = c.id
                ORDER BY s.created_at DESC
            `);
        } catch (err) {
            [sales] = await db.query(`
                SELECT s.*, c.name AS customer_name
                FROM sales s
                LEFT JOIN customers c ON s.customer_id = c.id
                ORDER BY s.created_at DESC
            `);
        }
        const [items] = await db.query("SELECT * FROM sales_items");

        const result = sales.map(s => ({
            id:            s.id,
            cashier:       s.cashier,
            customerId:    s.customer_id,
            customerName:  s.customer_name,
            subtotal:      parseFloat(s.subtotal || 0),
            discount:      parseFloat(s.discount || 0),
            total:         parseFloat(s.total),
            paymentMethod: s.payment_method,
            dateTime:      s.created_at,
            items:         items
                .filter(i => i.sale_id === s.id)
                .map(i => ({ name: i.product_name, qty: i.quantity, price: parseFloat(i.price) }))
        }));
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/sales", requireAuth, async (req, res) => {
    const conn = await db.getConnection();
    try {
        pruneCheckoutCache();

        await conn.beginTransaction();

        const {
            customerId,
            customerName,
            paymentMethod,
            items,
            discount,
            cashReceived,
            payerNumber,
            provider,
            providerReference,
            paymentStatus,
            requestRef,
        } = req.body;

        const cleanedCashier = cleanText(req.user.username || "", 60);
        const cleanedPaymentMethod = cleanText(paymentMethod, 30);
        const cleanedCustomerId = cleanText(customerId, 20);
        const cleanedCustomerName = cleanText(customerName, 120);
        const cleanedPayerNumber = cleanText(payerNumber, 40);
        const cleanedProvider = cleanText(provider, 30);
        const cleanedProviderReference = cleanText(providerReference, 80);
        const cleanedPaymentStatus = cleanText(paymentStatus, 20).toUpperCase();
        const cleanedRequestRef = cleanText(requestRef, 120);

        if (cleanedRequestRef && checkoutRequestCache.has(cleanedRequestRef)) {
            return res.json(checkoutRequestCache.get(cleanedRequestRef).response);
        }

        if (!cleanedCashier || !cleanedPaymentMethod || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Missing cashier, payment method, or items." });
        }
        if (!VALID_PAYMENT_METHODS.has(cleanedPaymentMethod)) {
            return res.status(400).json({ error: "Invalid payment method." });
        }
        if (cleanedPaymentMethod === "Mobile Money" && !cleanedPayerNumber) {
            return res.status(400).json({ error: "Payer number is required for mobile money." });
        }
        if (cleanedPaymentMethod === "Mobile Money") {
            if (cleanedProvider !== "Paystack") {
                return res.status(400).json({ error: "Mobile money provider must be Paystack." });
            }
            if (!cleanedProviderReference) {
                return res.status(400).json({ error: "Paystack reference is required for mobile money payment." });
            }
            if (cleanedPaymentStatus !== "SUCCESS") {
                return res.status(400).json({ error: "Mobile money payment is not confirmed as successful." });
            }
        }

        let trustedSubtotal = 0;

        const discountValue = toNonNegativeNumber(discount) || 0;

        // Generate and insert sale ID with duplicate-key retries.
        const insertSaleRow = async (id) => {
            try {
                await conn.query(
                    "INSERT INTO sales (id, cashier, customer_id, customer_name_manual, subtotal, discount, total, payment_method) VALUES (?,?,?,?,?,?,?,?)",
                    [id, cleanedCashier, cleanedCustomerId || null, cleanedCustomerName || null, 0, 0, 0, cleanedPaymentMethod]
                );
            } catch (err) {
                const unknownColumn = err && (err.code === "ER_BAD_FIELD_ERROR" || /Unknown column/i.test(String(err.message || "")));
                if (!unknownColumn) throw err;
                await conn.query(
                    "INSERT INTO sales (id, cashier, customer_id, subtotal, discount, total, payment_method) VALUES (?,?,?,?,?,?,?)",
                    [id, cleanedCashier, cleanedCustomerId || null, 0, 0, 0, cleanedPaymentMethod]
                );
            }
        };

        let saleId = "";
        let insertedSale = false;
        for (let attempt = 0; attempt < 6; attempt++) {
            saleId = await nextId("sales", "TRX", 10);
            try {
                await insertSaleRow(saleId);
                insertedSale = true;
                break;
            } catch (err) {
                if (err && err.code === "ER_DUP_ENTRY") continue;
                throw err;
            }
        }
        if (!insertedSale) {
            throw new Error("Could not allocate a unique transaction ID. Please retry checkout.");
        }

        // Insert sale items + deduct stock
        for (const item of items) {
            const productId = item.id;
            const qty = parseInt(item.qty, 10);

            if (!productId || Number.isNaN(qty) || qty <= 0) {
                throw new Error("Invalid sale item.");
            }

            const [[product]] = await conn.query(
                "SELECT id, name, stock, price FROM products WHERE id=? FOR UPDATE",
                [productId]
            );
            if (!product) {
                throw new Error("Product not found for sale item.");
            }
            if (product.stock < qty) {
                throw new Error(`Insufficient stock for ${product.name}.`);
            }

            const unitPrice = Number.parseFloat(product.price || 0);
            trustedSubtotal += unitPrice * qty;

            await conn.query(
                "INSERT INTO sales_items (sale_id, product_id, product_name, quantity, price) VALUES (?,?,?,?,?)",
                [saleId, product.id, product.name, qty, unitPrice]
            );
            await conn.query(
                "UPDATE products SET stock = stock - ? WHERE id = ?",
                [qty, product.id]
            );
            await conn.query(
                "INSERT INTO inventory_log (product_id, change_qty, reason) VALUES (?,?,?)",
                [product.id, -qty, `Sale ${saleId}`]
            );
        }

        const subtotalValue = Number.parseFloat(trustedSubtotal.toFixed(2));
        const boundedDiscount = Math.min(discountValue, subtotalValue);
        const totalValue = Number.parseFloat((subtotalValue - boundedDiscount).toFixed(2));

        if (cleanedPaymentMethod === "Cash") {
            const cashValCheck = toNonNegativeNumber(cashReceived);
            if (cashValCheck == null || cashValCheck < totalValue) {
                throw new Error("Cash received is less than total.");
            }
        }

        await conn.query(
            "UPDATE sales SET subtotal=?, discount=?, total=? WHERE id=?",
            [subtotalValue, boundedDiscount, totalValue, saleId]
        );

        // Insert payment record
        const cashVal = cashReceived != null ? toNonNegativeNumber(cashReceived) : null;
        const changeDue = cashVal != null ? Math.max(0, cashVal - totalValue) : null;
        // Backward-compatible insert: not all existing DBs have payer_number yet.
        if (payerNumber != null) {
            try {
                await conn.query(
                    "INSERT INTO payments (sale_id, method, amount, cash_received, change_due, payer_number, provider, provider_reference, payment_status) VALUES (?,?,?,?,?,?,?,?,?)",
                    [
                        saleId,
                        cleanedPaymentMethod,
                        totalValue,
                        cashVal,
                        changeDue,
                        cleanedPayerNumber || null,
                        cleanedProvider || null,
                        cleanedProviderReference || null,
                        cleanedPaymentStatus || (cleanedPaymentMethod === "Cash" ? "SUCCESS" : "PENDING"),
                    ]
                );
            } catch (err) {
                await conn.query(
                    "INSERT INTO payments (sale_id, method, amount, cash_received, change_due) VALUES (?,?,?,?,?)",
                    [saleId, cleanedPaymentMethod, totalValue, cashVal, changeDue]
                );
            }
        } else {
            await conn.query(
                "INSERT INTO payments (sale_id, method, amount, cash_received, change_due) VALUES (?,?,?,?,?)",
                [saleId, cleanedPaymentMethod, totalValue, cashVal, changeDue]
            );
        }

        // Award loyalty points
        if (cleanedCustomerId) {
            const pts = Math.floor(totalValue);
            await conn.query("UPDATE customers SET points = points + ? WHERE id=?", [pts, cleanedCustomerId]);
        }

        await conn.commit();
        const responsePayload = {
            id: saleId,
            changeDue,
            receipt: {
                saleId,
                subtotal: subtotalValue,
                discount: boundedDiscount,
                total: totalValue,
                paymentMethod: cleanedPaymentMethod,
                cashReceived: cashVal,
                payerNumber: cleanedPayerNumber || null,
                provider: cleanedProvider || null,
                providerReference: cleanedProviderReference || null,
                customerName: cleanedCustomerName || null,
                dateTime: new Date().toISOString(),
                items: items.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price })),
            },
        };

        if (cleanedRequestRef) {
            checkoutRequestCache.set(cleanedRequestRef, { time: Date.now(), response: responsePayload });
        }

        res.json(responsePayload);
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

app.delete("/api/sales", requireAuth, allowRoles("Admin"), async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query("DELETE FROM payments");
        await conn.query("DELETE FROM sales_items");
        await conn.query("DELETE FROM sales");
        await conn.commit();
        res.json({ ok: true });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// INVENTORY
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

app.post("/api/inventory/restock", requireAuth, allowRoles("Admin", "Manager"), async (req, res) => {
    try {
        const productId = cleanText(req.body.productId, 20);
        const qty = toPositiveInt(req.body.qty);
        if (!productId || qty == null) {
            return res.status(400).json({ error: "Invalid restock payload." });
        }
        await db.query("UPDATE products SET stock = stock + ? WHERE id=?", [qty, productId]);
        await db.query(
            "INSERT INTO inventory_log (product_id, change_qty, reason) VALUES (?,?,?)",
            [productId, qty, "Manual restock"]
        );
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DASHBOARD STATS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

app.get("/api/stats", requireAuth, allowRoles("Admin", "Manager"), async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const [[{ revenue }]]   = await db.query("SELECT COALESCE(SUM(total),0) AS revenue FROM sales WHERE DATE(created_at)=?", [today]);
        const [[{ totalSales }]]= await db.query("SELECT COUNT(*) AS totalSales FROM sales");
        const [[{ totalProds }]]= await db.query("SELECT COUNT(*) AS totalProds FROM products");
        const [[{ lowStock }]]  = await db.query("SELECT COUNT(*) AS lowStock FROM products WHERE stock < 5 AND stock > 0");
        const [[{ outStock }]]  = await db.query("SELECT COUNT(*) AS outStock FROM products WHERE stock = 0");
        res.json({ revenue: parseFloat(revenue), totalSales, totalProds, lowStock, outStock });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// START
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

app.listen(PORT, () => {
    console.log(`SmartPOS API running at http://localhost:${PORT}`);
});

app.get("/api/reports/mvp", requireAuth, allowRoles("Admin", "Manager"), async (req, res) => {
    try {
        const [[todayRow]] = await db.query(
            "SELECT COUNT(*) AS totalSalesToday, COALESCE(SUM(total),0) AS totalRevenueToday FROM sales WHERE DATE(created_at)=CURDATE()"
        );
        const [[weekRow]] = await db.query(
            "SELECT COUNT(*) AS totalSalesWeek, COALESCE(SUM(total),0) AS totalRevenueWeek FROM sales WHERE YEARWEEK(created_at, 1)=YEARWEEK(CURDATE(), 1)"
        );
        const [topProducts] = await db.query(`
            SELECT si.product_name AS name, SUM(si.quantity) AS qty
            FROM sales_items si
            GROUP BY si.product_name
            ORDER BY qty DESC
            LIMIT 10
        `);
        const [lowStockProducts] = await db.query(
            "SELECT id, name, stock FROM products WHERE stock < 5 ORDER BY stock ASC, name ASC"
        );

        res.json({
            today: {
                totalSales: todayRow.totalSalesToday,
                totalRevenue: parseFloat(todayRow.totalRevenueToday || 0),
            },
            week: {
                totalSales: weekRow.totalSalesWeek,
                totalRevenue: parseFloat(weekRow.totalRevenueWeek || 0),
            },
            topProducts: topProducts.map(r => ({ name: r.name, qty: parseInt(r.qty, 10) || 0 })),
            lowStockProducts: lowStockProducts.map(r => ({ id: r.id, name: r.name, stock: parseInt(r.stock, 10) || 0 })),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

