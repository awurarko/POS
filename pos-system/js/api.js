// Central API client â€” replaces all localStorage calls
// All functions return parsed JSON or throw on error

function buildApiCandidates() {
    const host = window.location.hostname || "localhost";
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    const apiBaseFromQuery = new URLSearchParams(window.location.search).get("apiBase");
    if (apiBaseFromQuery && apiBaseFromQuery.trim()) {
        window.localStorage.setItem("smartpos.apiBase", apiBaseFromQuery.trim());
    }

    const manual = (window.localStorage.getItem("smartpos.apiBase") || "").trim();
    const allowRemoteOnLocalhost = window.localStorage.getItem("smartpos.allowRemoteOnLocalhost") === "true";
    const deployedSameOrigin = `${window.location.origin}/api`;
    const isLocalHost = ["localhost", "127.0.0.1"].includes(host);

    const isLocalApiBase = (value) => {
        if (!value) return false;
        try {
            const parsed = new URL(value, window.location.origin);
            return ["localhost", "127.0.0.1"].includes(parsed.hostname);
        } catch {
            return false;
        }
    };

    // Prevent stale deployed overrides from breaking localhost login/testing,
    // unless user explicitly opted in to share data with deployed backend.
    if (isLocalHost && manual && !isLocalApiBase(manual) && !allowRemoteOnLocalhost) {
        window.localStorage.removeItem("smartpos.apiBase");
    }

    const candidates = isLocalHost
        ? [
            `${protocol}//${host}:3001/api`,
            "http://localhost:3001/api",
            "http://127.0.0.1:3001/api",
            isLocalApiBase(manual) ? manual : "",
        ].filter(Boolean)
        : [
            manual,
            deployedSameOrigin,
            "http://localhost:3001/api",
            "http://127.0.0.1:3001/api",
        ].filter(Boolean);

    return [...new Set(candidates)];
}

const API_BASE_CANDIDATES = buildApiCandidates();
let activeBase = API_BASE_CANDIDATES[0];
const API_TIMEOUT_MS = 10000;

function installErrorDialog() {
    if (typeof window === "undefined" || window.__smartPosErrorDialogInstalled) return;
    window.__smartPosErrorDialogInstalled = true;

    function ensureDialog() {
        if (!document.getElementById("smartposErrorDialogStyle")) {
            const style = document.createElement("style");
            style.id = "smartposErrorDialogStyle";
            style.textContent = `
                .smartpos-error-backdrop {
                    position: fixed;
                    inset: 0;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    background: rgba(16, 24, 40, 0.55);
                    padding: 16px;
                    z-index: 11000;
                }
                .smartpos-error-backdrop.open { display: flex; }
                .smartpos-error-dialog {
                    width: min(460px, 100%);
                    background: #ffffff;
                    border-radius: 14px;
                    border: 1px solid #e6d7f3;
                    box-shadow: 0 20px 40px -24px rgba(15, 23, 42, 0.6);
                    overflow: hidden;
                    font-family: 'Times New Roman', Times, serif;
                }
                .smartpos-error-head {
                    background: linear-gradient(120deg, #2c0f3b 0%, #1f0e26 100%);
                    color: #fff;
                    padding: 12px 16px;
                    font-size: 16px;
                    font-weight: 700;
                }
                .smartpos-error-body {
                    padding: 16px;
                    color: #3a2f42;
                    font-size: 14px;
                    line-height: 1.5;
                    white-space: pre-wrap;
                    word-break: break-word;
                }
                .smartpos-error-foot {
                    padding: 0 16px 16px;
                    display: flex;
                    justify-content: flex-end;
                }
                .smartpos-error-btn {
                    border: 1px solid #d2bfeb;
                    background: #2c0f3b;
                    color: #fff;
                    border-radius: 8px;
                    padding: 7px 16px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: background 0.2s ease;
                }
                .smartpos-error-btn:hover { background: #4d1d66; }
            `;
            document.head.appendChild(style);
        }

        let backdrop = document.getElementById("smartposErrorBackdrop");
        if (!backdrop) {
            backdrop = document.createElement("div");
            backdrop.id = "smartposErrorBackdrop";
            backdrop.className = "smartpos-error-backdrop";
            backdrop.innerHTML = `
                <div class="smartpos-error-dialog" role="alertdialog" aria-modal="true" aria-labelledby="smartposErrorTitle" aria-describedby="smartposErrorMessage">
                    <div class="smartpos-error-head" id="smartposErrorTitle">Error</div>
                    <div class="smartpos-error-body" id="smartposErrorMessage"></div>
                    <div class="smartpos-error-foot">
                        <button type="button" class="smartpos-error-btn" id="smartposErrorCloseBtn">OK</button>
                    </div>
                </div>
            `;
            document.body.appendChild(backdrop);
        }
        return backdrop;
    }

    function closeDialog() {
        const backdrop = document.getElementById("smartposErrorBackdrop");
        if (!backdrop) return;
        backdrop.classList.remove("open");
    }

    window.showErrorDialog = function showErrorDialog(message, title = "Error") {
        const backdrop = ensureDialog();
        const titleNode = document.getElementById("smartposErrorTitle");
        const messageNode = document.getElementById("smartposErrorMessage");
        const closeBtn = document.getElementById("smartposErrorCloseBtn");

        titleNode.textContent = title;
        messageNode.textContent = String(message || "An unexpected error occurred.");
        backdrop.classList.add("open");

        closeBtn.onclick = closeDialog;
        backdrop.onclick = (event) => {
            if (event.target === backdrop) closeDialog();
        };
        closeBtn.focus();
    };

    const nativeAlert = typeof window.alert === "function" ? window.alert.bind(window) : null;
    window.nativeAlert = nativeAlert;
    window.alert = function smartPosCustomAlert(message) {
        window.showErrorDialog(message, "Error");
    };

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeDialog();
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", ensureDialog, { once: true });
    } else {
        ensureDialog();
    }
}

