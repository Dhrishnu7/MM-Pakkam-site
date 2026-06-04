/**
 * auth.js — MM Pakkam Authentication Module
 * Uses a pure-JS SHA-256 implementation so it works on file://, http://, and https://.
 * No server required — credentials stored securely in localStorage.
 */

/* ─────────────────────────────────────────
   Pure-JS SHA-256  (works on file:// too)
   Based on the public domain implementation by Angel Marin & Paul Johnston
───────────────────────────────────────────*/
function _sha256(str) {
    function safe_add(x, y) {
        var lsw = (x & 0xFFFF) + (y & 0xFFFF);
        var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    }
    function S(X, n) { return (X >>> n) | (X << (32 - n)); }
    function R(X, n) { return (X >>> n); }
    function Ch(x, y, z) { return ((x & y) ^ ((~x) & z)); }
    function Maj(x, y, z) { return ((x & y) ^ (x & z) ^ (y & z)); }
    function Sigma0(x) { return (S(x, 2) ^ S(x, 13) ^ S(x, 22)); }
    function Sigma1(x) { return (S(x, 6) ^ S(x, 11) ^ S(x, 25)); }
    function Gamma0(x) { return (S(x, 7) ^ S(x, 18) ^ R(x, 3)); }
    function Gamma1(x) { return (S(x, 17) ^ S(x, 19) ^ R(x, 10)); }

    var K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    // UTF-8 encode
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c < 128) { bytes.push(c); }
        else if (c < 2048) { bytes.push((c >> 6) | 192, (c & 63) | 128); }
        else { bytes.push((c >> 12) | 224, ((c >> 6) & 63) | 128, (c & 63) | 128); }
    }
    var l = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    bytes.push(0,0,0,0, (l>>>24)&0xFF, (l>>>16)&0xFF, (l>>>8)&0xFF, l&0xFF);

    var W = [], H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    for (var b = 0; b < bytes.length; b += 64) {
        for (var j = 0; j < 16; j++)
            W[j] = (bytes[b+j*4]<<24)|(bytes[b+j*4+1]<<16)|(bytes[b+j*4+2]<<8)|bytes[b+j*4+3];
        for (var j = 16; j < 64; j++)
            W[j] = safe_add(safe_add(Gamma1(W[j-2]), W[j-7]), safe_add(Gamma0(W[j-15]), W[j-16]));
        var a=H[0],bh=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
        for (var j = 0; j < 64; j++) {
            var T1 = safe_add(safe_add(safe_add(safe_add(h,Sigma1(e)),Ch(e,f,g)),K[j]),W[j]);
            var T2 = safe_add(Sigma0(a),Maj(a,bh,c));
            h=g; g=f; f=e; e=safe_add(d,T1); d=c; c=bh; bh=a; a=safe_add(T1,T2);
        }
        H[0]=safe_add(a,H[0]); H[1]=safe_add(bh,H[1]); H[2]=safe_add(c,H[2]); H[3]=safe_add(d,H[3]);
        H[4]=safe_add(e,H[4]); H[5]=safe_add(f,H[5]); H[6]=safe_add(g,H[6]); H[7]=safe_add(h,H[7]);
    }
    return H.map(n => (n >>> 0).toString(16).padStart(8,'0')).join('');
}

const MM_USERS_KEY   = 'mm_auth_users';
const MM_SESSION_KEY = 'mm_auth_session';
const MM_REMEMBER_KEY = 'mm_auth_remember';

/* ─────────────────────────────────────────
   Password Hashing  (pure-JS SHA-256)
───────────────────────────────────────────*/
async function mmHashPassword(password) {
    // Pure-JS SHA-256 — works on file://, http://, and https://
    return _sha256(password);
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
    try {
        const users = mmGetUsers();
        const hash  = await mmHashPassword(password);
        const user  = users.find(u =>
            u.username.toLowerCase() === username.trim().toLowerCase() &&
            u.passwordHash === hash
        );
        if (!user) return { success: false, message: 'Invalid username or password.' };
        mmSaveSession(user, remember);
        return { success: true, user };
    } catch (err) {
        console.error('[auth] mmLogin error:', err);
        return { success: false, message: 'Sign-in failed. Please try again or check your browser settings (cookies/storage may be blocked).' };
    }
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

/** Add a new owner (owner function). Returns { success, message } */
async function mmAddOwner(username, password) {
    const users = mmGetUsers();
    if (users.find(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
        return { success: false, message: 'Username already exists.' };
    }
    const hash = await mmHashPassword(password);
    users.push({ username: username.trim(), passwordHash: hash, role: 'owner', createdAt: Date.now() });
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

/** Rename a user. Returns { success, message } */
function mmRenameUser(oldUsername, newUsername) {
    const users = mmGetUsers();
    const trimmed = newUsername.trim();
    if (trimmed.length < 3) return { success: false, message: 'Username must be at least 3 characters.' };
    if (users.find(u => u.username.toLowerCase() === trimmed.toLowerCase() && u.username.toLowerCase() !== oldUsername.toLowerCase())) {
        return { success: false, message: 'Username already taken.' };
    }
    const user = users.find(u => u.username.toLowerCase() === oldUsername.toLowerCase());
    if (!user) return { success: false, message: 'User not found.' };
    user.username = trimmed;
    mmSaveUsers(users);
    // Update session if renaming the currently logged-in user
    const session = mmGetSession();
    if (session && session.username.toLowerCase() === oldUsername.toLowerCase()) {
        session.username = trimmed;
        const remember = localStorage.getItem(MM_REMEMBER_KEY) === 'true';
        if (remember) {
            localStorage.setItem(MM_SESSION_KEY, JSON.stringify(session));
        } else {
            sessionStorage.setItem(MM_SESSION_KEY, JSON.stringify(session));
        }
    }
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
