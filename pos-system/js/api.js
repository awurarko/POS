// Central API client — replaces all localStorage calls
// All functions return parsed JSON or throw on error

function buildApiCandidates() {
    const host = window.location.hostname || "localhost";
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    const manual = window.localStorage.getItem("smartpos.apiBase") || "";
    const deployedSameOrigin = `${window.location.origin}/api`;
    const isLocalHost = ["localhost", "127.0.0.1"].includes(host);

    const candidates = [
        manual.trim(),
        isLocalHost ? `${protocol}//${host}:3001/api` : deployedSameOrigin,
        "http://localhost:3001/api",
        "http://127.0.0.1:3001/api",
    ].filter(Boolean);

    return [...new Set(candidates)];
}

const API_BASE_CANDIDATES = buildApiCandidates();
let activeBase = API_BASE_CANDIDATES[0];
const API_TIMEOUT_MS = 10000;

function getOrderedApiBases() {
    if (!activeBase) return API_BASE_CANDIDATES;
    return [activeBase, ...API_BASE_CANDIDATES.filter(base => base !== activeBase)];
}

async function apiFetch(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const retries = method === "GET" ? 1 : 0;

    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

        try {
            let res;
            let networkError;

            for (const base of getOrderedApiBases()) {
                try {
                    res = await fetch(base + path, {
                        headers: { "Content-Type": "application/json" },
                        ...options,
                        signal: controller.signal,
                    });
                    activeBase = base;
                    break;
                } catch (err) {
                    networkError = err;
                    // Retry with another candidate only for network-level failures.
                    if (err.name !== "TypeError" && err.name !== "AbortError") {
                        throw err;
                    }
                }
            }

            if (!res) {
                throw networkError || new Error("Network request failed");
            }

            const text = await res.text();
            const data = text ? JSON.parse(text) : {};

            if (!res.ok) throw new Error(data.error || "Server error");
            return data;
        } catch (error) {
            if (attempt >= retries) {
                if (error.name === "AbortError") {
                    throw new Error("Request timed out. Please try again.");
                }
                if (error.name === "TypeError") {
                    throw new Error(
                        `Cannot reach SmartPOS API. Start the backend server on port 3001. Tried: ${API_BASE_CANDIDATES.join(", ")}`
                    );
                }
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 250));
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

// ── Auth ──────────────────────────────────────────────────────
const API = {

    setupStatus: () => apiFetch("/setup/status"),
    createFirstAdmin: (data) => apiFetch("/setup/first-admin", { method:"POST", body: JSON.stringify(data) }),

    login: (username, hashedPassword) =>
        apiFetch("/login", { method:"POST", body: JSON.stringify({ username, password: hashedPassword }) }),

    // ── Users ─────────────────────────────────────────────────
    getUsers:    ()       => apiFetch("/users"),
    createUser:  (data)   => apiFetch("/users",      { method:"POST",   body: JSON.stringify(data) }),
    updateUser:  (id, d)  => apiFetch(`/users/${id}`,{ method:"PUT",    body: JSON.stringify(d)    }),
    deleteUser:  (id)     => apiFetch(`/users/${id}`,{ method:"DELETE" }),

    // ── Products ──────────────────────────────────────────────
    getProducts:   ()      => apiFetch("/products"),
    getProductByBarcode: (code) => apiFetch(`/products/barcode/${encodeURIComponent(code)}`),
    createProduct: (data)  => apiFetch("/products",       { method:"POST",   body: JSON.stringify(data) }),
    updateProduct: (id, d) => apiFetch(`/products/${id}`, { method:"PUT",    body: JSON.stringify(d)    }),
    deleteProduct: (id)    => apiFetch(`/products/${id}`, { method:"DELETE" }),

    // ── Customers ─────────────────────────────────────────────
    getCustomers:   ()      => apiFetch("/customers"),
    createCustomer: (data)  => apiFetch("/customers",       { method:"POST",   body: JSON.stringify(data) }),
    updateCustomer: (id, d) => apiFetch(`/customers/${id}`, { method:"PUT",    body: JSON.stringify(d)    }),
    deleteCustomer: (id)    => apiFetch(`/customers/${id}`, { method:"DELETE" }),
    addCustomerPoints: (id, points) =>
        apiFetch(`/customers/${id}/points`, { method:"POST", body: JSON.stringify({ points }) }),

    // ── Sales ─────────────────────────────────────────────────
    getSales:    ()     => apiFetch("/sales"),
    createSale:  (data) => apiFetch("/sales", { method:"POST", body: JSON.stringify(data) }),
    clearSales:  ()     => apiFetch("/sales", { method:"DELETE" }),

    // ── Inventory ─────────────────────────────────────────────
    restock: (productId, qty) =>
        apiFetch("/inventory/restock", { method:"POST", body: JSON.stringify({ productId, qty }) }),

    // ── Dashboard stats ───────────────────────────────────────
    getStats: () => apiFetch("/stats"),
    getReportsMvp: () => apiFetch("/reports/mvp"),
};