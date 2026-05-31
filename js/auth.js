/**
 * auth.js — MM Pakkam Authentication Module
 * Uses Web Crypto API (SHA-256) for password hashing.
 * No server required — credentials stored securely in localStorage.
 */

const MM_USERS_KEY   = 'mm_auth_users';
const MM_SESSION_KEY = 'mm_auth_session';
const MM_REMEMBER_KEY = 'mm_auth_remember';

/* ─────────────────────────────────────────
   Password Hashing  (SHA-256 via Web Crypto)
───────────────────────────────────────────*/
async function mmHashPassword(password) {
    const encoded = new TextEncoder().encode(password);
    const buffer  = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
}

/* ─────────────────────────────────────────
   User Store
───────────────────────────────────────────*/
function mmGetUsers() {
    try { return JSON.parse(localStorage.getItem(MM_USERS_KEY) || '[]'); }
    catch { return []; }
}
function mmSaveUsers(users) {
    localStorage.setItem(MM_USERS_KEY, JSON.stringify(users));
}
function mmHasUsers() {
    return mmGetUsers().length > 0;
}

/* ─────────────────────────────────────────
   Session
───────────────────────────────────────────*/
function mmGetSession() {
    const remember = localStorage.getItem(MM_REMEMBER_KEY) === 'true';
    const raw = remember
        ? localStorage.getItem(MM_SESSION_KEY)
        : sessionStorage.getItem(MM_SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch { return null; }
}

function mmSaveSession(user, remember) {
    const session = { username: user.username, role: user.role, loginTime: Date.now() };
    if (remember) {
        localStorage.setItem(MM_REMEMBER_KEY, 'true');
        localStorage.setItem(MM_SESSION_KEY, JSON.stringify(session));
    } else {
        localStorage.removeItem(MM_REMEMBER_KEY);
        sessionStorage.setItem(MM_SESSION_KEY, JSON.stringify(session));
    }
}

function mmClearSession() {
    sessionStorage.removeItem(MM_SESSION_KEY);
    localStorage.removeItem(MM_SESSION_KEY);
    localStorage.removeItem(MM_REMEMBER_KEY);
}

/* ─────────────────────────────────────────
   Auth Guards  (call at top of every page)
───────────────────────────────────────────*/

/**
 * Redirect to login.html if not logged in.
 * Returns the current session object if logged in.
 */
function mmRequireAuth() {
    // If no owner account exists yet → go to first-time setup
    if (!mmHasUsers()) {
        if (!window.location.pathname.endsWith('setup.html')) {
            window.location.replace('setup.html');
        }
        return null;
    }
    const session = mmGetSession();
    if (!session) {
        if (!window.location.pathname.endsWith('login.html')) {
            window.location.replace('login.html');
        }
        return null;
    }
    return session;
}

/**
 * Redirect to index.html if logged-in user is not the owner.
 */
function mmRequireOwner() {
    const session = mmRequireAuth();
    if (session && session.role !== 'owner') {
        window.location.replace('index.html');
        return null;
    }
    return session;
}

/* ─────────────────────────────────────────
   Public API
───────────────────────────────────────────*/

/** Returns { username, role } of current user, or null */
function mmCurrentUser() {
    return mmGetSession();
}

/** Login. Returns { success, message } */
async function mmLogin(username, password, remember) {
    const users = mmGetUsers();
    const hash  = await mmHashPassword(password);
    const user  = users.find(u =>
        u.username.toLowerCase() === username.trim().toLowerCase() &&
        u.passwordHash === hash
    );
    if (!user) return { success: false, message: 'Invalid username or password.' };
    mmSaveSession(user, remember);
    return { success: true, user };
}

/** Logout */
function mmLogout() {
    mmClearSession();
    window.location.replace('login.html');
}

/** Create first owner account (setup page only). Returns { success, message } */
async function mmCreateOwner(username, password) {
    if (mmHasUsers()) return { success: false, message: 'Owner already exists.' };
    const hash = await mmHashPassword(password);
    mmSaveUsers([{ username: username.trim(), passwordHash: hash, role: 'owner', createdAt: Date.now() }]);
    return { success: true };
}

/** Add a worker (owner function). Returns { success, message } */
async function mmAddWorker(username, password) {
    const users = mmGetUsers();
    if (users.find(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
        return { success: false, message: 'Username already exists.' };
    }
    const hash = await mmHashPassword(password);
    users.push({ username: username.trim(), passwordHash: hash, role: 'worker', createdAt: Date.now() });
    mmSaveUsers(users);
    return { success: true };
}

/** Delete a user by username (owner function) */
function mmDeleteUser(username) {
    const users = mmGetUsers().filter(u => u.username.toLowerCase() !== username.toLowerCase());
    mmSaveUsers(users);
}

/** Reset a user's password. Returns { success, message } */
async function mmResetPassword(username, newPassword) {
    const users = mmGetUsers();
    const user  = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return { success: false, message: 'User not found.' };
    user.passwordHash = await mmHashPassword(newPassword);
    mmSaveUsers(users);
    return { success: true };
}

/* ─────────────────────────────────────────
   Navbar User-Info Injection
   Call mmInjectUserBar() on every protected page to
   automatically add the logged-in user pill + logout btn.
───────────────────────────────────────────*/
function mmInjectUserBar() {
    const session = mmGetSession();
    if (!session) return;

    // Inject CSS once
    if (!document.getElementById('mm-auth-styles')) {
        const style = document.createElement('style');
        style.id = 'mm-auth-styles';
        style.textContent = `
            .mm-user-bar {
                display: flex; align-items: center; gap: 10px;
            }
            .mm-user-pill {
                display: inline-flex; align-items: center; gap: 8px;
                background: rgba(255,255,255,0.7);
                border: 1.5px solid rgba(0,0,0,0.08);
                border-radius: 50px; padding: 5px 14px 5px 6px;
                backdrop-filter: blur(10px);
            }
            .mm-avatar {
                width: 28px; height: 28px; border-radius: 50%;
                background: linear-gradient(135deg, #0ea5e9, #10b981);
                display: flex; align-items: center; justify-content: center;
                color: white; font-weight: 800; font-size: 0.75rem;
                flex-shrink: 0; letter-spacing: 0.02em;
            }
            .mm-user-name {
                font-size: 0.82rem; font-weight: 700; color: #0f172a;
            }
            .mm-role-badge {
                font-size: 0.62rem; font-weight: 800; letter-spacing: 0.06em;
                text-transform: uppercase; padding: 2px 7px; border-radius: 20px;
            }
            .mm-role-owner {
                background: linear-gradient(135deg,#fef3c7,#fde68a);
                color: #92400e; border: 1px solid #fcd34d;
            }
            .mm-role-worker {
                background: linear-gradient(135deg,#dbeafe,#bfdbfe);
                color: #1e40af; border: 1px solid #93c5fd;
            }
            .mm-manage-btn {
                display: inline-flex; align-items: center; gap: 5px;
                padding: 6px 13px; border-radius: 50px;
                border: 1.5px solid rgba(139,92,246,0.35);
                background: rgba(237,233,254,0.8);
                color: #6d28d9; font-size: 0.78rem; font-weight: 700;
                text-decoration: none; transition: all 0.22s ease;
                cursor: pointer;
            }
            .mm-manage-btn:hover {
                background: #7c3aed; color: white; border-color: #7c3aed;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(124,58,237,0.3);
            }
            .mm-logout-btn {
                display: inline-flex; align-items: center; gap: 5px;
                padding: 6px 13px; border-radius: 50px;
                border: 1.5px solid rgba(239,68,68,0.3);
                background: rgba(254,242,242,0.8);
                color: #dc2626; font-size: 0.78rem; font-weight: 700;
                cursor: pointer; transition: all 0.22s ease;
                font-family: 'Inter', sans-serif;
            }
            .mm-logout-btn:hover {
                background: #ef4444; color: white; border-color: #ef4444;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(239,68,68,0.3);
            }
        `;
        document.head.appendChild(style);
    }

    // Build the user bar HTML
    const initials = session.username.slice(0, 2).toUpperCase();
    const isOwner  = session.role === 'owner';
    const bar = document.createElement('div');
    bar.className = 'mm-user-bar';
    bar.innerHTML = `
        ${isOwner ? `
        <a class="mm-manage-btn" href="manage-users.html" title="Manage Users">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-5.356-3.712M9 20H4v-2a4 4 0 015.356-3.712M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Users
        </a>` : ''}
        <div class="mm-user-pill">
            <div class="mm-avatar">${initials}</div>
            <span class="mm-user-name">${session.username}</span>
            <span class="mm-role-badge ${isOwner ? 'mm-role-owner' : 'mm-role-worker'}">${session.role}</span>
        </div>
        <button class="mm-logout-btn" onclick="mmLogout()" title="Logout">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/>
            </svg>
            Logout
        </button>
    `;

    // Append to header
    const header = document.querySelector('header');
    if (header) header.appendChild(bar);
}
