let cachedProducts = [];

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

async function renderInventory() {
    await loadProducts();
    const products = getProducts();
    const filter = document.getElementById("filterSelect")?.value || "all";

    let filtered = products;
    if (filter === "low") filtered = products.filter(p => p.stock > 0 && p.stock <= 5);
    if (filter === "out") filtered = products.filter(p => p.stock === 0);

    // Summary stats
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= 5).length;
    const outOfStock = products.filter(p => p.stock === 0).length;
    const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);

    document.getElementById("totalProducts").innerText = products.length;
    document.getElementById("lowStockCount").innerText = lowStock;
    document.getElementById("outOfStockCount").innerText = outOfStock;
    document.getElementById("totalValue").innerText = "GH₵" + totalValue.toFixed(2);

    if (lowStock > 0 || outOfStock > 0) {
        document.getElementById("lowStockAlert").classList.remove("d-none");
    } else {
        document.getElementById("lowStockAlert").classList.add("d-none");
    }

    const tbody = document.getElementById("inventoryTable");
    tbody.innerHTML = filtered.map((p, i) => {
        let statusBadge = "";
        if (p.stock === 0) statusBadge = `<span class="badge bg-danger">Out of Stock</span>`;
        else if (p.stock <= 5) statusBadge = `<span class="badge bg-warning text-dark">Low Stock</span>`;
        else statusBadge = `<span class="badge bg-success">In Stock</span>`;

        // Find real index in full products array
        const realIndex = products.findIndex(prod => prod.id === p.id);

        return `
        <tr>
            <td>${p.id}</td>
            <td>${p.name}</td>
            <td>${p.category}</td>
            <td class="${p.stock <= 5 ? 'text-danger fw-bold' : ''}">${p.stock}</td>
            <td>${statusBadge}</td>
            <td><button class="btn restock-btn" onclick="openRestockModal(${realIndex}, '${p.name}')">Restock</button></td>
        </tr>`;
    }).join("");
}

function openRestockModal(index, name) {
    document.getElementById("restockIndex").value = index;
    document.getElementById("restockName").innerText = name;
    document.getElementById("restockQty").value = "";
    new bootstrap.Modal(document.getElementById("restockModal")).show();
}

async function confirmRestock() {
    const index = parseInt(document.getElementById("restockIndex").value);
    const qty = parseInt(document.getElementById("restockQty").value);

    if (isNaN(qty) || qty <= 0) {
        alert("Please enter a valid quantity.");
        return;
    }

    const products = getProducts();
    const product = products[index];
    try {
        await API.restock(product.id, qty);
        bootstrap.Modal.getInstance(document.getElementById("restockModal")).hide();
        renderInventory();
    } catch (e) {
        alert("Restock failed: " + e.message);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    renderInventory();
});