installErrorDialog();

function getOrderedApiBases() {
    if (!activeBase) return API_BASE_CANDIDATES;
    return [activeBase, ...API_BASE_CANDIDATES.filter(base => base !== activeBase)];
}

async function apiFetch(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const retries = method === "GET" ? 1 : 0;
    const token = typeof getToken === "function" ? getToken() : (sessionStorage.getItem("authToken") || "");

    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

        try {
            let networkError;
            let lastAppError = null;

            for (const base of getOrderedApiBases()) {
                try {
                    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
                    if (token && !path.startsWith("/login") && !path.startsWith("/setup/")) {
                        headers.Authorization = `Bearer ${token}`;
                    }

                    const res = await fetch(base + path, {
                        headers,
                        ...options,
                        signal: controller.signal,
                    });

                    const text = await res.text();
                    let data = {};
                    if (text) {
                        try {
                            data = JSON.parse(text);
                        } catch (e) {
                            // Some wrong origins return HTML pages for /api/* routes.
                            // Skip those and try the next candidate.
                            if (/^\s*</.test(text)) {
                                lastAppError = new Error(`Unexpected HTML response from ${base}${path}`);
                                continue;
                            }
                            lastAppError = new Error("Invalid response from API.");
                            continue;
                        }
                    }

                    if (res.status === 401 && !path.startsWith("/login") && !path.startsWith("/setup/")) {
                        if (typeof clearSession === "function") clearSession();
                        if (!window.location.pathname.endsWith("index.html")) {
                            window.location.href = "index.html";
                        }
                        throw new Error("Your session expired. Please sign in again.");
                    }

                    if (!res.ok) {
                        lastAppError = new Error(data.error || "Server error");
                        continue;
                    }

                    activeBase = base;
                    return data;
                } catch (err) {
                    networkError = err;
                    // Retry with another candidate only for network-level failures.
                    if (err.name !== "TypeError" && err.name !== "AbortError") {
                        throw err;
                    }
                }
            }

            throw lastAppError || networkError || new Error("Network request failed");
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

// â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const API = {

    setupStatus: () => apiFetch("/setup/status"),
    createFirstAdmin: (data) => apiFetch("/setup/first-admin", { method:"POST", body: JSON.stringify(data) }),

    login: (username, password) =>
        apiFetch("/login", { method:"POST", body: JSON.stringify({ username, password }) }),

    // â”€â”€ Users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    getUsers:    ()       => apiFetch("/users"),
    createUser:  (data)   => apiFetch("/users",      { method:"POST",   body: JSON.stringify(data) }),
    updateUser:  (id, d)  => apiFetch(`/users/${id}`,{ method:"PUT",    body: JSON.stringify(d)    }),
    deleteUser:  (id)     => apiFetch(`/users/${id}`,{ method:"DELETE" }),

    // â”€â”€ Products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    getProducts:   ()      => apiFetch("/products"),
    getProductByBarcode: (code) => apiFetch(`/products/barcode/${encodeURIComponent(code)}`),
    createProduct: (data)  => apiFetch("/products",       { method:"POST",   body: JSON.stringify(data) }),
    updateProduct: (id, d) => apiFetch(`/products/${id}`, { method:"PUT",    body: JSON.stringify(d)    }),
    deleteProduct: (id)    => apiFetch(`/products/${id}`, { method:"DELETE" }),

    // â”€â”€ Customers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    getCustomers:   ()      => apiFetch("/customers"),
    createCustomer: (data)  => apiFetch("/customers",       { method:"POST",   body: JSON.stringify(data) }),
    updateCustomer: (id, d) => apiFetch(`/customers/${id}`, { method:"PUT",    body: JSON.stringify(d)    }),
    deleteCustomer: (id)    => apiFetch(`/customers/${id}`, { method:"DELETE" }),
    addCustomerPoints: (id, points) =>
        apiFetch(`/customers/${id}/points`, { method:"POST", body: JSON.stringify({ points }) }),

    // â”€â”€ Sales â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    getSales:    ()     => apiFetch("/sales"),
    createSale:  (data) => apiFetch("/sales", { method:"POST", body: JSON.stringify(data) }),
    clearSales:  ()     => apiFetch("/sales", { method:"DELETE" }),

    // â”€â”€ Paystack payments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    initiatePaystackPayment: (data) =>
        apiFetch("/payments/paystack/initiate", { method:"POST", body: JSON.stringify(data) }),
    getPaystackPaymentStatus: (reference) =>
        apiFetch(`/payments/paystack/status/${encodeURIComponent(reference)}`),

    // â”€â”€ Inventory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    restock: (productId, qty) =>
        apiFetch("/inventory/restock", { method:"POST", body: JSON.stringify({ productId, qty }) }),

    // â”€â”€ Dashboard stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    getStats: () => apiFetch("/stats"),
    getReportsMvp: () => apiFetch("/reports/mvp"),

};
