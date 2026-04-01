let cart = [];
let scannerStream = null;
let scannerTimer = null;
let barcodeDetector = null;
let zxingReader = null;
let toastTimer = null;

let cachedProducts = [];
let currentProductPage = 1;
const PRODUCTS_PER_PAGE = 24;
const CEDI = "GH\u20B5";
const PENDING_PAYSTACK_KEY = "smartpos.pendingPaystackCheckout";
let pendingPaystackWatcher = null;
let pendingPaystackAuthorizationUrl = "";

function debounce(fn, delay) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delay);
    };
}

async function fetchProducts() {
    try {
        cachedProducts = await API.getProducts();
    } catch (e) {
        console.error("Could not fetch products:", e);
        cachedProducts = [];
    }
    return cachedProducts;
}

function getProducts() {
    return cachedProducts;
}

function showToast(message) {
    const toast = document.getElementById("posToast");
    if (!toast) return;
    toast.innerText = message;
    toast.style.display = "block";
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.style.display = "none";
    }, 2200);
}

function showPaystackOpenToast(url) {
    const toast = document.getElementById("posToast");
    if (!toast) return;
    pendingPaystackAuthorizationUrl = url;
    toast.innerHTML = 'Popup blocked. <button type="button" onclick="openPendingPaystackAuthorization()" style="margin-left:8px;border:0;background:#fff;color:#1f0e26;border-radius:6px;padding:4px 8px;font-weight:700;">Open Paystack</button>';
    toast.style.display = "block";
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.style.display = "none";
    }, 12000);
}

function openPendingPaystackAuthorization() {
    if (!pendingPaystackAuthorizationUrl) return;
    window.open(pendingPaystackAuthorizationUrl, "_blank", "noopener");
}

function showReceiptSuccessTick() {
    const tick = document.getElementById("receiptSuccessTick");
    if (!tick) return;
    tick.style.display = "block";
}

function hideReceiptSuccessTick() {
    const tick = document.getElementById("receiptSuccessTick");
    if (!tick) return;
    tick.style.display = "none";
}

function cleanupReceiptModalArtifacts() {
    // Ensure backdrop/body state is fully reset after closing the receipt modal.
    const anyOpenModal = document.querySelector(".modal.show");
    if (!anyOpenModal) {
        document.querySelectorAll(".modal-backdrop").forEach(el => el.remove());
        document.body.classList.remove("modal-open");
        document.body.style.removeProperty("padding-right");
    }
}

function setScanStatus(message) {
    const status = document.getElementById("scanStatus");
    if (status) status.innerText = message;
}

function openMobileCart() {
    const panel = document.getElementById("cartPanel");
    const overlay = document.getElementById("mobileCartOverlay");
    if (panel) panel.classList.add("mobile-open");
    if (overlay) overlay.style.display = "block";
}

function closeMobileCart() {
    const panel = document.getElementById("cartPanel");
    const overlay = document.getElementById("mobileCartOverlay");
    if (panel) panel.classList.remove("mobile-open");
    if (overlay) overlay.style.display = "none";
}

