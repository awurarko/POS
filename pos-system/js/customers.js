let cachedCustomers = [];
let cachedSales = [];
let currentCustomerPage = 1;
const CUSTOMERS_PER_PAGE = 15;
let lastCustomerSearch = "";

async function loadCustomers() {
    try {
        cachedCustomers = await API.getCustomers();
    } catch (e) {
        console.error("Could not load customers:", e);
        cachedCustomers = [];
    }
    return cachedCustomers;
}

async function loadSales() {
    try {
        cachedSales = await API.getSales();
    } catch (e) {
        console.error("Could not load sales:", e);
        cachedSales = [];
    }
    return cachedSales;
}

function getCustomers() {
    return cachedCustomers;
}

function getSales() {
    return cachedSales;
}

// ── Stats ─────────────────────────────────────────────────────
function updateStats() {
    const customers = getCustomers();
    const sales     = getSales();
    const totalPts  = customers.reduce((s, c) => s + (c.points || 0), 0);
    const withPurch = new Set(sales.map(s => s.customerId).filter(Boolean)).size;

    document.getElementById("statTotal").innerText    = customers.length;
    document.getElementById("statPoints").innerText   = totalPts;
    document.getElementById("statActive").innerText   = withPurch;
}

// ── Render table ──────────────────────────────────────────────
async function renderCustomers() {
    await Promise.all([loadCustomers(), loadSales()]);
    const customers = getCustomers();
    const search    = (document.getElementById("searchInput")?.value || "").toLowerCase();
    if (search !== lastCustomerSearch) {
        currentCustomerPage = 1;
        lastCustomerSearch = search;
    }
    updateStats();

    const filtered = customers.filter(c =>
        c.name.toLowerCase().includes(search)  ||
        c.phone.includes(search)               ||
        (c.address|| "").toLowerCase().includes(search)
    );

    const tbody = document.getElementById("customersTable");

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="c-empty">No customers found.</td></tr>`;
        renderCustomerPagination(0);
        return;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / CUSTOMERS_PER_PAGE));
    currentCustomerPage = Math.min(Math.max(1, currentCustomerPage), totalPages);
    const startIdx = (currentCustomerPage - 1) * CUSTOMERS_PER_PAGE;
    const paged = filtered.slice(startIdx, startIdx + CUSTOMERS_PER_PAGE);

    const sales = getSales();

    tbody.innerHTML = paged.map((c, i) => {
        const realIdx    = customers.findIndex(x => x.id === c.id);
        const custSales  = sales.filter(s => s.customerId === c.id);
        const tier       = c.points >= 200 ? "Gold" : c.points >= 100 ? "Silver" : "Bronze";

        return `<tr>
            <td class="c-id">${c.id}</td>
            <td class="c-name">${c.name}</td>
            <td>${c.phone}</td>
            <td class="c-address">${c.address || "-"}</td>
            <td>
                <span class="c-points">${c.points}</span>
                <span class="c-tier">${tier}</span>
            </td>
            <td>
                <button class="btn btn-sm c-action c-action-edit me-1" onclick="viewHistory(${realIdx})">History</button>
                <button class="btn btn-sm c-action c-action-edit me-1" onclick="openEditModal(${realIdx})">Edit</button>
                <button class="btn btn-sm c-action c-action-delete" onclick="deleteCustomer(${realIdx})">Delete</button>
            </td>
        </tr>`;
    }).join("");

    renderCustomerPagination(filtered.length);
}

function renderCustomerPagination(totalItems) {
    const wrap = document.getElementById("customerPagination");
    if (!wrap) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / CUSTOMERS_PER_PAGE));
    if (totalItems <= CUSTOMERS_PER_PAGE) {
        wrap.innerHTML = "";
        return;
    }

    const prevDisabled = currentCustomerPage <= 1 ? "disabled" : "";
    const nextDisabled = currentCustomerPage >= totalPages ? "disabled" : "";

    wrap.innerHTML = `
        <button class="page-btn" ${prevDisabled} onclick="changeCustomerPage(-1)">Prev</button>
        <span>Page ${currentCustomerPage} of ${totalPages}</span>
        <button class="page-btn" ${nextDisabled} onclick="changeCustomerPage(1)">Next</button>
    `;
}

function changeCustomerPage(delta) {
    currentCustomerPage += delta;
    renderCustomers();
}

// ── History modal ─────────────────────────────────────────────
function viewHistory(index) {
    const c     = getCustomers()[index];
    const sales = getSales().filter(s => s.customerId === c.id);

    document.getElementById("historyName").innerText = c.name;

    const tbody = document.getElementById("historyTable");
    if (sales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="c-empty">No purchases recorded yet.</td></tr>`;
    } else {
        tbody.innerHTML = [...sales].reverse().map(s => `
            <tr>
                <td class="c-id">${s.id}</td>
                <td class="c-id">${s.dateTime}</td>
                <td class="c-id">${s.items.map(i => i.name).join(", ")}</td>
                <td class="history-total">GH₵${s.total.toFixed(2)}</td>
            </tr>`).join("");
    }

    new bootstrap.Modal(document.getElementById("historyModal")).show();
}

// ── Add / Edit modal ──────────────────────────────────────────
function openAddModal() {
    document.getElementById("modalTitle").innerText = "Add Customer";
    document.getElementById("editIndex").value = -1;
    ["cName","cPhone","cEmail","cAddress"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("cPoints").value = "0";
    new bootstrap.Modal(document.getElementById("customerModal")).show();
}

function openEditModal(index) {
    const c = getCustomers()[index];
    document.getElementById("modalTitle").innerText = "Edit Customer";
    document.getElementById("editIndex").value  = index;
    document.getElementById("cName").value      = c.name;
    document.getElementById("cPhone").value     = c.phone;
    document.getElementById("cEmail").value     = c.email    || "";
    document.getElementById("cAddress").value   = c.address  || "";
    document.getElementById("cPoints").value    = c.points   || 0;
    new bootstrap.Modal(document.getElementById("customerModal")).show();
}

async function saveCustomer() {
    const name    = document.getElementById("cName").value.trim();
    const phone   = document.getElementById("cPhone").value.trim();
    const email   = document.getElementById("cEmail").value.trim();
    const address = document.getElementById("cAddress").value.trim();
    const points  = parseInt(document.getElementById("cPoints").value) || 0;
    const index   = parseInt(document.getElementById("editIndex").value);

    if (!name || !phone) { alert("Name and phone number are required."); return; }

    try {
        if (index === -1) {
            await API.createCustomer({ name, phone, email, address, points });
        } else {
            const customer = getCustomers()[index];
            await API.updateCustomer(customer.id, { name, phone, email, address, points });
        }
        bootstrap.Modal.getInstance(document.getElementById("customerModal")).hide();
        renderCustomers();
    } catch (e) {
        alert("Save failed: " + e.message);
    }
}

async function deleteCustomer(index) {
    if (!confirm("Delete this customer?")) return;
    const customer = getCustomers()[index];
    try {
        await API.deleteCustomer(customer.id);
        renderCustomers();
    } catch (e) {
        alert("Delete failed: " + e.message);
    }
}

// ── Award loyalty points (called from pos.js on checkout) ─────
// 1 point per GH₵1 spent, rounded down
async function awardLoyaltyPoints(customerId, saleTotal) {
    if (!customerId) return;
    const points = Math.floor(saleTotal);
    if (points <= 0) return;
    try {
        await API.addCustomerPoints(customerId, points);
    } catch (e) {
        console.error("Could not update loyalty points:", e);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    renderCustomers();
});