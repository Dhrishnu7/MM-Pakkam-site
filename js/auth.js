/**
 * auth.js — MM Pakkam Authentication Module
 * Users stored in Supabase (mm_users table) — works across ALL devices and deployments.
 * Session stored in localStorage/sessionStorage (device-specific by design).
 */

/* ─────────────────────────────────────────
   Pure-JS SHA-256  (works on file://, http://, https://)
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

/* ─────────────────────────────────────────
   Supabase Config (same project as supabase.js)
───────────────────────────────────────────*/
const _AUTH_SUPABASE_URL = 'https://jwyyjdwlbgjijmwillow.supabase.co';
const _AUTH_SUPABASE_KEY = 'sb_publishable_sY9QwFEMckky9KDJoc1O_w_zN7qY0mo';
const MM_SESSION_KEY  = 'mm_auth_session';
const MM_REMEMBER_KEY = 'mm_auth_remember';

// Lazy Supabase client — returns existing _supabase global or creates a new one
function _authDB() {
    if (typeof _supabase !== 'undefined' && _supabase) return _supabase;
    if (typeof supabase !== 'undefined' && supabase && supabase.createClient) {
        return supabase.createClient(_AUTH_SUPABASE_URL, _AUTH_SUPABASE_KEY);
    }
    return null;
}

/* ─────────────────────────────────────────
   Password Hashing
───────────────────────────────────────────*/
async function mmHashPassword(password) {
    return _sha256(password);
}

/* ─────────────────────────────────────────
   User Store — Supabase (mm_users table)
   Falls back to localStorage if Supabase unavailable.
───────────────────────────────────────────*/

// localStorage fallback helpers
function _localGetUsers() {
    try { return JSON.parse(localStorage.getItem('mm_auth_users') || '[]'); }
    catch { return []; }
}
function _localSaveUsers(users) {
    try { localStorage.setItem('mm_auth_users', JSON.stringify(users)); } catch {}
}

async function mmGetUsers() {
    const localUsers = _localGetUsers();
    const db = _authDB();
    if (db) {
        try {
            const { data, error } = await db.from('mm_users').select('*');
            if (!error && data) {
                // Merge local users that aren't in Supabase yet
                const merged = [...data];
                let uploadedAny = false;
                
                for (const lUser of localUsers) {
                    const existsInDb = data.find(d => 
                        (d.id && d.id === lUser.id) || 
                        (d.username.toLowerCase() === lUser.username.toLowerCase() && 
                         (d.tenant_id || d.username) === (lUser.tenant_id || lUser.username))
                    );
                    
                    if (!existsInDb) {
                        merged.push(lUser);
                        // Auto-migrate to Supabase in background
                        _saveUser(lUser);
                        uploadedAny = true;
                    }
                }
                
                if (!uploadedAny) {
                    // Keep local cache fresh with DB truth
                    _localSaveUsers(data);
                }
                return merged;
            }
            console.warn('[auth] Supabase mm_users fetch failed:', error?.message || error);
        } catch (e) {
            console.warn('[auth] Supabase unreachable, using localStorage:', e.message);
        }
    }
    return localUsers;
}

async function mmHasUsers() {
    const users = await mmGetUsers();
    return users.length > 0;
}

// Upsert a single user record to Supabase (and localStorage as backup)
async function _saveUser(userObj) {
    // Build a stable composite id so two stores can have the same username
    if (!userObj.id) {
        const tid = userObj.tenant_id || userObj.username;
        userObj.id = tid + ':' + userObj.username;
    }
    const db = _authDB();
    if (db) {
        try {
            // Strategy 1: upsert on composite 'id' (preferred)
            const { error: e1 } = await db.from('mm_users')
                .upsert({ ...userObj }, { onConflict: 'id' });
            if (!e1) {
                _syncLocal(userObj);
                return true;
            }
            console.warn('[auth] upsert(id) failed:', e1.message, '— trying upsert(username)');

            // Strategy 2: upsert on 'username' (old DB schema)
            const { error: e2 } = await db.from('mm_users')
                .upsert({ ...userObj }, { onConflict: 'username' });
            if (!e2) {
                _syncLocal(userObj);
                return true;
            }
            console.warn('[auth] upsert(username) failed:', e2.message, '— trying insert');

            // Strategy 3: plain insert (handles case where row doesn't exist yet)
            const { error: e3 } = await db.from('mm_users').insert({ ...userObj });
            if (!e3) {
                _syncLocal(userObj);
                return true;
            }
            console.warn('[auth] insert failed:', e3.message, '— saving to localStorage only');
        } catch (e) {
            console.warn('[auth] Supabase save error:', e.message);
        }
    }
    // localStorage fallback
    _syncLocal(userObj);
    return false;
}

