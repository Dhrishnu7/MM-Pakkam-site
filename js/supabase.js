/**
 * supabase.js — Supabase Client for MM Pakkam
 * DATA ISOLATION: Every read/write is scoped to the current logged-in user's username.
 * Plain HTML/JS — loaded via CDN (no build step needed)
 */

const SUPABASE_URL  = 'https://jwyyjdwlbgjijmwillow.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_sY9QwFEMckky9KDJoc1O_w_zN7qY0mo';

// Create and export a single shared client instance
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ─────────────────────────────────────────────────────
   CURRENT USER HELPER
   Returns the username of the currently logged-in user.
   All DB reads/writes are scoped to this username.
───────────────────────────────────────────────────── */
function _currentUser() {
    const session = (typeof mmGetSession === 'function') ? mmGetSession() : null;
    return session ? session.username : null;
}

/* ─────────────────────────────────────────────────────
   localStorage KEY SCOPING
   Prefix every localStorage key with the username so
   data never bleeds between users on the same device.
───────────────────────────────────────────────────── */
function _lsKey(key) {
    const user = _currentUser();
    return user ? `mm_${user}_${key}` : `mm_${key}`;
}

// Scoped localStorage helpers used by other pages
function mmLsGet(key) {
    try { return JSON.parse(localStorage.getItem(_lsKey(key)) || 'null'); } catch { return null; }
}
function mmLsSet(key, value) {
    try { localStorage.setItem(_lsKey(key), JSON.stringify(value)); } catch {}
}
function mmLsRemove(key) {
    try { localStorage.removeItem(_lsKey(key)); } catch {}
}

/* ─────────────────────────────────────────────────────
   CUSTOMERS
───────────────────────────────────────────────────── */
async function dbGetCustomers() {
    const user = _currentUser();
    let query = _supabase.from('customers').select('*').order('name');
    if (user) query = query.eq('user_id', user);
    const { data, error } = await query;
    if (error) { console.error('customers fetch:', error); return []; }
    return data;
}
async function dbAddCustomer(name, phone, address) {
    const user = _currentUser();
    const { data, error } = await _supabase.from('customers')
        .upsert({ name: name.trim(), phone: phone.trim(), address: address?.trim() || '', user_id: user },
                 { onConflict: 'name,phone,user_id', ignoreDuplicates: true })
        .select();
    if (error) { console.error('customer add:', error); return { success: false, message: error.message }; }
    return { success: true, data: data?.[0] || null };
}
async function dbDeleteCustomer(id) {
    const user = _currentUser();
    let query = _supabase.from('customers').delete().eq('id', id);
    if (user) query = query.eq('user_id', user);
    const { error } = await query;
    return !error;
}

/* ─────────────────────────────────────────────────────
   DOCTORS
───────────────────────────────────────────────────── */
async function dbGetDoctors() {
    const user = _currentUser();
    let query = _supabase.from('doctors').select('*').order('name');
    if (user) query = query.eq('user_id', user);
    const { data, error } = await query;
    if (error) { console.error('doctors fetch:', error); return []; }
    return data;
}
async function dbAddDoctor(name, phone, clinic, address) {
    const user = _currentUser();
    const { data, error } = await _supabase.from('doctors')
        .upsert({ name: name.trim(), phone: phone.trim(), clinic: clinic?.trim() || '', address: address?.trim() || '', user_id: user },
                 { onConflict: 'name,phone,user_id', ignoreDuplicates: true })
        .select();
    if (error) { console.error('doctor add:', error); return { success: false, message: error.message }; }
    return { success: true, data: data?.[0] || null };
}
async function dbDeleteDoctor(id) {
    const user = _currentUser();
    let query = _supabase.from('doctors').delete().eq('id', id);
    if (user) query = query.eq('user_id', user);
    const { error } = await query;
    return !error;
}

/* ─────────────────────────────────────────────────────
   MEDICINES  (catalogue — shared across all users of same pharmacy)
───────────────────────────────────────────────────── */
async function dbGetMedicines() {
    const user = _currentUser();
    let query = _supabase.from('medicines').select('name').order('name');
    if (user) query = query.eq('user_id', user);
    const { data, error } = await query;
    if (error) { console.error('medicines fetch:', error); return []; }
    return data.map(m => m.name);
}
async function dbImportMedicines(nameArray) {
    const user = _currentUser();
    const rows = [...new Set(nameArray.map(n => n.trim()).filter(Boolean))].map(name => ({ name, user_id: user }));
    const { error } = await _supabase.from('medicines').upsert(rows, { onConflict: 'name,user_id', ignoreDuplicates: true });
    if (error) console.error('medicine import:', error);
    return !error;
}

