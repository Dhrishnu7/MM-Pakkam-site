/**
 * supabase.js — Supabase Client for MM Pakkam
 * Plain HTML/JS — loaded via CDN (no build step needed)
 */

const SUPABASE_URL  = 'https://jwyyjdwlbgjijmwillow.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_sY9QwFEMckky9KDJoc1O_w_zN7qY0mo';

// Create and export a single shared client instance
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ─────────────────────────────────────────────────────
   CUSTOMERS
───────────────────────────────────────────────────── */
async function dbGetCustomers() {
    const { data, error } = await _supabase.from('customers').select('*').order('name');
    if (error) { console.error('customers fetch:', error); return []; }
    return data;
}
async function dbAddCustomer(name, phone, address) {
    const { data, error } = await _supabase.from('customers')
        .upsert({ name: name.trim(), phone: phone.trim(), address: address?.trim() || '' },
                 { onConflict: 'name,phone', ignoreDuplicates: true })
        .select();
    if (error) { console.error('customer add:', error); return { success: false, message: error.message }; }
    return { success: true, data: data?.[0] || null };
}
async function dbDeleteCustomer(id) {
    const { error } = await _supabase.from('customers').delete().eq('id', id);
    return !error;
}

/* ─────────────────────────────────────────────────────
   DOCTORS
───────────────────────────────────────────────────── */
async function dbGetDoctors() {
    const { data, error } = await _supabase.from('doctors').select('*').order('name');
    if (error) { console.error('doctors fetch:', error); return []; }
    return data;
}
async function dbAddDoctor(name, phone, clinic, address) {
    const { data, error } = await _supabase.from('doctors')
        .upsert({ name: name.trim(), phone: phone.trim(), clinic: clinic?.trim() || '', address: address?.trim() || '' },
                 { onConflict: 'name,phone', ignoreDuplicates: true })
        .select();
    if (error) { console.error('doctor add:', error); return { success: false, message: error.message }; }
    return { success: true, data: data?.[0] || null };
}
async function dbDeleteDoctor(id) {
    const { error } = await _supabase.from('doctors').delete().eq('id', id);
    return !error;
}

/* ─────────────────────────────────────────────────────
   MEDICINES  (catalogue)
───────────────────────────────────────────────────── */
async function dbGetMedicines() {
    const { data, error } = await _supabase.from('medicines').select('name').order('name');
    if (error) { console.error('medicines fetch:', error); return []; }
    return data.map(m => m.name);
}
async function dbImportMedicines(nameArray) {
    const rows = [...new Set(nameArray.map(n => n.trim()).filter(Boolean))].map(name => ({ name }));
    const { error } = await _supabase.from('medicines').upsert(rows, { onConflict: 'name', ignoreDuplicates: true });
    if (error) console.error('medicine import:', error);
    return !error;
}

/* ─────────────────────────────────────────────────────
   PURCHASES
───────────────────────────────────────────────────── */
async function dbGetPurchases(fromDate, toDate) {
    let query = _supabase.from('purchases').select('*').order('date', { ascending: false });
    if (fromDate) query = query.gte('date', fromDate);
    if (toDate)   query = query.lte('date', toDate);
    const { data, error } = await query;
    if (error) { console.error('purchases fetch:', error); return []; }
    return data;
}
async function dbAddPurchase(row) {
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
    }).select().single();
    if (error) { console.error('purchase add:', error); return { success: false, message: error.message }; }
    return { success: true, data };
}
async function dbDeletePurchase(id) {
    const { error } = await _supabase.from('purchases').delete().eq('id', id);
    return !error;
}

/* ─────────────────────────────────────────────────────
   BILLS  (sales)
───────────────────────────────────────────────────── */
async function dbNextBillNo() {
    // Calls the SQL function we created
    const { data, error } = await _supabase.rpc('next_bill_no');
    if (error) {
        // Fallback: count existing bills
        const { count } = await _supabase.from('bills').select('*', { count: 'exact', head: true });
        return 'MM-' + String((count || 0) + 1).padStart(3, '0');
    }
    return data;
}
async function dbGetBills(fromDate, toDate) {
    let query = _supabase.from('bills').select('*, bill_items(*)').order('date', { ascending: false });
    if (fromDate) query = query.gte('date', fromDate);
    if (toDate)   query = query.lte('date', toDate);
    const { data, error } = await query;
    if (error) { console.error('bills fetch:', error); return []; }
    return data;
}
async function dbSaveBill(bill) {
    // bill = { billNo, date, customerName, doctorName, medicines[], grandTotal }
    const billNo = bill.billNo || await dbNextBillNo();

    const { data: billRow, error: billErr } = await _supabase.from('bills').insert({
        bill_no:       billNo,
        date:          bill.date,
        customer_name: bill.customerName || '',
        doctor_name:   bill.doctorName   || '',
        grand_total:   parseFloat(String(bill.grandTotal).replace(/[^0-9.]/g,'')) || 0,
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
    // bill_items are deleted automatically via ON DELETE CASCADE
    const { error } = await _supabase.from('bills').delete().eq('id', id);
    return !error;
}
async function dbDeleteAllBills() {
    // Delete all rows by matching id >= 0 (all positive integer IDs)
    const { error } = await _supabase.from('bills').delete().gte('id', 0);
    if (error) { console.error('deleteAllBills:', error); return false; }
    return true;
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

async function dbDeleteAllPurchases() {
    const { error } = await _supabase.from('purchases').delete().gte('id', 0);
    if (error) { console.error('deleteAllPurchases:', error); return false; }
    return true;
}
