let cachedUsers = [];

async function loadUsers() {
    try {
        cachedUsers = await API.getUsers();
    } catch (e) {
        console.error("Could not load users:", e);
        cachedUsers = [];
    }
    return cachedUsers;
}

function getUsers() {
    return cachedUsers;
}

function renderUsers() {
    const users = getUsers();
    const tbody = document.getElementById("usersTable");
    tbody.innerHTML = users.map((u, i) => {
        const roleClass = `role-${sanitizeClass(u.role)}`;
        return `<tr>
            <td>${u.id}</td>
            <td>${u.username}</td>
            <td>${u.fullName}</td>
            <td><span class="users-chip ${roleClass}">${u.role}</span></td>
            <td><span class="users-chip ${u.status === "Active" ? "status-active" : "status-inactive"}">${u.status}</span></td>
            <td>
                <button class="btn btn-sm users-action-btn me-1" onclick="openEditUserModal(${i})">Edit</button>
                <button class="btn btn-sm users-action-btn danger" onclick="deleteUser(${i})">Delete</button>
            </td>
        </tr>`;
    }).join("");
}

function sanitizeClass(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function openAddUserModal() {
    document.getElementById("userModalTitle").innerText = "Add User";
    document.getElementById("userEditIndex").value = -1;
    ["uUsername","uFullName","uPassword"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("uRole").value   = "Cashier";
    document.getElementById("uStatus").value = "Active";
    document.getElementById("passwordHint").style.display = "none";
    new bootstrap.Modal(document.getElementById("userModal")).show();
}

function openEditUserModal(i) {
    const u = getUsers()[i];
    document.getElementById("userModalTitle").innerText = "Edit User";
    document.getElementById("userEditIndex").value = i;
    document.getElementById("uUsername").value  = u.username;
    document.getElementById("uFullName").value  = u.fullName;
    document.getElementById("uPassword").value  = "";
    document.getElementById("uRole").value      = u.role;
    document.getElementById("uStatus").value    = u.status;
    document.getElementById("passwordHint").style.display = "block";
    new bootstrap.Modal(document.getElementById("userModal")).show();
}

async function saveUser() {
    const username = document.getElementById("uUsername").value.trim();
    const fullName = document.getElementById("uFullName").value.trim();
    const password = document.getElementById("uPassword").value;
    const role     = document.getElementById("uRole").value;
    const status   = document.getElementById("uStatus").value;
    const index    = parseInt(document.getElementById("userEditIndex").value);

    if (!username || !fullName) { alert("Please fill in username and full name."); return; }

    try {
        if (index === -1) {
            if (!password) { alert("Please set a password for the new user."); return; }
            await API.createUser({ username, password, fullName, role, status });
        } else {
            const user = getUsers()[index];
            const payload = { username, fullName, role, status };
            if (password) {
                payload.password = password;
            }
            await API.updateUser(user.id, payload);
        }

        await loadUsers();
        renderUsers();
        bootstrap.Modal.getInstance(document.getElementById("userModal")).hide();
    } catch (e) {
        alert("Save failed: " + e.message);
    }
}

async function deleteUser(i) {
    const current = getSession();
    const users   = getUsers();
    if (users[i].username === current.username) { alert("You cannot delete your own account."); return; }
    if (!confirm("Delete this user?")) return;
    try {
        await API.deleteUser(users[i].id);
        await loadUsers();
        renderUsers();
    } catch (e) {
        alert("Delete failed: " + e.message);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadUsers();
    renderUsers();
});