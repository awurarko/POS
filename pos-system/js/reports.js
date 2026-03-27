let cachedSales = [];
let revenueTrendChart = null;
let kpiMode = "month";
let trendMode = "daily";
let selectedMonth = new Date();
selectedMonth.setDate(1);
selectedMonth.setHours(0, 0, 0, 0);

function renderMvpList(elId, rows, formatter) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!rows || rows.length === 0) {
        el.innerHTML = `<li class="top-empty">No data</li>`;
        return;
    }
    el.innerHTML = rows.map((row, idx) => formatter(row, idx)).join("");
}

async function ensureTopProductsVisible() {
    const listEl = document.getElementById("mvpTopProducts");
    if (!listEl) return;

    const hasTopItems = listEl.querySelectorAll(".top-item").length > 0;
    if (hasTopItems) return;

    try {
        const data = await API.getReportsMvp();
        renderMvpList("mvpTopProducts", (data.topProducts || []).slice(0, 5), (r, idx) => `
            <li class="top-item top-item-selling">
                <span class="top-rank">#${idx + 1}</span>
                <span class="top-name">${r.name}</span>
            </li>
        `);
    } catch (e) {
        // If fallback also fails, keep existing placeholder text.
    }
}

function normalizeSaleItems(rawItems) {
    if (Array.isArray(rawItems)) return rawItems;
    if (typeof rawItems === "string") {
        try {
            const parsed = JSON.parse(rawItems);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }
    return [];
}

async function renderReportsMvp() {
    try {
        const data = await API.getReportsMvp();
        const salesTodayEl = document.getElementById("mvpSalesToday");
        const salesWeekEl = document.getElementById("mvpSalesWeek");
        const revenueTodayEl = document.getElementById("mvpRevenueToday");
        const revenueWeekEl = document.getElementById("mvpRevenueWeek");

        if (salesTodayEl) salesTodayEl.innerText = String(data.today.totalSales || 0);
        if (salesWeekEl) salesWeekEl.innerText = String(data.week.totalSales || 0);
        if (revenueTodayEl) revenueTodayEl.innerText = money(parseFloat(data.today.totalRevenue || 0));
        if (revenueWeekEl) revenueWeekEl.innerText = money(parseFloat(data.week.totalRevenue || 0));

        await ensureTopProductsVisible();

        renderMvpList("mvpLowStock", data.lowStockProducts || [], (r, idx) => `
            <li class="top-item top-item-low">
                <span class="top-rank">#${idx + 1}</span>
                <span class="top-name">${r.name}</span>
                <span class="top-units">${r.stock} units left</span>
            </li>
        `);
    } catch (e) {
        // Keep existing report functional even if mvp endpoint fails.
    }
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

function getSales() {
    return cachedSales;
}

function parseSaleDate(sale) {
    const raw = sale.dateTime || sale.date || sale.createdAt;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
}

function getMonthBounds(monthDate) {
    const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
}

function filterSalesByDateRange(sales, startDate, endDate) {
    return sales.filter(s => {
        const d = parseSaleDate(s);
        if (!d) return false;
        return d >= startDate && d <= endDate;
    });
}

function money(value) {
    return `GH₵${value.toFixed(2)}`;
}

function formatMonthLabel(date) {
    return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function formatMonthKey(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${date.getFullYear()}-${month}`;
}

function shiftMonth(baseDate, amount) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + amount, 1);
    d.setHours(0, 0, 0, 0);
    return d;
}

function calculateRevenue(sales) {
    return sales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);
}

function setKpiDelta(deltaEl, text, state) {
    if (!deltaEl) return;
    deltaEl.innerText = text;
    deltaEl.classList.remove("kpi-delta-up", "kpi-delta-down", "kpi-delta-neutral");
    deltaEl.classList.add(state || "kpi-delta-neutral");
}

function updateKpi(monthSales, prevMonthSales, allSales) {
    const valueEl = document.getElementById("kpiRevenueValue");
    const subEl = document.getElementById("kpiRevenueSub");
    const deltaEl = document.getElementById("kpiRevenueDelta");
    const monthBtn = document.getElementById("kpiMonthBtn");
    const allBtn = document.getElementById("kpiAllBtn");

    const monthRevenue = calculateRevenue(monthSales);
    const prevRevenue = calculateRevenue(prevMonthSales);
    const allRevenue = calculateRevenue(allSales);

    if (monthBtn) monthBtn.classList.toggle("active", kpiMode === "month");
    if (allBtn) allBtn.classList.toggle("active", kpiMode === "all");

    if (kpiMode === "all") {
        if (valueEl) valueEl.innerText = money(allRevenue);
        if (subEl) subEl.innerText = "All-time revenue";
        setKpiDelta(deltaEl, `${monthSales.length} sales in ${formatMonthLabel(selectedMonth)}.`, "kpi-delta-neutral");
        return;
    }

    if (valueEl) valueEl.innerText = money(monthRevenue);
    if (subEl) subEl.innerText = `${formatMonthLabel(selectedMonth)} revenue`;

    if (prevRevenue === 0) {
        const text = monthRevenue === 0
            ? "No revenue this month or previous month."
            : `Up by 100.0% vs previous month (${money(monthRevenue)} increase).`;
        const state = monthRevenue > 0 ? "kpi-delta-up" : "kpi-delta-neutral";
        setKpiDelta(deltaEl, text, state);
        return;
    }

    const diff = monthRevenue - prevRevenue;
    const pct = (diff / prevRevenue) * 100;
    const isUp = diff >= 0;
    const directionText = isUp ? "Up by" : "Down by";
    const deltaText = `${directionText} ${Math.abs(pct).toFixed(1)}% vs previous month (${money(Math.abs(diff))}).`;
    setKpiDelta(deltaEl, deltaText, isUp ? "kpi-delta-up" : "kpi-delta-down");
}

function buildMonthlySeries(allSales, monthDate) {
    const year = monthDate.getFullYear();
    const labels = Array.from({ length: 12 }, (_, i) =>
        new Date(year, i, 1).toLocaleString("en-US", { month: "short" })
    );
    const values = Array.from({ length: 12 }, () => 0);

    allSales.forEach(sale => {
        const d = parseSaleDate(sale);
        if (!d || d.getFullYear() !== year) return;
        values[d.getMonth()] += parseFloat(sale.total || 0);
    });

    return { labels, values };
}

function buildDailySeries(monthSales, monthDate) {
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
    const values = Array.from({ length: daysInMonth }, () => 0);

    monthSales.forEach(sale => {
        const d = parseSaleDate(sale);
        if (!d) return;
        values[d.getDate() - 1] += parseFloat(sale.total || 0);
    });

    return { labels, values };
}

function buildWeeklySeries(monthSales, monthDate) {
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const weekCount = Math.ceil(daysInMonth / 7);
    const labels = Array.from({ length: weekCount }, (_, i) => `Week ${i + 1}`);
    const values = Array.from({ length: weekCount }, () => 0);

    monthSales.forEach(sale => {
        const d = parseSaleDate(sale);
        if (!d) return;
        const weekIndex = Math.floor((d.getDate() - 1) / 7);
        values[weekIndex] += parseFloat(sale.total || 0);
    });

    return { labels, values };
}

function getTrendSeries(allSales, monthSales) {
    if (trendMode === "weekly") {
        return {
            title: `Weekly revenue for ${formatMonthLabel(selectedMonth)}`,
            ...buildWeeklySeries(monthSales, selectedMonth)
        };
    }

    if (trendMode === "monthly") {
        return {
            title: `Monthly revenue for ${selectedMonth.getFullYear()} (Jan-Dec)`,
            ...buildMonthlySeries(allSales, selectedMonth)
        };
    }

    return {
        title: `Daily revenue for ${formatMonthLabel(selectedMonth)}`,
        ...buildDailySeries(monthSales, selectedMonth)
    };
}

function updateTrendModeButtons() {
    const dailyBtn = document.getElementById("trendDailyBtn");
    const weeklyBtn = document.getElementById("trendWeeklyBtn");
    const monthlyBtn = document.getElementById("trendMonthlyBtn");
    if (dailyBtn) dailyBtn.classList.toggle("active", trendMode === "daily");
    if (weeklyBtn) weeklyBtn.classList.toggle("active", trendMode === "weekly");
    if (monthlyBtn) monthlyBtn.classList.toggle("active", trendMode === "monthly");
}

function renderRevenueTrendChart(allSales, monthSales) {
    const chartEl = document.getElementById("revenueTrendChart");
    if (!chartEl) return;

    const subtitleEl = document.querySelector(".trend-head .page-subtitle");
    const series = getTrendSeries(allSales, monthSales);
    if (subtitleEl) subtitleEl.innerText = series.title;

    const chartData = {
        labels: series.labels,
        datasets: [{
            label: "Revenue",
            data: series.values,
            borderColor: "#a78bfa",
            backgroundColor: "rgba(167, 139, 250, 0.22)",
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            pointRadius: 2
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { ticks: { color: "#475569" }, grid: { display: false } },
            y: { ticks: { color: "#475569" }, grid: { color: "#e2e8f0" }, beginAtZero: true }
        },
        plugins: {
            legend: { display: false },
            tooltip: { mode: "index", intersect: false }
        }
    };

    if (!revenueTrendChart) {
        revenueTrendChart = new Chart(chartEl, {
            type: "line",
            data: chartData,
            options: chartOptions
        });
    } else {
        revenueTrendChart.data = chartData;
        revenueTrendChart.update();
    }
}

function aggregateTopProducts(sales) {
    const map = new Map();

    sales.forEach(sale => {
        normalizeSaleItems(sale.items).forEach(item => {
            const name = item.name || "Unknown";
            if (!map.has(name)) {
                map.set(name, { name, units: 0, revenue: 0 });
            }
            const row = map.get(name);
            row.units += parseInt(item.qty || 0, 10);
            row.revenue += parseFloat(item.price || 0) * parseInt(item.qty || 0, 10);
        });
    });

    return Array.from(map.values()).sort((a, b) => b.units - a.units);
}

function renderTopProducts(sales) {
    const rows = aggregateTopProducts(sales).slice(0, 5);
    const listEl = document.getElementById("mvpTopProducts");

    if (!listEl) return;

    if (rows.length === 0) {
        listEl.innerHTML = `<li class="top-empty">No product sales in this month.</li>`;
        return;
    }

    listEl.innerHTML = rows.map((r, idx) => `
        <li class="top-item top-item-selling">
            <span class="top-rank">#${idx + 1}</span>
            <span class="top-name">${r.name}</span>
        </li>
    `).join("");
}

function renderSalesTable(monthSales) {
    const salesBody = document.getElementById("salesTable");
    if (!salesBody) return;

    if (monthSales.length === 0) {
        salesBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No sales recorded for this month.</td></tr>`;
        return;
    }

    salesBody.innerHTML = monthSales.map(s => `
        <tr>
            <td>${s.id}</td>
            <td>${new Date(s.dateTime).toLocaleString()}</td>
            <td>${normalizeSaleItems(s.items).map(i => `${i.name} x${i.qty}`).join(", ")}</td>
            <td>${s.paymentMethod || "-"}</td>
            <td>${money(parseFloat(s.total || 0))}</td>
        </tr>
    `).join("");
}

function updateMonthLabel() {
    const monthLabel = document.getElementById("monthLabel");
    if (monthLabel) monthLabel.innerText = formatMonthLabel(selectedMonth);
}

function renderReports() {
    const allSales = getSales();
    const currentBounds = getMonthBounds(selectedMonth);
    const previousBounds = getMonthBounds(shiftMonth(selectedMonth, -1));

    const monthSales = filterSalesByDateRange(allSales, currentBounds.start, currentBounds.end);
    const prevMonthSales = filterSalesByDateRange(allSales, previousBounds.start, previousBounds.end);

    updateMonthLabel();
    updateTrendModeButtons();
    updateKpi(monthSales, prevMonthSales, allSales);
    renderRevenueTrendChart(allSales, monthSales);
    const sourceSalesForTopProducts = aggregateTopProducts(monthSales).length > 0 ? monthSales : allSales;
    renderTopProducts(sourceSalesForTopProducts);
    ensureTopProductsVisible();
    renderSalesTable(monthSales);
}

function setupInteractions() {
    const prevBtn = document.getElementById("monthPrev");
    const nextBtn = document.getElementById("monthNext");
    const monthBtn = document.getElementById("kpiMonthBtn");
    const allBtn = document.getElementById("kpiAllBtn");
    const trendDailyBtn = document.getElementById("trendDailyBtn");
    const trendWeeklyBtn = document.getElementById("trendWeeklyBtn");
    const trendMonthlyBtn = document.getElementById("trendMonthlyBtn");

    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            selectedMonth = shiftMonth(selectedMonth, -1);
            renderReports();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            selectedMonth = shiftMonth(selectedMonth, 1);
            renderReports();
        });
    }

    if (monthBtn) {
        monthBtn.addEventListener("click", () => {
            kpiMode = "month";
            renderReports();
        });
    }

    if (allBtn) {
        allBtn.addEventListener("click", () => {
            kpiMode = "all";
            renderReports();
        });
    }

    if (trendDailyBtn) {
        trendDailyBtn.addEventListener("click", () => {
            trendMode = "daily";
            renderReports();
        });
    }

    if (trendWeeklyBtn) {
        trendWeeklyBtn.addEventListener("click", () => {
            trendMode = "weekly";
            renderReports();
        });
    }

    if (trendMonthlyBtn) {
        trendMonthlyBtn.addEventListener("click", () => {
            trendMode = "monthly";
            renderReports();
        });
    }
}

async function clearSales() {
    if (!confirm("Clear all sales history? This cannot be undone.")) return;
    try {
        await API.clearSales();
        await loadSales();
        renderReports();
        renderReportsMvp();
    } catch (e) {
        alert("Clear failed: " + e.message);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadSales();
    setupInteractions();
    renderReports();
    renderReportsMvp();
});