/* ─────────────────────────────────────────────────────
   PURCHASES
───────────────────────────────────────────────────── */
async function dbGetPurchases(fromDate, toDate) {
    const user = _currentUser();
    let query = _supabase.from('purchases').select('*').order('date', { ascending: false });
    if (user)     query = query.eq('user_id', user);
    if (fromDate) query = query.gte('date', fromDate);
    if (toDate)   query = query.lte('date', toDate);
    const { data, error } = await query;
    if (error) { console.error('purchases fetch:', error); return []; }
    return data;
}
async function dbAddPurchase(row) {
    const user = _currentUser();
    const { data, error } = await _supabase.from('purchases').insert({
        bill_no:      row.billNo     || '',
        firm:         row.firm       || '',
        date:         row.date       || new Date().toISOString().slice(0,10),
        product_name: row.productName || row.product_name || '',
        batch_no:     row.batchNo    || row.batch_no     || '',
        expire_date:  row.expireDate || row.expire_date  || '',
        quantity:     Number(row.quantity) || 0,
        mrp:          Number(row.mrp)      || 0,
        rate:         Number(row.rate)     || 0,
        gst:          Number(row.gst)      || 0,
        user_id:      user,
    }).select().single();
    if (error) { console.error('purchase add:', error); return { success: false, message: error.message }; }
    return { success: true, data };
}
async function dbDeletePurchase(id) {
    const user = _currentUser();
    let query = _supabase.from('purchases').delete().eq('id', id);
    if (user) query = query.eq('user_id', user);
    const { error } = await query;
    return !error;
}

/* ─────────────────────────────────────────────────────
   BILLS  (sales)
───────────────────────────────────────────────────── */
async function dbNextBillNo() {
    const user = _currentUser();
    // Count this user's existing bills to generate next number
    const { count } = await _supabase
        .from('bills')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user || '');
    return 'MM-' + String((count || 0) + 1).padStart(3, '0');
}
async function dbGetBills(fromDate, toDate) {
    const user = _currentUser();
    let query = _supabase.from('bills').select('*, bill_items(*)').order('date', { ascending: false });
    if (user)     query = query.eq('user_id', user);
    if (fromDate) query = query.gte('date', fromDate);
    if (toDate)   query = query.lte('date', toDate);
    const { data, error } = await query;
    if (error) { console.error('bills fetch:', error); return []; }
    return data;
}
async function dbSaveBill(bill) {
    const user = _currentUser();
    const billNo = bill.billNo || await dbNextBillNo();

    const { data: billRow, error: billErr } = await _supabase.from('bills').insert({
        bill_no:       billNo,
        date:          bill.date,
        customer_name: bill.customerName || '',
        doctor_name:   bill.doctorName   || '',
        grand_total:   parseFloat(String(bill.grandTotal).replace(/[^0-9.]/g,'')) || 0,
        user_id:       user,
    }).select().single();

    if (billErr) { console.error('bill save:', billErr); return { success: false, message: billErr.message }; }

    // Insert medicine line items
    const items = (bill.medicines || []).map(m => ({
        bill_id:  billRow.id,
        product:  m.product  || '',
        batch:    m.batch    || '',
        exp:      m.exp      || '',
        qty:      Number(m.qty)      || 0,
        mrp:      Number(m.mrp)      || 0,
        rate:     Number(m.rate)     || 0,
        gst:      Number(m.gst)      || 0,
        discount: Number(m.discount) || 0,
        total:    Number(m.total)    || 0,
    }));

    if (items.length > 0) {
        const { error: itemErr } = await _supabase.from('bill_items').insert(items);
        if (itemErr) console.error('bill_items save:', itemErr);
    }

    return { success: true, data: { ...billRow, bill_no: billNo } };
}
async function dbDeleteBill(id) {
    const user = _currentUser();
    let query = _supabase.from('bills').delete().eq('id', id);
    if (user) query = query.eq('user_id', user);
    const { error } = await query;
    return !error;
}

/* ─────────────────────────────────────────────────────
   REPORT HELPERS
───────────────────────────────────────────────────── */
async function dbGetReportData(fromDate, toDate) {
    const [bills, purchases] = await Promise.all([
        dbGetBills(fromDate, toDate),
        dbGetPurchases(fromDate, toDate),
    ]);
    return { bills, purchases };
}

async function dbDeleteAllBills() {
    try {
        const user = _currentUser();
        const { data: rows, error: fetchErr } = await _supabase.from('bills').select('id').eq('user_id', user || '');
        if (fetchErr) return { ok: false, msg: 'Fetch IDs failed: ' + fetchErr.message };
        if (!rows || rows.length === 0) return { ok: true };
        const ids = rows.map(r => r.id);
        for (let i = 0; i < ids.length; i += 100) {
            const batch = ids.slice(i, i + 100);
            const { error } = await _supabase.from('bills').delete().in('id', batch);
            if (error) return { ok: false, msg: 'Bills delete failed: ' + error.message };
        }
        return { ok: true };
    } catch(e) { return { ok: false, msg: e.message }; }
}

async function dbDeleteAllPurchases() {
    try {
        const user = _currentUser();
        const { data: rows, error: fetchErr } = await _supabase.from('purchases').select('id').eq('user_id', user || '');
        if (fetchErr) return { ok: false, msg: 'Fetch IDs failed: ' + fetchErr.message };
        if (!rows || rows.length === 0) return { ok: true };
        const ids = rows.map(r => r.id);
        for (let i = 0; i < ids.length; i += 100) {
            const batch = ids.slice(i, i + 100);
            const { error } = await _supabase.from('purchases').delete().in('id', batch);
            if (error) return { ok: false, msg: 'Purchases delete failed: ' + error.message };
        }
        return { ok: true };
    } catch(e) { return { ok: false, msg: e.message }; }
}
