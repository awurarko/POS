function setAuthLoading(isLoading, mode) {
    const isSetup = mode === "setup";
    const loginBtn = document.getElementById("login-btn");
    const setupBtn = document.getElementById("setup-btn");

    if (loginBtn) {
        loginBtn.disabled = isLoading;
        loginBtn.innerText = isLoading && !isSetup ? "Signing in..." : "Continue";
    }
    if (setupBtn) {
        setupBtn.disabled = isLoading;
        setupBtn.innerText = isLoading && isSetup ? "Creating Admin..." : "Create Admin";
    }
}

async function login() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    if (!username || !password) { showError("Please enter your username and password."); return; }

    showError("");
    setAuthLoading(true, "login");
    try {
        const result = await API.login(username, password);
        saveSession(result.user, result.token);
        window.location.href = getHomePage(result.user.role);
    } catch (e) {
        showError(e.message || "Invalid username or password.");
    } finally {
        setAuthLoading(false, "login");
    }
}

function showError(msg) {
    const el = document.getElementById("login-error");
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? "block" : "none";
}

function showSetupError(msg) {
    const el = document.getElementById("setup-error");
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? "block" : "none";
}

function toggleSetupMode(isSetup) {
    const loginPanel = document.getElementById("login-panel");
    const setupPanel = document.getElementById("setup-panel");
    if (loginPanel) loginPanel.style.display = isSetup ? "none" : "block";
    if (setupPanel) setupPanel.style.display = isSetup ? "block" : "none";
}

async function createFirstAdmin() {
    const fullName = document.getElementById("setup-fullname").value.trim();
    const username = document.getElementById("setup-username").value.trim();
    const password = document.getElementById("setup-password").value;
    const confirm  = document.getElementById("setup-password-confirm").value;

    if (!fullName || !username || !password || !confirm) {
        showSetupError("Please fill in all fields.");
        return;
    }
    if (password !== confirm) {
        showSetupError("Passwords do not match.");
        return;
    }

    showSetupError("");
    setAuthLoading(true, "setup");
    try {
        await API.createFirstAdmin({ username, password, fullName });
        const result = await API.login(username, password);
        saveSession(result.user, result.token);
        window.location.href = getHomePage(result.user.role);
    } catch (e) {
        showSetupError(e.message || "Setup failed.");
    } finally {
        setAuthLoading(false, "setup");
    }
}

async function initLogin() {
    const user = getSession();
    if (user) {
        window.location.href = getHomePage(user.role);
        return;
    }

    try {
        const status = await API.setupStatus();
        toggleSetupMode(!status.hasUsers);
    } catch (e) {
        toggleSetupMode(false);
    }
}

document.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const setupPanel = document.getElementById("setup-panel");
    const isSetup = setupPanel && setupPanel.style.display !== "none";
    if (isSetup) createFirstAdmin();
    else login();
});
document.addEventListener("DOMContentLoaded", initLogin);