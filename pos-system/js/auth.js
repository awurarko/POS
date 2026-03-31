const PERMISSIONS = {
    Admin:   ["pos","dashboard","products","inventory","reports","customers","users"],
    Manager: ["pos","dashboard","products","inventory","reports","customers"],
    Cashier: ["pos","dashboard","customers"],
};
const PAGE_ROLES = {
    "pos.html":       ["Admin","Manager","Cashier"],
    "dashboard.html": ["Admin","Manager","Cashier"],
    "products.html":  ["Admin","Manager"],
    "inventory.html": ["Admin","Manager"],
    "reports.html":   ["Admin","Manager"],
    "customers.html": ["Admin","Manager","Cashier"],
    "users.html":     ["Admin"],
};

function saveSession(u, token){
    sessionStorage.setItem("currentUser", JSON.stringify(u));
    if (token) sessionStorage.setItem("authToken", token);
}
function getSession(){ const s = sessionStorage.getItem("currentUser"); return s ? JSON.parse(s) : null; }
function getToken(){ return sessionStorage.getItem("authToken") || ""; }
function clearSession(){
    sessionStorage.removeItem("currentUser");
    sessionStorage.removeItem("authToken");
}
function getHomePage(role){ return role === "Cashier" ? "pos.html" : "dashboard.html"; }

function getCurrentPage(){
    // Works for both file:// and http:// — grab filename from full href
    const href = window.location.href;
    const file = href.split("/").pop().split("?")[0].split("#")[0];
    return file || "index.html";
}

function guardPage(){
    const user = getSession();
    const token = getToken();
    const page = getCurrentPage();
    if(!user || !token){ window.location.href = "index.html"; return; }
    const allowed = PAGE_ROLES[page] || [];
    if(!allowed.includes(user.role)) window.location.href = getHomePage(user.role);
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (!sidebar) return;
    sidebar.classList.toggle("sidebar-open");
    document.body.classList.toggle("sidebar-open-mobile", sidebar.classList.contains("sidebar-open"));
    if (overlay) overlay.classList.toggle("active");
}

function buildSidebar(){
    const user = getSession();
    if(!user) return;
    const nav = document.getElementById("sidebar-nav");
    if(!nav) return;

    // Inject hamburger button into page if not already there
    if (!document.getElementById("sidebarToggle")) {
        const btn = document.createElement("button");
        btn.id = "sidebarToggle";
        btn.innerHTML = `<span></span><span></span><span></span>`;
        btn.onclick = toggleSidebar;
        document.body.appendChild(btn);
    }
    // Inject overlay if not already there
    if (!document.getElementById("sidebarOverlay")) {
        const overlay = document.createElement("div");
        overlay.id = "sidebarOverlay";
        overlay.onclick = toggleSidebar;
        document.body.appendChild(overlay);
    }

    const perms = PERMISSIONS[user.role] || [];
    const page  = getCurrentPage();

    const links = [
        { href:"dashboard.html", label:"Dashboard", key:"dashboard" },
        { href:"pos.html",       label:"POS",        key:"pos"       },
        { href:"products.html",  label:"Products",   key:"products"  },
        { href:"inventory.html", label:"Inventory",  key:"inventory" },
        { href:"reports.html",   label:"Reports",    key:"reports"   },
        { href:"customers.html", label:"Customers",  key:"customers" },
        { href:"users.html",     label:"Users",      key:"users"     },
    ];

    const roleColors = { Admin:"#c0392b", Manager:"#9b6914", Cashier:"#4a3060" };
    const roleColor  = roleColors[user.role] || "#4a3060";
    const initials   = user.fullName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

    const navLinks = links
        .filter(l => perms.includes(l.key))
        .map(l => {
            const isActive = l.href === page;
            const activeStyle = isActive
                ? ' style="background:rgba(255,255,255,0.18);border-radius:6px;font-weight:600;"'
                : '';
            return `<a class="nav-link text-white" href="${l.href}"${activeStyle}>${l.label}</a>`;
        }).join("");

    const userFooter = `
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.12);">
            <div style="display:flex;align-items:center;gap:8px;padding:4px 8px 8px;">
                <div style="width:28px;height:28px;border-radius:50%;background:${roleColor};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:white;flex-shrink:0;">${initials}</div>
                <div style="overflow:hidden;">
                    <div style="font-size:12px;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user.fullName}</div>
                    <div style="font-size:10px;color:rgba(255,255,255,0.4);">${user.role}</div>
                </div>
            </div>
            <a class="nav-link" href="#" onclick="logout()" style="color:rgba(255,255,255,0.5);font-size:13px;padding:6px 10px;display:block;text-decoration:none;">Logout</a>
        </div>`;

    nav.innerHTML = navLinks + userFooter;
}

function logout(){ clearSession(); window.location.href = "index.html"; }