function _syncLocal(userObj) {
    const local = _localGetUsers();
    const idx = local.findIndex(u => u.id === userObj.id ||
        u.username.toLowerCase() === userObj.username.toLowerCase() &&
        (u.tenant_id || u.username) === (userObj.tenant_id || userObj.username));
    if (idx >= 0) local[idx] = userObj; else local.push(userObj);
    _localSaveUsers(local);
}

async function _deleteUser(username, tenantId) {
    // Build the stable id to target the exact record
    const tid = tenantId || username;
    const id  = tid + ':' + username;
    const db = _authDB();
    if (db) {
        try {
            // Try to delete by id first (new format)
            await db.from('mm_users').delete().eq('id', id);
            // Also delete any old-format record matching just username (migration cleanup)
            await db.from('mm_users').delete().eq('username', username).eq('tenant_id', tid);
        } catch {}
    }
    _localSaveUsers(_localGetUsers().filter(u => u.id !== id && u.username.toLowerCase() !== username.toLowerCase()));
}

/* ─────────────────────────────────────────
   Session  (always localStorage/sessionStorage — per-device by design)
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
    // tenant_id: for owners it's their own username; for workers it's their owner's username
    const session = {
        username:  user.username,
        role:      user.role,
        tenant_id: user.tenant_id || user.username,  // owners are their own tenant
        token:     user.token, // Store active session token
        loginTime: Date.now()
    };
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
   Auth Guards  (async — await on each page)
───────────────────────────────────────────*/

/**
 * Redirect to login.html if not logged in.
 * Returns the current session object if logged in.
 */
async function mmRequireAuth() {
    const session = mmGetSession();
    if (!session) {
        if (!window.location.pathname.endsWith('login.html') &&
            !window.location.pathname.endsWith('setup.html')) {
            // Check if any users exist; if not, send to setup
            const hasUsers = await mmHasUsers();
            window.location.replace(hasUsers ? 'login.html' : 'setup.html');
        }
        return null;
    }

    // Validate the token on page load
    await _validateSession(session);
    
    // Start background monitor (every 10s)
    if (!window._mmSessionMonitor) {
        window._mmSessionMonitor = setInterval(async () => {
            const currentSession = mmGetSession();
            if (currentSession) await _validateSession(currentSession);
        }, 10000);
    }

    return session;
}

// Helper to check DB and force logout if token changed
async function _validateSession(session) {
    try {
        const users = await mmGetUsers();
        // Fallback for old sessions that lack tenant_id
        const tenantId = session.tenant_id || session.username;
        const dbUser = users.find(u => u.username === session.username && (u.tenant_id === tenantId || u.username === tenantId));
        
        if (dbUser && dbUser.active_session_token) {
            // If the session has no token (old session), or the token doesn't match, log them out
            if (!session.token || dbUser.active_session_token !== session.token) {
                mmClearSession();
                alert("You have been logged out because this account was just signed in from another device.");
                window.location.replace('login.html');
            }
        }
    } catch(e) {
        // Ignore network errors so we don't accidentally log out offline users
    }
}

/**
 * Redirect to index.html if logged-in user is not the owner.
 */