function renderProductList(filter = "") {
    const grid = document.getElementById("productGrid");
    if (!grid) return;

    const lf = filter.toLowerCase();
    const filtered = getProducts().filter(p =>
        p.name.toLowerCase().includes(lf) ||
        (p.barcode || "").includes(filter)
    );

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:36px 20px;color:#9a8aaa;">
                No products found.
            </div>`;
        renderProductPagination(0, filter);
        return;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE));
    currentProductPage = Math.min(Math.max(1, currentProductPage), totalPages);
    const startIdx = (currentProductPage - 1) * PRODUCTS_PER_PAGE;
    const visibleProducts = filtered.slice(startIdx, startIdx + PRODUCTS_PER_PAGE);

    grid.innerHTML = visibleProducts.map(p => {
        const stockClass = p.stock < 5 ? "low" : "";
        const stockText = p.stock === 0 ? "Out of stock" : p.stock < 5 ? `Only ${p.stock} left` : `${p.stock} in stock`;
        const tileClass = p.stock === 0 ? "product-tile out-of-stock" : "product-tile";
        const price = parseFloat(p.price || 0);

        return `
            <div class="${tileClass}" onclick="addToCart('${p.id}')">
                <div class="p-name">${p.name}</div>
                <div class="p-price">${CEDI}${price.toFixed(2)}</div>
                <div class="p-stock ${stockClass}">${stockText}</div>
            </div>`;
    }).join("");

    renderProductPagination(filtered.length, filter);
}

function renderProductPagination(totalItems, filter) {
    const wrap = document.getElementById("productPagination");
    if (!wrap) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / PRODUCTS_PER_PAGE));
    if (totalItems <= PRODUCTS_PER_PAGE) {
        wrap.innerHTML = "";
        return;
    }

    const prevDisabled = currentProductPage <= 1 ? "disabled" : "";
    const nextDisabled = currentProductPage >= totalPages ? "disabled" : "";

    wrap.innerHTML = `
        <button class="btn btn-sm" ${prevDisabled} style="border:0.5px solid #c8b8d8;" onclick="changeProductPage(-1, '${String(filter).replace(/'/g, "&#39;")}')">Prev</button>
        <span>Page ${currentProductPage} of ${totalPages}</span>
        <button class="btn btn-sm" ${nextDisabled} style="border:0.5px solid #c8b8d8;" onclick="changeProductPage(1, '${String(filter).replace(/'/g, "&#39;")}')">Next</button>
    `;
}

function changeProductPage(delta, filter) {
    currentProductPage += delta;
    renderProductList(filter || "");
}

function buildRequestRef() {
    return `sale-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function savePendingPaystackCheckout(payload) {
    try {
        sessionStorage.setItem(PENDING_PAYSTACK_KEY, JSON.stringify(payload));
    } catch (e) {}
}

function getPendingPaystackCheckout() {
    try {
        const raw = sessionStorage.getItem(PENDING_PAYSTACK_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function clearPendingPaystackCheckout() {
    try {
        sessionStorage.removeItem(PENDING_PAYSTACK_KEY);
    } catch (e) {}
}

function resetCheckoutUiAfterSale() {
    cart = [];
    renderCart();
    closeMobileCart();
    populateCustomerDropdown();

    const cashInput = document.getElementById("cashReceived");
    if (cashInput) cashInput.value = "";
    const payerInput = document.getElementById("payerNumber");
    if (payerInput) payerInput.value = "";
    const payerEmailInput = document.getElementById("payerEmail");
    if (payerEmailInput) payerEmailInput.value = "";
    const discountInput = document.getElementById("discountInput");
    if (discountInput) discountInput.value = "0.00";
}

function renderSaleReceiptFromResult(result, fallback) {
    const receipt = result.receipt || {
        saleId: result.id,
        dateTime: new Date().toISOString(),
        subtotal: fallback.subtotal,
        discount: fallback.discount,
        total: fallback.total,
        paymentMethod: fallback.paymentMethod,
        cashReceived: fallback.cashReceived,
        customerName: fallback.customerName,
        payerNumber: fallback.payerNumber,
        items: fallback.items,
    };

    showReceipt(
        receipt.saleId,
        new Date(receipt.dateTime).toLocaleDateString() + " " + new Date(receipt.dateTime).toLocaleTimeString(),
        parseFloat(receipt.subtotal || 0),
        parseFloat(receipt.discount || 0),
        parseFloat(receipt.total || 0),
        fallback.paymentMethodLabel || receipt.paymentMethod,
        receipt.items || fallback.items,
        receipt.cashReceived,
        result.changeDue,
        receipt.customerName,
        receipt.payerNumber
    );
}

async function resumePendingPaystackCheckout() {
    const pending = getPendingPaystackCheckout();
    if (!pending || !pending.providerReference || !pending.salePayload) return;

    try {
        const statusRes = await API.getPaystackPaymentStatus(pending.providerReference);
        if (statusRes.status === "FAILED") {
            clearPendingPaystackCheckout();
            showToast("Pending Paystack payment failed. Sale not recorded.");
            return;
        }
        if (statusRes.status !== "SUCCESS") return;

        const payload = {
            ...pending.salePayload,
            paymentStatus: "SUCCESS",
        };

        const result = await API.createSale(payload);
        clearPendingPaystackCheckout();
        renderSaleReceiptFromResult(result, pending.fallback || {});
        resetCheckoutUiAfterSale();
        await fetchProducts();
        renderProductList(document.getElementById("searchInput")?.value || "");
        showToast("Payment verified and sale recorded.");
    } catch (e) {
        // Keep pending record for another retry if the user refreshes.
    }
}

function startPendingPaystackWatcher() {
    if (pendingPaystackWatcher) return;
    pendingPaystackWatcher = setInterval(() => {
        if (document.hidden) return;
        resumePendingPaystackCheckout();
    }, 4000);
}

function isMobileMoneyMethod(method) {
    return String(method || "").toLowerCase().startsWith("mobile money");
}

function addToCart(productId) {
    const product = getProducts().find(p => p.id === productId);
    if (!product || product.stock <= 0) return;

    const existing = cart.find(i => i.id === productId);
    if (existing) {
        if (existing.qty >= product.stock) {
            alert("Not enough stock available.");
            return;
        }
        existing.qty += 1;
    } else {
        cart.push({ id: product.id, name: product.name, price: parseFloat(product.price || 0), qty: 1 });
    }

    renderCart();
}

function changeQty(index, delta) {
    const row = cart[index];
    if (!row) return;

    const product = getProducts().find(p => p.id === row.id);
    row.qty += delta;

    if (row.qty <= 0) {
        cart.splice(index, 1);
    } else if (product && row.qty > product.stock) {
        row.qty = product.stock;
    }

    renderCart();
}

function removeItem(index) {
    cart.splice(index, 1);
    renderCart();
}

function getDiscountValue(subtotal) {
    const input = document.getElementById("discountInput");
    const value = input ? parseFloat(input.value) : 0;
    const safe = Number.isNaN(value) ? 0 : value;
    return Math.max(0, Math.min(safe, subtotal));
}

function updateTotals(subtotal) {
    const discount = getDiscountValue(subtotal);
    const total = Math.max(0, subtotal - discount);

    const subtotalEl = document.getElementById("subtotal");
    const totalEl = document.getElementById("total");
    if (subtotalEl) subtotalEl.innerText = subtotal.toFixed(2);
    if (totalEl) totalEl.innerText = total.toFixed(2);

    const cashInput = document.getElementById("cashReceived");
    const cashVal = cashInput ? parseFloat(cashInput.value) : 0;
    const change = !Number.isNaN(cashVal) && cashVal > total ? cashVal - total : 0;
    const changeEl = document.getElementById("changeDue");
    if (changeEl) changeEl.innerText = change.toFixed(2);
}

function renderCart() {
    const cartEl = document.getElementById("cart");
    if (!cartEl) return;

    const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

    if (cart.length === 0) {
        cartEl.innerHTML = `<div style="text-align:center;padding:30px 14px;color:#b09fc0;">Cart is empty</div>`;
        updateTotals(0);
        return;
    }

    cartEl.innerHTML = cart.map((item, i) => `
        <div class="cart-item">
            <span class="ci-name">${item.name}</span>
            <div class="qty-controls">
                <button class="qty-btn" onclick="changeQty(${i}, -1)">-</button>
                <span style="min-width:16px;text-align:center;">${item.qty}</span>
                <button class="qty-btn" onclick="changeQty(${i}, 1)">+</button>
            </div>
            <span class="ci-subtotal">${CEDI}${(item.price * item.qty).toFixed(2)}</span>
            <button class="rm-btn" onclick="removeItem(${i})">âœ•</button>
        </div>
    `).join("");

    updateTotals(subtotal);
}

async function handleScannedCode(code) {
    try {
        const product = await API.getProductByBarcode(code);
        if (!product || !product.id) {
            showToast("Barcode not found.");
            setScanStatus(`Scanned ${code}, no match`);
            return;
        }
        addToCart(product.id);
        setScanStatus(`Added ${product.name}`);
        stopBarcodeScanner();
    } catch (e) {
        showToast("Barcode not found.");
        setScanStatus(`Scanned ${code}, no match`);
    }
}

async function detectFromVideoFrame() {
    const video = document.getElementById("barcodeVideo");
    if (!video || video.readyState < 2 || !barcodeDetector) return;

    try {
        const barcodes = await barcodeDetector.detect(video);
        if (barcodes && barcodes.length > 0) {
            const raw = (barcodes[0].rawValue || "").trim();
            if (raw) await handleScannedCode(raw);
        }
    } catch (e) {
        setScanStatus("Scanning error.");
    }
}

async function startBarcodeScanner() {
    const video = document.getElementById("barcodeVideo");
    const btn = document.getElementById("scanToggleBtn");
    if (!video || !btn) return;

    try {
        scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = scannerStream;
        video.style.display = "block";
        btn.innerText = "Stop Camera Scan";

        if ("BarcodeDetector" in window) {
            barcodeDetector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e", "qr_code"] });
            setScanStatus("Camera active. Point at barcode.");
            if (scannerTimer) clearInterval(scannerTimer);
            scannerTimer = setInterval(detectFromVideoFrame, 300);
            return;
        }

        if (window.ZXing && window.ZXing.BrowserMultiFormatReader) {
            setScanStatus("Using fallback scanner...");
            zxingReader = new window.ZXing.BrowserMultiFormatReader();
            zxingReader.decodeFromVideoDevice(null, video, (result) => {
                if (result && result.getText) {
                    handleScannedCode(result.getText());
                }
            });
            return;
        }

        setScanStatus("Scanner not supported in this browser.");
        alert("Camera scanning is not supported in this browser.");
    } catch (e) {
        setScanStatus("Could not access camera.");
        alert("Unable to start camera scanner. Check camera permissions.");
    }
}

function stopBarcodeScanner() {
    const video = document.getElementById("barcodeVideo");
    const btn = document.getElementById("scanToggleBtn");

    if (scannerTimer) {
        clearInterval(scannerTimer);
        scannerTimer = null;
    }
    if (zxingReader) {
        try { zxingReader.reset(); } catch (e) {}
        zxingReader = null;
    }
    if (scannerStream) {
        scannerStream.getTracks().forEach(t => t.stop());
        scannerStream = null;
    }

    if (video) {
        video.srcObject = null;
        video.style.display = "none";
    }
    if (btn) btn.innerText = "Start Camera Scan";
    setScanStatus("Scanner idle");
}

function toggleBarcodeScanner() {
    if (scannerStream) stopBarcodeScanner();
    else startBarcodeScanner();
}

async function ensureCustomerByName(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;

    const selectedId = document.getElementById("customerSelect")?.value || "";
    if (selectedId) return selectedId;

    try {
        const customers = await API.getCustomers();
        const existing = customers.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) return existing.id;

        const created = await API.createCustomer({
            name: trimmed,
            phone: "",
            email: "",
            address: "",
            points: 0,
        });
        return created.id || null;
    } catch (e) {
        return null;
    }
}

async function checkout() {
    if (cart.length === 0) {
        alert("Cart is empty.");
        return;
    }

    const paymentMethodLabel = document.getElementById("paymentMethod")?.value || "Cash";
    const paymentMethod = isMobileMoneyMethod(paymentMethodLabel) ? "Mobile Money" : paymentMethodLabel;
    const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const discount = getDiscountValue(subtotal);
    const total = Math.max(0, subtotal - discount);

    const cashInput = document.getElementById("cashReceived");
    const cashReceived = cashInput && cashInput.value ? parseFloat(cashInput.value) : null;
    if (paymentMethod === "Cash" && (cashReceived == null || Number.isNaN(cashReceived) || cashReceived < total)) {
        alert("Cash received must be greater than or equal to total.");
        return;
    }

    const payerNumber = (document.getElementById("payerNumber")?.value || "").trim();
    const payerEmailField = document.getElementById("payerEmail");
    const payerEmail = (payerEmailField?.value || "").trim().toLowerCase();
    const momoNetwork = (document.getElementById("momoNetwork")?.value || "mtn-gh").trim();
    if (isMobileMoneyMethod(paymentMethodLabel) && !payerNumber) {
        alert("Please enter the payer number for this mobile money payment.");
        return;
    }
    if (isMobileMoneyMethod(paymentMethodLabel) && (!payerEmail || !payerEmail.includes("@"))) {
        alert("Please enter a valid payer email for Paystack.");
        return;
    }

    const currentUser = getSession ? getSession() : null;
    const cashierName = currentUser ? currentUser.username : "unknown";
    const customerName = (document.getElementById("customerSearchInput")?.value || "").trim();
    const customerId = await ensureCustomerByName(customerName);

    const items = cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price }));

    let provider = null;
    let providerReference = null;
    let paymentStatus = null;

    if (isMobileMoneyMethod(paymentMethodLabel)) {
        try {
            const init = await API.initiatePaystackPayment({
                amount: total,
                customerMsisdn: payerNumber,
                customerEmail: payerEmail,
                customerName: customerName || "Walk-in Customer",
                channel: momoNetwork,
                description: `SmartPOS checkout by ${cashierName}`,
                callbackUrl: `${window.location.origin}${window.location.pathname}`,
                externalReference: buildRequestRef(),
            });

            provider = "Paystack";
            providerReference = init.reference;

            const pendingSalePayload = {
                cashier: cashierName,
                customerId: customerId || null,
                customerName: customerName || null,
                subtotal,
                discount,
                total,
                paymentMethod,
                cashReceived,
                payerNumber: payerNumber || null,
                provider,
                providerReference,
                paymentStatus: "PENDING",
                items,
                requestRef: buildRequestRef(),
            };

            savePendingPaystackCheckout({
                providerReference,
                salePayload: pendingSalePayload,
                fallback: {
                    subtotal,
                    discount,
                    total,
                    paymentMethod,
                    paymentMethodLabel,
                    cashReceived,
                    customerName,
                    payerNumber,
                    items,
                },
            });

            if (init.authorizationUrl) {
                const popup = window.open(init.authorizationUrl, "_blank", "noopener");
                const blocked = !popup || popup.closed || typeof popup.closed === "undefined";
                if (blocked) {
                    showPaystackOpenToast(init.authorizationUrl);
                    return;
                }
                showToast("Paystack opened. Complete payment in the new tab. Verifying automatically...");
            }

            const paymentResult = await waitForPaystackSuccess(providerReference);
            paymentStatus = paymentResult.status;
            if (paymentStatus !== "SUCCESS") {
                if (paymentStatus === "PENDING") {
                    showToast("Payment is processing. Sale will auto-record once Paystack confirms.");
                } else {
                    showToast("Payment not confirmed yet. We'll keep checking in the background.");
                }
                return;
            }
        } catch (e) {
            const msg = (e && e.message) ? String(e.message) : "Paystack payment could not be confirmed right now. We'll retry automatically.";
            showToast(msg);
            return;
        }
    }

    const salePayload = {
        cashier: cashierName,
        customerId: customerId || null,
        customerName: customerName || null,
        subtotal,
        discount,
        total,
        paymentMethod,
        cashReceived,
        payerNumber: payerNumber || null,
        provider,
        providerReference,
        paymentStatus,
        items,
        requestRef: buildRequestRef(),
    };

    let result;
    try {
        result = await API.createSale(salePayload);
    } catch (e) {
        alert("Checkout failed: " + e.message);
        return;
    }

    clearPendingPaystackCheckout();

    renderSaleReceiptFromResult(result, {
        subtotal,
        discount,
        total,
        paymentMethod,
        paymentMethodLabel,
        cashReceived,
        customerName,
        payerNumber,
        items,
    });
    resetCheckoutUiAfterSale();

    await fetchProducts();
    renderProductList(document.getElementById("searchInput")?.value || "");
}

