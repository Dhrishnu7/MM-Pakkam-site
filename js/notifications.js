/**
 * MM Pakkam — Notification Engine
 * Generates smart alerts for:
 *   • Medicines expiring within 90 days
 *   • Low / out-of-stock medicines (based on purchase quantities)
 * Stores read state in localStorage per user.
 */

const MMNotifications = (() => {

    const STORAGE_KEY = () => {
        try {
            const s = JSON.parse(localStorage.getItem('mm_session') || sessionStorage.getItem('mm_session') || 'null');
            return s ? `mm_notif_read_${s.tenant_id || s.username}` : 'mm_notif_read_anon';
        } catch { return 'mm_notif_read_anon'; }
    };

    function getReadIds() {
        try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY())) || []); }
        catch { return new Set(); }
    }

    function markRead(ids) {
        const existing = getReadIds();
        ids.forEach(id => existing.add(id));
        // Keep only last 500 to prevent bloat
        const arr = [...existing].slice(-500);
        localStorage.setItem(STORAGE_KEY(), JSON.stringify(arr));
    }

    function markAllRead(notifications) {
        markRead(notifications.map(n => n.id));
    }

    /**
     * Generate notifications from purchases data.
     * @param {Array} purchases - from dbGetPurchases()
     * @returns {Array} sorted notifications
     */
    function generate(purchases) {
        if (!purchases || !purchases.length) return [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const readIds = getReadIds();
        const notifications = [];

        // Group purchases by product_name to sum quantities
        const stockMap = {};
        purchases.forEach(p => {
            const name = (p.product_name || p.productName || '').trim();
            if (!name) return;
            if (!stockMap[name]) stockMap[name] = { qty: 0, batches: [] };
            const qty = Number(p.quantity || p.qty || 0);
            stockMap[name].qty += qty;
            if (p.expire_date || p.expireDate || p.exp) {
                stockMap[name].batches.push({
                    expiry: p.expire_date || p.expireDate || p.exp,
                    batch: p.batch_no || p.batchNo || p.batch || '—',
                    qty
                });
            }
        });

        Object.entries(stockMap).forEach(([name, info]) => {
            // ─── EXPIRY ALERTS ───
            info.batches.forEach(b => {
                if (!b.expiry) return;
                const expDate = new Date(b.expiry);
                if (isNaN(expDate)) return;
                expDate.setHours(0, 0, 0, 0);
                const daysLeft = Math.round((expDate - today) / (1000 * 60 * 60 * 24));

                if (daysLeft < 0) {
                    // Already expired
                    const id = `exp_${name}_${b.batch}_expired`;
                    notifications.push({
                        id,
                        type: 'expired',
                        priority: 1,
                        title: `${name} — EXPIRED`,
                        message: `Batch ${b.batch} expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago. Remove from stock immediately.`,
                        icon: '💀',
                        color: '#dc2626',
                        bg: '#fef2f2',
                        border: '#fca5a5',
                        daysLeft,
                        medicine: name,
                        isRead: readIds.has(id),
                        time: expDate.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
                    });
                } else if (daysLeft <= 30) {
                    const id = `exp_${name}_${b.batch}_30`;
                    notifications.push({
                        id,
                        type: 'expiring_soon',
                        priority: 2,
                        title: `${name} — Expiring Soon`,
                        message: `Batch ${b.batch} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${new Date(b.expiry).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}). Consider selling or returning to supplier.`,
                        icon: '🔴',
                        color: '#ea580c',
                        bg: '#fff7ed',
                        border: '#fed7aa',
                        daysLeft,
                        medicine: name,
                        isRead: readIds.has(id),
                        time: expDate.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
                    });
                } else if (daysLeft <= 90) {
                    const id = `exp_${name}_${b.batch}_90`;
                    notifications.push({
                        id,
                        type: 'expiring_notice',
                        priority: 3,
                        title: `${name} — Expiry Notice`,
                        message: `Batch ${b.batch} expires in ${daysLeft} days (${new Date(b.expiry).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}). Plan accordingly.`,
                        icon: '🟡',
                        color: '#ca8a04',
                        bg: '#fefce8',
                        border: '#fde68a',
                        daysLeft,
                        medicine: name,
                        isRead: readIds.has(id),
                        time: expDate.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
                    });
                }
            });

            // ─── STOCK ALERTS ───
            if (info.qty <= 0) {
                const id = `stock_${name}_out`;
                notifications.push({
                    id,
                    type: 'out_of_stock',
                    priority: 1,
                    title: `${name} — Out of Stock`,
                    message: `This medicine has 0 units left. Purchase more stock to avoid stockouts.`,
                    icon: '🚫',
                    color: '#dc2626',
                    bg: '#fef2f2',
                    border: '#fca5a5',
                    medicine: name,
                    isRead: readIds.has(id),
                    time: 'Stock update'
                });
            } else if (info.qty <= 10) {
                const id = `stock_${name}_low`;
                notifications.push({
                    id,
                    type: 'low_stock',
                    priority: 2,
                    title: `${name} — Low Stock`,
                    message: `Only ${info.qty} unit${info.qty !== 1 ? 's' : ''} remaining. Consider reordering soon.`,
                    icon: '⚠️',
                    color: '#d97706',
                    bg: '#fffbeb',
                    border: '#fde68a',
                    medicine: name,
                    isRead: readIds.has(id),
                    time: 'Stock update'
                });
            }
        });

        // Sort: priority ASC (1=critical first), then unread first
        notifications.sort((a, b) => {
            if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
            return a.priority - b.priority;
        });

        return notifications;
    }

    return { generate, markRead, markAllRead, getReadIds };
})();
