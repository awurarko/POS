const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const bcrypt  = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const path = require("path");
const db      = require("./db");
require("dotenv").config({ path: "env.env" });

const app  = express();
const PORT = process.env.PORT || 3000;

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
        if (allowedOrigins.length === 0) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error("Origin not allowed by CORS"));
    }
}));
app.use(express.json({ limit: "1mb" }));

const frontendDir = path.resolve(__dirname, "..", "pos-system");
app.use(express.static(frontendDir));
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

// ── Helper: next ID ───────────────────────────────────────────
async function nextId(table, prefix) {
    const [rows] = await db.query(`SELECT id FROM ${table} ORDER BY id DESC LIMIT 1`);
    if (rows.length === 0) return `${prefix}001`;
    const num = parseInt(rows[0].id.replace(prefix, "")) + 1;
    return `${prefix}${String(num).padStart(3, "0")}`;
}

// ════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════

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
        const id = await nextId("users", "U");
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

        res.json({ id: u.id, username: u.username, fullName: u.full_name, role: u.role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════
// USERS
// ════════════════════════════════════════════════════════════════

app.get("/api/users", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT id, username, full_name, role, status FROM users ORDER BY id");
        res.json(rows.map(u => ({ id: u.id, username: u.username, fullName: u.full_name, role: u.role, status: u.status })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/users", async (req, res) => {
    try {
        const username = cleanText(req.body.username, 60);
        const password = cleanText(req.body.password, 255);
        const fullName = cleanText(req.body.fullName, 100);
        const role = cleanText(req.body.role, 20);
        const status = cleanText(req.body.status, 20);
        if (!username || !password || !fullName || !role || !status) {
            return res.status(400).json({ error: "Missing required user fields." });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const id = await nextId("users", "U");
        await db.query(
            "INSERT INTO users (id, username, password, full_name, role, status) VALUES (?,?,?,?,?,?)",
            [id, username, passwordHash, fullName, role, status]
        );
        res.json({ id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/users/:id", async (req, res) => {
    try {
        const username = cleanText(req.body.username, 60);
        const password = cleanText(req.body.password, 255);
        const fullName = cleanText(req.body.fullName, 100);
        const role = cleanText(req.body.role, 20);
        const status = cleanText(req.body.status, 20);
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

app.delete("/api/users/:id", async (req, res) => {
    try {
        await db.query("DELETE FROM users WHERE id=?", [req.params.id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════
// PRODUCTS
// ════════════════════════════════════════════════════════════════

app.get("/api/products", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM products ORDER BY id");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/products/barcode/:code", async (req, res) => {
    try {
        const code = (req.params.code || "").trim();
        const [[row]] = await db.query("SELECT * FROM products WHERE barcode = ? LIMIT 1", [code]);
        if (!row) return res.status(404).json({ error: "Product not found for this barcode." });
        res.json(row);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/products", async (req, res) => {
    try {
        const name = cleanText(req.body.name, 120);
        const category = cleanText(req.body.category, 80);
        const barcode = cleanText(req.body.barcode, 80);
        const supplier = cleanText(req.body.supplier, 120);
        const price = parseFloat(req.body.price);
        const stock = parseInt(req.body.stock, 10);
        if (!name || !category || Number.isNaN(price) || Number.isNaN(stock)) {
            return res.status(400).json({ error: "Invalid product payload." });
        }
        const id = await nextId("products", "P");
        await db.query(
            "INSERT INTO products (id, name, category, price, stock, barcode, supplier) VALUES (?,?,?,?,?,?,?)",
            [id, name, category, price, stock, barcode, supplier || null]
        );
        res.json({ id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/products/:id", async (req, res) => {
    try {
        const name = cleanText(req.body.name, 120);
        const category = cleanText(req.body.category, 80);
        const barcode = cleanText(req.body.barcode, 80);
        const supplier = cleanText(req.body.supplier, 120);
        const price = parseFloat(req.body.price);
        const stock = parseInt(req.body.stock, 10);
        if (!name || !category || Number.isNaN(price) || Number.isNaN(stock)) {
            return res.status(400).json({ error: "Invalid product payload." });
        }
        await db.query(
            "UPDATE products SET name=?, category=?, price=?, stock=?, barcode=?, supplier=? WHERE id=?",
            [name, category, price, stock, barcode, supplier || null, req.params.id]
        );
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/products/:id", async (req, res) => {
    try {
        await db.query("DELETE FROM products WHERE id=?", [req.params.id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════
// CUSTOMERS
// ════════════════════════════════════════════════════════════════

app.get("/api/customers", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM customers ORDER BY id");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/customers", async (req, res) => {
    try {
        const name = cleanText(req.body.name, 120);
        const phone = cleanText(req.body.phone, 40);
        const email = cleanText(req.body.email, 120);
        const address = cleanText(req.body.address, 200);
        const points = parseInt(req.body.points, 10) || 0;
        if (!name) {
            return res.status(400).json({ error: "Customer name is required." });
        }
        const id = await nextId("customers", "C");
        await db.query(
            "INSERT INTO customers (id, name, phone, email, address, points) VALUES (?,?,?,?,?,?)",
            [id, name, phone, email || null, address || null, points || 0]
        );
        res.json({ id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/customers/:id", async (req, res) => {
    try {
        const name = cleanText(req.body.name, 120);
        const phone = cleanText(req.body.phone, 40);
        const email = cleanText(req.body.email, 120);
        const address = cleanText(req.body.address, 200);
        const points = parseInt(req.body.points, 10) || 0;
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

app.delete("/api/customers/:id", async (req, res) => {
    try {
        await db.query("DELETE FROM customers WHERE id=?", [req.params.id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Award loyalty points
app.post("/api/customers/:id/points", async (req, res) => {
    try {
        const { points } = req.body;
        await db.query("UPDATE customers SET points = points + ? WHERE id=?", [points, req.params.id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════
// SALES
// ════════════════════════════════════════════════════════════════

app.get("/api/sales", async (req, res) => {
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

app.post("/api/sales", async (req, res) => {
    const conn = await db.getConnection();
    try {
        pruneCheckoutCache();

        await conn.beginTransaction();

        const {
            cashier,
            customerId,
            customerName,
            total,
            paymentMethod,
            items,
            subtotal,
            discount,
            cashReceived,
            payerNumber,
            requestRef,
        } = req.body;

        const cleanedCashier = cleanText(cashier, 60);
        const cleanedPaymentMethod = cleanText(paymentMethod, 30);
        const cleanedCustomerName = cleanText(customerName, 120);
        const cleanedPayerNumber = cleanText(payerNumber, 40);
        const cleanedRequestRef = cleanText(requestRef, 120);

        if (cleanedRequestRef && checkoutRequestCache.has(cleanedRequestRef)) {
            return res.json(checkoutRequestCache.get(cleanedRequestRef).response);
        }

        if (!cleanedCashier || !cleanedPaymentMethod || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Missing cashier, payment method, or items." });
        }

        const calcSubtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
        const discountValue = Math.max(0, parseFloat(discount || 0));
        const subtotalValue = parseFloat(subtotal || calcSubtotal);
        const totalValue = parseFloat(total || Math.max(0, subtotalValue - discountValue));

        if (cleanedPaymentMethod === "Cash" && cashReceived != null) {
            const cashVal = parseFloat(cashReceived);
            if (Number.isNaN(cashVal) || cashVal < totalValue) {
                return res.status(400).json({ error: "Cash received is less than total." });
            }
        }

        // Generate sale ID
        const [last] = await conn.query("SELECT id FROM sales ORDER BY id DESC LIMIT 1");
        const num    = last.length ? parseInt(last[0].id.replace("TRX", "")) + 1 : 1;
        const saleId = "TRX" + String(num).padStart(3, "0");

        // Insert sale (backward-compatible for DBs without customer_name_manual column)
        try {
            await conn.query(
                "INSERT INTO sales (id, cashier, customer_id, customer_name_manual, subtotal, discount, total, payment_method) VALUES (?,?,?,?,?,?,?,?)",
                [saleId, cleanedCashier, customerId || null, cleanedCustomerName || null, subtotalValue, discountValue, totalValue, cleanedPaymentMethod]
            );
        } catch (err) {
            await conn.query(
                "INSERT INTO sales (id, cashier, customer_id, subtotal, discount, total, payment_method) VALUES (?,?,?,?,?,?,?)",
                [saleId, cleanedCashier, customerId || null, subtotalValue, discountValue, totalValue, cleanedPaymentMethod]
            );
        }

        // Insert sale items + deduct stock
        for (const item of items) {
            const productId = item.id;
            const qty = parseInt(item.qty, 10);

            if (!productId || Number.isNaN(qty) || qty <= 0) {
                throw new Error("Invalid sale item.");
            }

            const [[product]] = await conn.query(
                "SELECT id, name, stock FROM products WHERE id=? FOR UPDATE",
                [productId]
            );
            if (!product) {
                throw new Error("Product not found for sale item.");
            }
            if (product.stock < qty) {
                throw new Error(`Insufficient stock for ${product.name}.`);
            }

            await conn.query(
                "INSERT INTO sales_items (sale_id, product_id, product_name, quantity, price) VALUES (?,?,?,?,?)",
                [saleId, product.id, product.name, qty, item.price]
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

        // Insert payment record
        const cashVal = cashReceived != null ? parseFloat(cashReceived) : null;
        const changeDue = cashVal != null ? Math.max(0, cashVal - totalValue) : null;
        // Backward-compatible insert: not all existing DBs have payer_number yet.
        if (payerNumber != null) {
            try {
                await conn.query(
                    "INSERT INTO payments (sale_id, method, amount, cash_received, change_due, payer_number) VALUES (?,?,?,?,?,?)",
                    [saleId, cleanedPaymentMethod, totalValue, cashVal, changeDue, cleanedPayerNumber || null]
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
        if (customerId) {
            const pts = Math.floor(totalValue);
            await conn.query("UPDATE customers SET points = points + ? WHERE id=?", [pts, customerId]);
        }

        await conn.commit();
        const responsePayload = {
            id: saleId,
            changeDue,
            receipt: {
                saleId,
                subtotal: subtotalValue,
                discount: discountValue,
                total: totalValue,
                paymentMethod: cleanedPaymentMethod,
                cashReceived: cashVal,
                payerNumber: cleanedPayerNumber || null,
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

app.delete("/api/sales", async (req, res) => {
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

// ════════════════════════════════════════════════════════════════
// INVENTORY
// ════════════════════════════════════════════════════════════════

app.post("/api/inventory/restock", async (req, res) => {
    try {
        const { productId, qty } = req.body;
        await db.query("UPDATE products SET stock = stock + ? WHERE id=?", [qty, productId]);
        await db.query(
            "INSERT INTO inventory_log (product_id, change_qty, reason) VALUES (?,?,?)",
            [productId, qty, "Manual restock"]
        );
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ════════════════════════════════════════════════════════════════

app.get("/api/stats", async (req, res) => {
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

// ════════════════════════════════════════════════════════════════
// START
// ════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
    console.log(`SmartPOS API running at http://localhost:${PORT}`);
});

app.get("/api/reports/mvp", async (req, res) => {
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