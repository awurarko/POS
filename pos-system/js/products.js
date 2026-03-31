let cachedProducts = [];
let activeCategory = "All";

async function loadProducts() {
    try {
        cachedProducts = await API.getProducts();
    } catch (e) {
        console.error("Could not load products:", e);
        cachedProducts = [];
    }
    return cachedProducts;
}

function getProducts() {
    return cachedProducts;
}

function buildCategoryPills() {
    const products = getProducts();
    const cats = ["All", ...new Set(products.map(p => p.category))];
    const container = document.getElementById("categoryPills");
    if (!container) return;
    container.innerHTML = cats.map(c =>
        `<button class="pill ${c === activeCategory ? "active" : ""}" onclick="setCategory('${c}')">${c}</button>`
    ).join("");
}

function setCategory(cat) {
    activeCategory = cat;
    buildCategoryPills();
    renderProducts();
}

function updateStats(products) {
    document.getElementById("statTotal").innerText   = products.length;
    document.getElementById("statInStock").innerText = products.filter(p => p.stock > 5).length;
    document.getElementById("statLow").innerText     = products.filter(p => p.stock > 0 && p.stock <= 5).length;
    document.getElementById("statOut").innerText     = products.filter(p => p.stock === 0).length;
}

function renderProducts() {
    const products = getProducts();
    const search   = (document.getElementById("searchInput")?.value || "").toLowerCase();

    const filtered = products.filter(p => {
        const matchCat    = activeCategory === "All" || p.category === activeCategory;
        const matchSearch = p.name.toLowerCase().includes(search)
                         || p.category.toLowerCase().includes(search)
                         || (p.barcode || "").includes(search)
                         || (p.supplier || "").toLowerCase().includes(search);
        return matchCat && matchSearch;
    });

    updateStats(products);

    const grid = document.getElementById("productsGrid");
    if (!grid) return;

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#aaa;padding:40px 0;">No products found.</div>`;
        return;
    }

    grid.innerHTML = filtered.map(p => {
        const realIdx = products.findIndex(x => x.id === p.id);
        let badgeClass = "badge-ok", badgeText = "In Stock";
        if (p.stock === 0)     { badgeClass = "badge-out"; badgeText = "Out of Stock"; }
        else if (p.stock <= 5) { badgeClass = "badge-low"; badgeText = "Low Stock"; }
        const categoryLabel = p.category;
        return `
        <div class="product-card">
            <div class="product-card-body">
                <div class="product-card-name" title="${p.name}">${p.name}</div>
                <div class="product-card-cat">${categoryLabel} &middot; ${p.barcode || "—"}${p.supplier ? ` &middot; ${p.supplier}` : ""}</div>
                <div class="product-card-cat stock-row" style="margin-top:2px;">
                    <span class="stock-badge ${badgeClass}">${badgeText} (${p.stock})</span>
                </div>
                <div class="product-card-footer">
                    <span class="product-card-price">GH₵${parseFloat(p.price).toFixed(2)}</span>
                    <div class="card-actions">
                        <button class="btn-icon btn-edit" onclick="openEditModal(${realIdx})">Edit</button>
                        <button class="btn-icon btn-del"  onclick="deleteProduct(${realIdx})">Delete</button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join("");
}

function openAddModal() {
    document.getElementById("modalTitle").innerText = "Add Product";
    document.getElementById("editIndex").value = -1;
    ["pName","pPrice","pStock","pBarcode","pSupplier"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("pCategory").value = "Food";
    new bootstrap.Modal(document.getElementById("productModal")).show();
}

function openEditModal(index) {
    const p = getProducts()[index];
    document.getElementById("modalTitle").innerText = "Edit Product";
    document.getElementById("editIndex").value = index;
    document.getElementById("pName").value     = p.name;
    document.getElementById("pSupplier").value = p.supplier || "";
    document.getElementById("pCategory").value = p.category;
    document.getElementById("pPrice").value    = p.price;
    document.getElementById("pStock").value    = p.stock;
    document.getElementById("pBarcode").value  = p.barcode || "";
    new bootstrap.Modal(document.getElementById("productModal")).show();
}

async function saveProduct() {
    const name     = document.getElementById("pName").value.trim();
    const category = document.getElementById("pCategory").value;
    const price    = parseFloat(document.getElementById("pPrice").value);
    const stock    = parseInt(document.getElementById("pStock").value);
    const barcode  = document.getElementById("pBarcode").value.trim();
    const supplier = document.getElementById("pSupplier").value.trim();
    const index    = parseInt(document.getElementById("editIndex").value);

    if (!name || isNaN(price) || isNaN(stock)) {
        alert("Please fill in name, price, and stock quantity.");
        return;
    }

    try {
        if (index === -1) {
            await API.createProduct({ name, category, price, stock, barcode, supplier });
        } else {
            const product = getProducts()[index];
            await API.updateProduct(product.id, { name, category, price, stock, barcode, supplier });
        }
        await loadProducts();
        buildCategoryPills();
        renderProducts();
        bootstrap.Modal.getInstance(document.getElementById("productModal")).hide();
    } catch (e) {
        alert("Save failed: " + e.message);
    }
}

async function deleteProduct(index) {
    if (!confirm("Delete this product?")) return;
    const product = getProducts()[index];
    try {
        await API.deleteProduct(product.id);
        await loadProducts();
        buildCategoryPills();
        renderProducts();
    } catch (e) {
        alert("Delete failed: " + e.message);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadProducts();
    buildCategoryPills();
    renderProducts();
});