async function mmRequireOwner() {
    const session = await mmRequireAuth();
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

/** Login. Returns { success, message, forceRequired } */
async function mmLogin(username, password, remember, force = false) {
    try {
        const users = await mmGetUsers();
        const hash  = await mmHashPassword(password);
        // Match by username (case-insensitive) and password hash
        const user  = users.find(u =>
            u.username.toLowerCase() === username.trim().toLowerCase() &&
            u.passwordHash === hash
        );
        if (!user) return { success: false, message: 'Invalid username or password.' };
        // Ensure tenant_id is always set (migrate old records on the fly)
        if (!user.tenant_id) user.tenant_id = user.username;

        // --- Single Device Lockout Logic ---
        if (user.active_session_token && !force) {
            // Check if the token belongs to the CURRENT device. If yes, allow.
            const existingSession = mmGetSession();
            if (!existingSession || existingSession.token !== user.active_session_token) {
                return { 
                    success: false, 
                    message: 'Account already logged in on another device.',
                    forceRequired: true 
                };
            }
        }

        // Generate new session token and save to DB
        const newToken = Date.now().toString(36) + Math.random().toString(36).substr(2);
        user.active_session_token = newToken;
        await _saveUser(user);

        user.token = newToken; // attach token to session
        mmSaveSession(user, remember);
        return { success: true, user };
    } catch (err) {
        console.error('[auth] mmLogin error:', err);
        return { success: false, message: 'Sign-in failed. Please try again.' };
    }
}

/** Logout */
async function mmLogout() {
    const session = mmGetSession();
    if (session) {
        // Clear active session from DB
        const users = await mmGetUsers();
        const user = users.find(u => u.username === session.username && u.tenant_id === session.tenant_id);
        if (user && user.active_session_token === session.token) {
            user.active_session_token = null;
            await _saveUser(user);
        }
    }
    mmClearSession();
    window.location.replace('login.html');
}

/**
 * Get all users belonging to the current store (tenant).
 * Owner accounts = global. Workers = scoped per owner (tenant_id).
 */
async function mmGetTenantUsers() {
    const session  = mmGetSession();
    const tenantId = session ? (session.tenant_id || session.username) : null;
    const all = await mmGetUsers();
    if (!tenantId) return all;
    // Return users whose tenant_id matches, OR legacy users with no tenant_id that match username
    return all.filter(u =>
        u.tenant_id === tenantId ||
        (!u.tenant_id && u.username === tenantId) // legacy owner record
    );
}

/** Create a new store owner account. Every account is fully isolated. Returns { success, message } */
async function mmCreateOwner(username, password) {
    // Owner usernames must be globally unique (needed for unambiguous login)
    const users = await mmGetUsers();
    if (users.find(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
        return { success: false, message: 'This username is already taken. Please choose a different one.' };
    }
    const hash = await mmHashPassword(password);
    // tenant_id for an owner = their own username (they ARE the tenant root)
    const user = { username: username.trim(), passwordHash: hash, role: 'owner', tenant_id: username.trim(), createdAt: Date.now() };
    await _saveUser(user);
    return { success: true };
}

/** Add a worker to the current owner's store. Username unique within this store only. */
async function mmAddWorker(username, password) {
    const session  = mmGetSession();
    const tenantId = session ? (session.tenant_id || session.username) : null;
    // Only check uniqueness within THIS store's users, not globally
    const tenantUsers = await mmGetTenantUsers();
    if (tenantUsers.find(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
        return { success: false, message: 'This username already exists in your store.' };
    }
    const hash = await mmHashPassword(password);
    await _saveUser({ username: username.trim(), passwordHash: hash, role: 'worker', tenant_id: tenantId, createdAt: Date.now() });
    return { success: true };
}

/** Add an additional owner-role user within the current store. */
async function mmAddOwner(username, password) {
    const session  = mmGetSession();
    const tenantId = session ? (session.tenant_id || session.username) : null;
    // Check uniqueness within THIS store only
    const tenantUsers = await mmGetTenantUsers();
    if (tenantUsers.find(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
        return { success: false, message: 'This username already exists in your store.' };
    }
    const hash = await mmHashPassword(password);
    await _saveUser({ username: username.trim(), passwordHash: hash, role: 'owner', tenant_id: tenantId, createdAt: Date.now() });
    return { success: true };
}

/** Delete a user by username (owner function) */
async function mmDeleteUser(username) {
    const session  = mmGetSession();
    const tenantId = session ? (session.tenant_id || session.username) : username;
    await _deleteUser(username, tenantId);
}

/**
 * Permanently delete the entire account:
 * - Wipes ALL Supabase data for this tenant (bills, purchases, medicines, customers, doctors)
 * - Deletes all user records (owner + workers) for this tenant from mm_users
 * - Clears all tenant-scoped localStorage keys
 * - Logs out and redirects to setup page
 * Returns { success, message }
 */
async function mmDeleteAccountPermanently() {
    const session  = mmGetSession();
    if (!session || session.role !== 'owner') return { success: false, message: 'Only the owner can delete an account.' };
    const tenantId = session.tenant_id || session.username;

    try {
        // ── 1. Delete all Supabase data for this tenant ──
        // We use direct _supabase calls (not the helper fns) to avoid re-checking user
        const db = (typeof _supabase !== 'undefined') ? _supabase : null;
        if (db) {
            // Delete bill_items first (foreign key child of bills)
            const { data: bills } = await db.from('bills').select('id').eq('user_id', tenantId);
            if (bills && bills.length > 0) {
                const billIds = bills.map(b => b.id);
                for (let i = 0; i < billIds.length; i += 100) {
                    await db.from('bill_items').delete().in('bill_id', billIds.slice(i, i+100));
                }
            }
            // Delete bills
            await db.from('bills').delete().eq('user_id', tenantId);
            // Delete purchases
            await db.from('purchases').delete().eq('user_id', tenantId);
            // Delete medicines
            await db.from('medicines').delete().eq('user_id', tenantId);
            // Delete customers
            await db.from('customers').delete().eq('user_id', tenantId);
            // Delete doctors
            await db.from('doctors').delete().eq('user_id', tenantId);
        }

        // ── 2. Delete all user accounts for this tenant ──
        const allUsers = await mmGetUsers();
        const tenantUsers = allUsers.filter(u =>
            u.tenant_id === tenantId ||
            u.username  === tenantId  // owner record (old format)
        );
        for (const u of tenantUsers) {
            await _deleteUser(u.username);
        }

        // ── 3. Clear all localStorage keys for this tenant ──
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.includes(`_${tenantId}_`)) keysToRemove.push(k);
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));

        // ── 4. Clear session and redirect ──
        mmClearSession();
        return { success: true };
    } catch (err) {
        console.error('[auth] mmDeleteAccountPermanently error:', err);
        return { success: false, message: 'Something went wrong: ' + err.message };
    }
}

/** Reset a user's password. Returns { success, message } */
async function mmResetPassword(username, newPassword) {
    const users = await mmGetUsers();
    const user  = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return { success: false, message: 'User not found.' };
    user.passwordHash = await mmHashPassword(newPassword);
    await _saveUser(user);
    return { success: true };
}

/** Rename a user. Returns { success, message } */
async function mmRenameUser(oldUsername, newUsername) {
    const users  = await mmGetUsers();
    const session = mmGetSession();
    const tenantId = session ? (session.tenant_id || session.username) : null;
    const trimmed = newUsername.trim();
    if (trimmed.length < 3) return { success: false, message: 'Username must be at least 3 characters.' };
    // Check uniqueness within the same tenant
    const tenantUsers = await mmGetTenantUsers();
    if (tenantUsers.find(u => u.username.toLowerCase() === trimmed.toLowerCase() &&
                              u.username.toLowerCase() !== oldUsername.toLowerCase())) {
        return { success: false, message: 'Username already taken in this store.' };
    }
    const user = users.find(u => u.username.toLowerCase() === oldUsername.toLowerCase() &&
                                  (u.tenant_id === tenantId || u.username === tenantId));
    if (!user) return { success: false, message: 'User not found.' };

    // Delete old record (by old id), save with new name
    await _deleteUser(oldUsername, tenantId);
    user.username = trimmed;
    user.id = (user.tenant_id || tenantId) + ':' + trimmed;  // recalc id
    await _saveUser(user);

    // Update session if renaming the currently logged-in user
    if (session && session.username.toLowerCase() === oldUsername.toLowerCase()) {
        session.username = trimmed;
        const remember = localStorage.getItem(MM_REMEMBER_KEY) === 'true';
        if (remember) localStorage.setItem(MM_SESSION_KEY, JSON.stringify(session));
        else sessionStorage.setItem(MM_SESSION_KEY, JSON.stringify(session));
    }
    return { success: true };
}

/* ─────────────────────────────────────────
   Navbar User-Info Injection
───────────────────────────────────────────*/
function mmInjectUserBar() {
    const session = mmGetSession();
    if (!session) return;

    if (!document.getElementById('mm-auth-styles')) {
        const style = document.createElement('style');
        style.id = 'mm-auth-styles';
        style.textContent = `
            .mm-user-bar { display: flex; align-items: center; gap: 10px; }
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
            .mm-user-name { font-size: 0.82rem; font-weight: 700; color: #0f172a; }
            .mm-role-badge {
                font-size: 0.62rem; font-weight: 800; letter-spacing: 0.06em;
                text-transform: uppercase; padding: 2px 7px; border-radius: 20px;
            }
            .mm-role-owner { background: linear-gradient(135deg,#fef3c7,#fde68a); color: #92400e; border: 1px solid #fcd34d; }
            .mm-role-worker { background: linear-gradient(135deg,#dbeafe,#bfdbfe); color: #1e40af; border: 1px solid #93c5fd; }
            .mm-manage-btn {
                display: inline-flex; align-items: center; gap: 5px;
                padding: 6px 13px; border-radius: 50px;
                border: 1.5px solid rgba(139,92,246,0.35);
                background: rgba(237,233,254,0.8);
                color: #6d28d9; font-size: 0.78rem; font-weight: 700;
                text-decoration: none; transition: all 0.22s ease; cursor: pointer;
            }
            .mm-manage-btn:hover { background: #7c3aed; color: white; border-color: #7c3aed; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(124,58,237,0.3); }
            .mm-logout-btn {
                display: inline-flex; align-items: center; gap: 5px;
                padding: 6px 13px; border-radius: 50px;
                border: 1.5px solid rgba(239,68,68,0.3);
                background: rgba(254,242,242,0.8);
                color: #dc2626; font-size: 0.78rem; font-weight: 700;
                cursor: pointer; transition: all 0.22s ease; font-family: 'Inter', sans-serif;
            }
            .mm-logout-btn:hover { background: #ef4444; color: white; border-color: #ef4444; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(239,68,68,0.3); }
        `;
        document.head.appendChild(style);
    }

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

    const header = document.querySelector('header');
    if (header) header.appendChild(bar);
}
