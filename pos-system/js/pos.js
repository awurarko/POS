let cart = [];
let scannerStream = null;
let scannerTimer = null;
let barcodeDetector = null;
let zxingReader = null;
let toastTimer = null;

let cachedProducts = [];
let currentProductPage = 1;
const PRODUCTS_PER_PAGE = 24;

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

function showReceiptSuccessTick() {
    const tick = document.getElementById("receiptSuccessTick");
    if (!tick) return;
    tick.style.display = "block";
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
                <div class="icon">${getIcon(p.name, p.category)}</div>
                <div class="p-name">${p.name}</div>
                <div class="p-price">GH₵${price.toFixed(2)}</div>
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
                <button class="qty-btn" onclick="changeQty(${i}, -1)">−</button>
                <span style="min-width:16px;text-align:center;">${item.qty}</span>
                <button class="qty-btn" onclick="changeQty(${i}, 1)">+</button>
            </div>
            <span class="ci-subtotal">GH₵${(item.price * item.qty).toFixed(2)}</span>
            <button class="rm-btn" onclick="removeItem(${i})">✕</button>
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

    const paymentMethod = document.getElementById("paymentMethod")?.value || "Cash";
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
    if (paymentMethod === "Mobile Money" && !payerNumber) {
        alert("Please enter the payer number for this mobile money payment.");
        return;
    }

    const currentUser = getSession ? getSession() : null;
    const cashierName = currentUser ? currentUser.username : "unknown";
    const customerName = (document.getElementById("customerSearchInput")?.value || "").trim();
    const customerId = await ensureCustomerByName(customerName);

    const items = cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price }));

    let result;
    try {
        result = await API.createSale({
            cashier: cashierName,
            customerId: customerId || null,
            customerName: customerName || null,
            subtotal,
            discount,
            total,
            paymentMethod,
            cashReceived,
            payerNumber: payerNumber || null,
            items,
            requestRef: buildRequestRef(),
        });
    } catch (e) {
        alert("Checkout failed: " + e.message);
        return;
    }

    const receipt = result.receipt || {
        saleId: result.id,
        dateTime: new Date().toISOString(),
        subtotal,
        discount,
        total,
        paymentMethod,
        cashReceived,
        customerName,
        payerNumber,
        items,
    };

    showReceipt(
        receipt.saleId,
        new Date(receipt.dateTime).toLocaleDateString() + " " + new Date(receipt.dateTime).toLocaleTimeString(),
        parseFloat(receipt.subtotal || 0),
        parseFloat(receipt.discount || 0),
        parseFloat(receipt.total || 0),
        receipt.paymentMethod,
        receipt.items || items,
        receipt.cashReceived,
        result.changeDue,
        receipt.customerName,
        receipt.payerNumber
    );

    cart = [];
    renderCart();
    closeMobileCart();
    populateCustomerDropdown();

    if (cashInput) cashInput.value = "";
    const payerInput = document.getElementById("payerNumber");
    if (payerInput) payerInput.value = "";
    const discountInput = document.getElementById("discountInput");
    if (discountInput) discountInput.value = "0.00";

    await fetchProducts();
    renderProductList(document.getElementById("searchInput")?.value || "");
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
                        <td style="text-align:right;">GH₵${(parseFloat(i.price || 0) * parseInt(i.qty || 0, 10)).toFixed(2)}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
        <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:12px;color:#666;">
            <span>Subtotal</span><span>GH₵${subtotal.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:12px;color:#666;">
            <span>Discount</span><span>GH₵${discount.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:6px;font-size:14px;">
            <span>Total</span><span>GH₵${total.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;color:#888;font-size:12px;margin-top:4px;">
            <span>Payment</span><span>${paymentMethod}</span>
        </div>
        ${customerName ? `<div style="display:flex;justify-content:space-between;color:#888;font-size:12px;margin-top:2px;"><span>Customer</span><span>${customerName}</span></div>` : ""}
        ${paymentMethod === "Cash"
            ? `<div style="display:flex;justify-content:space-between;color:#888;font-size:12px;margin-top:2px;"><span>Cash</span><span>GH₵${(cashReceived || 0).toFixed(2)}</span></div>
               <div style="display:flex;justify-content:space-between;color:#888;font-size:12px;margin-top:2px;"><span>Change</span><span>GH₵${(changeDue || 0).toFixed(2)}</span></div>`
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
    await fetchProducts();
    renderProductList();
    renderCart();
    populateCustomerDropdown();

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

    window.addEventListener("beforeunload", stopBarcodeScanner);
});