async function waitForPaystackSuccess(reference) {
    const maxChecks = 240;
    const delayMs = 3000;
    let lastKnown = "PENDING";

    for (let i = 0; i < maxChecks; i++) {
        const result = await API.getPaystackPaymentStatus(reference);
        lastKnown = result.status || lastKnown;
        if (result.status === "SUCCESS") return { status: "SUCCESS", data: result };
        if (result.status === "FAILED") return { status: "FAILED", data: result };
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return { status: lastKnown === "SUCCESS" ? "SUCCESS" : "PENDING", data: null };
}

function showReceipt(saleId, dateTime, subtotal, discount, total, paymentMethod, items, cashReceived, changeDue, customerName, payerNumber) {
    const receiptContent = document.getElementById("receiptContent");
    if (!receiptContent) return;

    receiptContent.innerHTML = `
        <div style="text-align:center; margin-bottom:12px;">
            <strong style="font-size:15px;">SmartPOS</strong><br>
            <span style="color:#888;">Transaction: ${saleId}</span><br>
            <span style="color:#888; font-size:12px;">${dateTime}</span>
        </div>
        <table style="width:100%; font-size:12px; border-collapse:collapse;">
            <thead>
                <tr style="border-bottom:0.5px solid #ddd;">
                    <th style="text-align:left; padding:4px 0;">Item</th>
                    <th style="text-align:center;">Qty</th>
                    <th style="text-align:right;">Price</th>
                </tr>
            </thead>
            <tbody>
                ${(items || []).map(i => `
                    <tr style="border-bottom:0.5px solid #f0f0f0;">
                        <td style="padding:4px 0;">${i.name}</td>
                        <td style="text-align:center;">${i.qty}</td>
                        <td style="text-align:right;">${CEDI}${(parseFloat(i.price || 0) * parseInt(i.qty || 0, 10)).toFixed(2)}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
        <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:12px;color:#666;">
            <span>Subtotal</span><span>${CEDI}${subtotal.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:12px;color:#666;">
            <span>Discount</span><span>${CEDI}${discount.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:6px;font-size:14px;">
            <span>Total</span><span>${CEDI}${total.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;color:#888;font-size:12px;margin-top:4px;">
            <span>Payment</span><span>${paymentMethod}</span>
        </div>
        ${customerName ? `<div style="display:flex;justify-content:space-between;color:#888;font-size:12px;margin-top:2px;"><span>Customer</span><span>${customerName}</span></div>` : ""}
        ${paymentMethod === "Cash"
                ? `<div style="display:flex;justify-content:space-between;color:#888;font-size:12px;margin-top:2px;"><span>Cash</span><span>${CEDI}${(cashReceived || 0).toFixed(2)}</span></div>
                    <div style="display:flex;justify-content:space-between;color:#888;font-size:12px;margin-top:2px;"><span>Change</span><span>${CEDI}${(changeDue || 0).toFixed(2)}</span></div>`
            : `<div style="display:flex;justify-content:space-between;color:#888;font-size:12px;margin-top:2px;"><span>Payer</span><span>${payerNumber || "-"}</span></div>`}
        <p style="text-align:center;color:#aaa;font-size:11px;margin-top:12px;">Thank you for your purchase!</p>
    `;

    const modalEl = document.getElementById("receiptModal");
    if (!modalEl) return;

    showReceiptSuccessTick();

    try {
        if (window.bootstrap && typeof window.bootstrap.Modal === "function") {
            new bootstrap.Modal(modalEl).show();
            return;
        }
    } catch (e) {}

    modalEl.style.display = "block";
    modalEl.classList.add("show");
    document.body.classList.add("modal-open");
}

function printReceipt() {
    window.print();
}

function closeReceiptFallback() {
    if (window.bootstrap && typeof window.bootstrap.Modal === "function") return;
    const modalEl = document.getElementById("receiptModal");
    if (!modalEl) return;
    modalEl.classList.remove("show");
    modalEl.style.display = "none";
    document.body.classList.remove("modal-open");
    hideReceiptSuccessTick();
    cleanupReceiptModalArtifacts();
}

async function getAllCustomers() {
    try {
        return await API.getCustomers();
    } catch (e) {
        return [];
    }
}

function populateCustomerDropdown() {
    const input = document.getElementById("customerSearchInput");
    const hidden = document.getElementById("customerSelect");
    const dd = document.getElementById("customerDropdown");
    if (input) input.value = "";
    if (hidden) hidden.value = "";
    if (dd) dd.style.display = "none";
}

async function filterCustomers(query) {
    const dd = document.getElementById("customerDropdown");
    if (!dd) return;

    const q = (query || "").toLowerCase().trim();
    if (!q) {
        dd.style.display = "none";
        dd.innerHTML = "";
        return;
    }

    const customers = await getAllCustomers();
    const matches = customers.filter(c => (c.name || "").toLowerCase().includes(q));

    if (matches.length === 0) {
        dd.style.display = "none";
        dd.innerHTML = "";
        return;
    }

    dd.innerHTML = matches.map(c => `
        <div onclick="selectCustomer('${c.id}','${c.name}')"
             style="padding:9px 12px;font-size:13px;cursor:pointer;border-bottom:1px solid #f4f0fa;font-family:'Times New Roman',Times,serif;"
             onmouseover="this.style.background='#f4f0fa'" onmouseout="this.style.background='white'">
            <span style="font-weight:500;color:#1f0e26;">${c.name}</span>
        </div>
    `).join("");
    dd.style.display = "block";
}

function showCustomerDropdown() {
    const input = document.getElementById("customerSearchInput");
    if (input && input.value.trim()) filterCustomers(input.value);
}

function selectCustomer(id, name) {
    const hidden = document.getElementById("customerSelect");
    const input = document.getElementById("customerSearchInput");
    const dd = document.getElementById("customerDropdown");
    if (hidden) hidden.value = id;
    if (input) input.value = name;
    if (dd) dd.style.display = "none";
}

document.addEventListener("click", (e) => {
    const wrap = document.getElementById("customerSearchWrap");
    if (wrap && !wrap.contains(e.target)) {
        const dd = document.getElementById("customerDropdown");
        if (dd) dd.style.display = "none";
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    startPendingPaystackWatcher();
    await resumePendingPaystackCheckout();

    // Browsers throttle timers heavily in background tabs. Re-check immediately when user returns.
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) resumePendingPaystackCheckout();
    });
    window.addEventListener("focus", () => {
        resumePendingPaystackCheckout();
    });

    await fetchProducts();
    renderProductList();
    renderCart();
    populateCustomerDropdown();

    const digitalWrapInit = document.getElementById("digitalProofWrap");
    if (digitalWrapInit && !document.getElementById("payerEmail")) {
        const payerLabel = document.getElementById("payerLabel");
        const emailLabel = document.createElement("label");
        emailLabel.style.fontSize = "12px";
        emailLabel.style.color = "#6a5080";
        emailLabel.innerText = "Payer email";

        const emailInput = document.createElement("input");
        emailInput.id = "payerEmail";
        emailInput.type = "email";
        emailInput.placeholder = "Enter payer email";
        emailInput.style.width = "100%";
        emailInput.style.border = "0.5px solid #c8b8d8";
        emailInput.style.borderRadius = "8px";
        emailInput.style.fontSize = "13px";
        emailInput.style.padding = "6px 10px";
        emailInput.style.marginBottom = "8px";

        if (payerLabel && payerLabel.parentNode === digitalWrapInit) {
            digitalWrapInit.insertBefore(emailLabel, payerLabel);
            digitalWrapInit.insertBefore(emailInput, payerLabel);
        } else {
            digitalWrapInit.prepend(emailInput);
            digitalWrapInit.prepend(emailLabel);
        }
    }

    const discountInput = document.getElementById("discountInput");
    if (discountInput) {
        discountInput.addEventListener("input", () => {
            const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
            updateTotals(subtotal);
        });
    }

    const cashInput = document.getElementById("cashReceived");
    if (cashInput) {
        cashInput.addEventListener("input", () => {
            const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
            updateTotals(subtotal);
        });
    }

    const paymentSelect = document.getElementById("paymentMethod");
    const cashWrap = document.getElementById("cashWrap");
    if (paymentSelect && cashWrap) {
        const digitalWrap = document.getElementById("digitalProofWrap");
        const toggle = () => {
            const isCash = paymentSelect.value === "Cash";
            cashWrap.style.display = isCash ? "block" : "none";
            if (digitalWrap) digitalWrap.style.display = isCash ? "none" : "block";
            if (!isCash && cashInput) cashInput.value = "";
            const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
            updateTotals(subtotal);
        };
        paymentSelect.addEventListener("change", toggle);
        toggle();
    }

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        const debouncedSearch = debounce(() => {
            currentProductPage = 1;
            renderProductList(searchInput.value);
        }, 220);
        searchInput.addEventListener("input", debouncedSearch);
    }

    const receiptModalEl = document.getElementById("receiptModal");
    if (receiptModalEl) {
        receiptModalEl.addEventListener("hide.bs.modal", hideReceiptSuccessTick);
        receiptModalEl.addEventListener("hidden.bs.modal", () => {
            hideReceiptSuccessTick();
            cleanupReceiptModalArtifacts();
        });
    }

    window.addEventListener("beforeunload", stopBarcodeScanner);
});

