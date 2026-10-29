/**
 * KAS MPI - Backend Google Apps Script
 * Sistem Keuangan Kelas Manajemen Pemasaran Internasional
 * 
 * DEPLOYMENT NOTES:
 * 1. Create a new Google Apps Script project bound to your Spreadsheet (or standalone).
 * 2. Paste this entire code into Code.gs
 * 3. Run initializeSpreadsheet() once from the editor (authorize when prompted).
 * 4. Deploy as Web App:
 *    - Execute as: Me (your account)
 *    - Who has access: Anyone (or Anyone with Google account for better security)
 * 5. Copy the Web App URL and set it in frontend config (js/api.js).
 * 
 * SECURITY:
 * - All validation & authorization happen here.
 * - Frontend must never hold secrets.
 * - For production, prefer "Anyone with Google account" + session tokens or OAuth.
 * - Current implementation uses simple role-based checks via user identity passed from client
 *   (NOT cryptographically secure identity). Mark as DEMO until proper auth is added.
 */

// ==================== CONFIG ====================
const SPREADSHEET_ID = ''; // Leave empty if script is bound to the spreadsheet. Otherwise paste ID.
const TIMEZONE = 'Asia/Makassar';
const APP_VERSION = '1.0.0-demo';

// Allowed values
const CASH_TYPES = ['HIMPI', 'USAHA_KELAS'];
const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'];
const ROLES = ['ADMIN', 'BENDAHARA_HIMPI', 'BENDAHARA_USAHA', 'ANGGOTA'];
const PAYMENT_METHODS = ['Tunai', 'Transfer Bank', 'E-Wallet', 'Lainnya'];

// Default categories
const DEFAULT_CATEGORIES = {
  HIMPI: {
    INCOME: ['Iuran Anggota', 'Sumbangan', 'Dana Kegiatan', 'Dana Rapat', 'Lainnya'],
    EXPENSE: ['Pembelian Perlengkapan', 'Biaya Operasional', 'Biaya Rapat', 'Lainnya']
  },
  USAHA_KELAS: {
    INCOME: ['Modal Awal', 'Tambahan Modal', 'Penjualan Produk', 'Pengembalian Dana', 'Lainnya'],
    EXPENSE: ['Pembelian Bahan/Stok', 'Biaya Operasional', 'Biaya Transportasi', 'Lainnya']
  }
};

// ==================== HELPERS ====================
function getSpreadsheet() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error('Sheet tidak ditemukan: ' + name);
  }
  return sheet;
}

function nowISO() {
  return Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

function generateId(prefix) {
  const ts = Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return prefix + '-' + ts + '-' + rand;
}

function jsonResponse(success, message, data, requestId) {
  const payload = {
    success: !!success,
    message: message || '',
    data: data !== undefined ? data : null,
    request_id: requestId || null,
    timestamp: nowISO(),
    version: APP_VERSION
  };
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return {};
  }
}

function getParam(e, key, fallback) {
  if (e && e.parameter && e.parameter[key] !== undefined) {
    return e.parameter[key];
  }
  return fallback;
}

// ==================== INITIALIZATION ====================
/**
 * Run this once from the Apps Script editor to create sheets and seed data.
 * It will NOT delete existing data.
 */
function initializeSpreadsheet() {
  const ss = getSpreadsheet();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    // --- Transaksi ---
    let sheet = ss.getSheetByName('Transaksi');
    if (!sheet) {
      sheet = ss.insertSheet('Transaksi');
      const headers = [
        'transaction_id', 'created_at', 'transaction_date', 'cash_type',
        'transaction_type', 'category', 'amount', 'person_name',
        'payment_method', 'description', 'created_by', 'status', 'updated_at',
        'idempotency_key'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange('A:N').setNumberFormat('@'); // text to avoid scientific notation
    }

    // --- Pengaturan ---
    sheet = ss.getSheetByName('Pengaturan');
    if (!sheet) {
      sheet = ss.insertSheet('Pengaturan');
      sheet.getRange(1, 1, 1, 4).setValues([['setting_key', 'setting_value', 'updated_at', 'updated_by']]);
      sheet.setFrozenRows(1);
      // Seed defaults
      const defaults = [
        ['saldo_awal_himpi', '0', nowISO(), 'SYSTEM'],
        ['saldo_awal_usaha', '0', nowISO(), 'SYSTEM'],
        ['nama_kelas', 'Manajemen Pemasaran Internasional', nowISO(), 'SYSTEM'],
        ['app_name', 'KAS MPI', nowISO(), 'SYSTEM'],
        ['categories_himpi_income', JSON.stringify(DEFAULT_CATEGORIES.HIMPI.INCOME), nowISO(), 'SYSTEM'],
        ['categories_himpi_expense', JSON.stringify(DEFAULT_CATEGORIES.HIMPI.EXPENSE), nowISO(), 'SYSTEM'],
        ['categories_usaha_income', JSON.stringify(DEFAULT_CATEGORIES.USAHA_KELAS.INCOME), nowISO(), 'SYSTEM'],
        ['categories_usaha_expense', JSON.stringify(DEFAULT_CATEGORIES.USAHA_KELAS.EXPENSE), nowISO(), 'SYSTEM']
      ];
      sheet.getRange(2, 1, defaults.length, 4).setValues(defaults);
    }

    // --- Pengguna ---
    sheet = ss.getSheetByName('Pengguna');
    if (!sheet) {
      sheet = ss.insertSheet('Pengguna');
      sheet.getRange(1, 1, 1, 6).setValues([['user_id', 'display_name', 'email', 'role', 'allowed_cash', 'active']]);
      sheet.setFrozenRows(1);
      // Seed demo users (NO passwords stored)
      const users = [
        ['USR-ADMIN', 'Admin Utama', 'admin@example.com', 'ADMIN', 'HIMPI,USAHA_KELAS', 'TRUE'],
        ['USR-BH', 'Bendahara HIMPI', 'bendahara.himpi@example.com', 'BENDAHARA_HIMPI', 'HIMPI', 'TRUE'],
        ['USR-BU', 'Bendahara Usaha', 'bendahara.usaha@example.com', 'BENDAHARA_USAHA', 'USAHA_KELAS', 'TRUE'],
        ['USR-ANG', 'Anggota Kelas', 'anggota@example.com', 'ANGGOTA', 'HIMPI,USAHA_KELAS', 'TRUE']
      ];
      sheet.getRange(2, 1, users.length, 6).setValues(users);
    }

    // --- Audit_Log ---
    sheet = ss.getSheetByName('Audit_Log');
    if (!sheet) {
      sheet = ss.insertSheet('Audit_Log');
      sheet.getRange(1, 1, 1, 8).setValues([[
        'log_id', 'timestamp', 'user_id', 'action',
        'transaction_id', 'old_value', 'new_value', 'reason'
      ]]);
      sheet.setFrozenRows(1);
    }

    // Optional summary sheet (formulas can be added later)
    sheet = ss.getSheetByName('Ringkasan');
    if (!sheet) {
      sheet = ss.insertSheet('Ringkasan');
      sheet.getRange('A1').setValue('Sheet ini dapat diisi formula ringkasan. Data sumber ada di sheet Transaksi.');
    }

    return { success: true, message: 'Inisialisasi selesai. Sheet dan data default sudah siap.' };
  } finally {
    lock.releaseLock();
  }
}

// ==================== AUTH (DEMO LEVEL) ====================
/**
 * IMPORTANT: This is DEMO authentication.
 * Identity is taken from the client payload (user_id / email).
 * It is NOT cryptographically verified.
 * Do NOT use for real money until you implement proper Google OAuth / Session tokens.
 */
function authorizeUser(identity, action, cashType) {
  if (!identity || !identity.user_id) {
    return { allowed: false, reason: 'Identitas pengguna tidak ditemukan.' };
  }

  const sheet = getSheet('Pengguna');
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { allowed: false, reason: 'Data pengguna kosong.' };
  }

  const headers = data[0];
  const idx = {
    user_id: headers.indexOf('user_id'),
    role: headers.indexOf('role'),
    allowed_cash: headers.indexOf('allowed_cash'),
    active: headers.indexOf('active'),
    display_name: headers.indexOf('display_name')
  };

  let user = null;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.user_id]) === String(identity.user_id)) {
      user = {
        user_id: data[i][idx.user_id],
        role: data[i][idx.role],
        allowed_cash: String(data[i][idx.allowed_cash] || '').split(',').map(s => s.trim()),
        active: String(data[i][idx.active]).toUpperCase() === 'TRUE',
        display_name: data[i][idx.display_name]
      };
      break;
    }
  }

  if (!user) {
    return { allowed: false, reason: 'Pengguna tidak terdaftar.' };
  }
  if (!user.active) {
    return { allowed: false, reason: 'Akun tidak aktif.' };
  }

  // Role checks
  const role = user.role;
  const isAdmin = role === 'ADMIN';
  const isBendaharaHimpi = role === 'BENDAHARA_HIMPI';
  const isBendaharaUsaha = role === 'BENDAHARA_USAHA';
  const isAnggota = role === 'ANGGOTA';

  // Read actions are generally allowed for active users
  const readActions = ['getDashboard', 'getTransactions', 'getTransactionById', 'getReport', 'getSettings', 'getCategories'];
  if (readActions.indexOf(action) !== -1) {
    return { allowed: true, user: user };
  }

  // Write / sensitive actions
  if (action === 'createTransaction') {
    if (isAdmin) return { allowed: true, user: user };
    if (cashType === 'HIMPI' && (isBendaharaHimpi || user.allowed_cash.indexOf('HIMPI') !== -1)) {
      return { allowed: true, user: user };
    }
    if (cashType === 'USAHA_KELAS' && (isBendaharaUsaha || user.allowed_cash.indexOf('USAHA_KELAS') !== -1)) {
      return { allowed: true, user: user };
    }
    return { allowed: false, reason: 'Anda tidak berwenang mencatat transaksi pada kas ini.' };
  }

  if (action === 'updateSettings' || action === 'manageUsers' || action === 'setOpeningBalance') {
    if (isAdmin) return { allowed: true, user: user };
    return { allowed: false, reason: 'Hanya Admin yang dapat mengubah pengaturan.' };
  }

  return { allowed: false, reason: 'Aksi tidak diizinkan.' };
}

// ==================== AUDIT ====================
function writeAuditLog(data) {
  try {
    const sheet = getSheet('Audit_Log');
    const logId = generateId('LOG');
    sheet.appendRow([
      logId,
      nowISO(),
      data.user_id || '',
      data.action || '',
      data.transaction_id || '',
      data.old_value ? JSON.stringify(data.old_value) : '',
      data.new_value ? JSON.stringify(data.new_value) : '',
      data.reason || ''
    ]);
    return logId;
  } catch (err) {
    // Fail silently for audit to not block main operation, but log internally
    console.error('Audit log failed: ' + err.message);
    return null;
  }
}

// ==================== SETTINGS ====================
function getSetting(key, defaultValue) {
  const sheet = getSheet('Pengaturan');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      return data[i][1];
    }
  }
  return defaultValue;
}

function setSetting(key, value, userId) {
  const sheet = getSheet('Pengaturan');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(String(value));
      sheet.getRange(i + 1, 3).setValue(nowISO());
      sheet.getRange(i + 1, 4).setValue(userId || 'SYSTEM');
      return;
    }
  }
  // New key
  sheet.appendRow([key, String(value), nowISO(), userId || 'SYSTEM']);
}

function getAllSettings() {
  const sheet = getSheet('Pengaturan');
  const data = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < data.length; i++) {
    result[data[i][0]] = data[i][1];
  }
  return result;
}

// ==================== TRANSACTIONS ====================
function getAllTransactions() {
  const sheet = getSheet('Transaksi');
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = data[i][idx];
    });
    // Normalize
    row.amount = parseFloat(row.amount) || 0;
    rows.push(row);
  }
  return rows;
}

function findTransactionById(id) {
  const all = getAllTransactions();
  return all.find(t => t.transaction_id === id) || null;
}

function findByIdempotencyKey(key) {
  if (!key) return null;
  const all = getAllTransactions();
  return all.find(t => t.idempotency_key === key) || null;
}

function validateTransactionPayload(payload) {
  const errors = [];

  if (!payload.cash_type || CASH_TYPES.indexOf(payload.cash_type) === -1) {
    errors.push('Jenis kas tidak valid. Harus HIMPI atau USAHA_KELAS.');
  }
  if (!payload.transaction_type || TRANSACTION_TYPES.indexOf(payload.transaction_type) === -1) {
    errors.push('Jenis transaksi tidak valid. Harus INCOME atau EXPENSE.');
  }
  if (!payload.category || String(payload.category).trim() === '') {
    errors.push('Kategori wajib diisi.');
  }
  const amount = parseFloat(payload.amount);
  if (isNaN(amount) || amount <= 0) {
    errors.push('Nominal harus angka positif.');
  }
  if (!payload.transaction_date || !/^\d{4}-\d{2}-\d{2}$/.test(payload.transaction_date)) {
    errors.push('Tanggal transaksi tidak valid (format YYYY-MM-DD).');
  }
  if (!payload.payment_method || PAYMENT_METHODS.indexOf(payload.payment_method) === -1) {
    // Allow custom but prefer known
    if (!payload.payment_method || String(payload.payment_method).trim() === '') {
      errors.push('Metode pembayaran wajib diisi.');
    }
  }

  // Category whitelist (soft check using defaults + settings)
  // For strictness we can load from settings; for now use defaults
  const cats = DEFAULT_CATEGORIES[payload.cash_type];
  if (cats) {
    const allowed = cats[payload.transaction_type] || [];
    // Allow "Lainnya" always
    if (allowed.length && allowed.indexOf(payload.category) === -1 && payload.category !== 'Lainnya') {
      // Soft warning only – still allow for flexibility
    }
  }

  return errors;
}

function createTransaction(payload, identity) {
  const auth = authorizeUser(identity, 'createTransaction', payload.cash_type);
  if (!auth.allowed) {
    return { success: false, message: auth.reason };
  }

  const errors = validateTransactionPayload(payload);
  if (errors.length) {
    return { success: false, message: errors.join(' ') };
  }

  // Idempotency
  if (payload.idempotency_key) {
    const existing = findByIdempotencyKey(payload.idempotency_key);
    if (existing) {
      return {
        success: true,
        message: 'Transaksi sudah pernah disimpan (idempotent).',
        data: existing,
        duplicate: true
      };
    }
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const sheet = getSheet('Transaksi');
    const txId = generateId('TX');
    const createdAt = nowISO();
    const amount = parseFloat(payload.amount);

    const row = [
      txId,
      createdAt,
      payload.transaction_date,
      payload.cash_type,
      payload.transaction_type,
      String(payload.category).trim(),
      amount,
      payload.person_name ? String(payload.person_name).trim() : '',
      payload.payment_method || 'Tunai',
      payload.description ? String(payload.description).trim() : '',
      auth.user.user_id,
      'ACTIVE',
      createdAt,
      payload.idempotency_key || ''
    ];

    sheet.appendRow(row);

    writeAuditLog({
      user_id: auth.user.user_id,
      action: 'CREATE_TRANSACTION',
      transaction_id: txId,
      new_value: {
        cash_type: payload.cash_type,
        transaction_type: payload.transaction_type,
        category: payload.category,
        amount: amount
      },
      reason: 'Transaksi baru'
    });

    const saved = {
      transaction_id: txId,
      created_at: createdAt,
      transaction_date: payload.transaction_date,
      cash_type: payload.cash_type,
      transaction_type: payload.transaction_type,
      category: payload.category,
      amount: amount,
      person_name: payload.person_name || '',
      payment_method: payload.payment_method || 'Tunai',
      description: payload.description || '',
      created_by: auth.user.user_id,
      status: 'ACTIVE',
      updated_at: createdAt
    };

    return { success: true, message: 'Transaksi berhasil disimpan.', data: saved };
  } finally {
    lock.releaseLock();
  }
}

// ==================== DASHBOARD & REPORTS ====================
function calculateBalances(transactions) {
  let himpiIncome = 0, himpiExpense = 0;
  let usahaIncome = 0, usahaExpense = 0;
  let usahaModal = 0, usahaPenjualan = 0, usahaBiaya = 0;

  transactions.forEach(t => {
    if (t.status !== 'ACTIVE') return;
    const amt = parseFloat(t.amount) || 0;
    if (t.cash_type === 'HIMPI') {
      if (t.transaction_type === 'INCOME') himpiIncome += amt;
      else himpiExpense += amt;
    } else if (t.cash_type === 'USAHA_KELAS') {
      if (t.transaction_type === 'INCOME') {
        usahaIncome += amt;
        if (t.category === 'Modal Awal' || t.category === 'Tambahan Modal') {
          usahaModal += amt;
        } else if (t.category === 'Penjualan Produk') {
          usahaPenjualan += amt;
        }
      } else {
        usahaExpense += amt;
        usahaBiaya += amt;
      }
    }
  });

  const saldoAwalHimpi = parseFloat(getSetting('saldo_awal_himpi', '0')) || 0;
  const saldoAwalUsaha = parseFloat(getSetting('saldo_awal_usaha', '0')) || 0;

  const saldoHimpi = saldoAwalHimpi + himpiIncome - himpiExpense;
  const saldoUsaha = saldoAwalUsaha + usahaIncome - usahaExpense;

  // Estimasi laba sederhana (hanya jika ada penjualan)
  // Laba ≈ Penjualan - Biaya (tanpa HPP detail)
  const estimasiLaba = usahaPenjualan > 0 ? (usahaPenjualan - usahaBiaya) : null;

  return {
    himpi: {
      saldo_awal: saldoAwalHimpi,
      total_pemasukan: himpiIncome,
      total_pengeluaran: himpiExpense,
      saldo: saldoHimpi
    },
    usaha: {
      saldo_awal: saldoAwalUsaha,
      total_modal: usahaModal,
      total_omzet: usahaPenjualan,
      total_pengeluaran: usahaExpense,
      saldo: saldoUsaha,
      estimasi_laba: estimasiLaba
    },
    gabungan: {
      saldo: saldoHimpi + saldoUsaha
    }
  };
}

function getDashboardSummary(filters) {
  let transactions = getAllTransactions().filter(t => t.status === 'ACTIVE');

  // Optional month filter
  if (filters && filters.month) {
    // month format YYYY-MM
    transactions = transactions.filter(t => String(t.transaction_date).startsWith(filters.month));
  }

  const balances = calculateBalances(getAllTransactions().filter(t => t.status === 'ACTIVE'));

  // This month totals
  const now = new Date();
  const thisMonth = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM');
  const monthTx = getAllTransactions().filter(t =>
    t.status === 'ACTIVE' && String(t.transaction_date).startsWith(thisMonth)
  );

  let monthIncome = 0, monthExpense = 0;
  monthTx.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.transaction_type === 'INCOME') monthIncome += amt;
    else monthExpense += amt;
  });

  // Recent transactions (last 10)
  const recent = getAllTransactions()
    .filter(t => t.status === 'ACTIVE')
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 10);

  return {
    balances: balances,
    this_month: {
      pemasukan: monthIncome,
      pengeluaran: monthExpense,
      jumlah_transaksi: monthTx.length
    },
    total_transaksi: getAllTransactions().filter(t => t.status === 'ACTIVE').length,
    recent_transactions: recent,
    generated_at: nowISO()
  };
}

function getTransactions(filters) {
  let list = getAllTransactions().filter(t => t.status === 'ACTIVE');

  if (filters) {
    if (filters.cash_type && CASH_TYPES.indexOf(filters.cash_type) !== -1) {
      list = list.filter(t => t.cash_type === filters.cash_type);
    }
    if (filters.transaction_type && TRANSACTION_TYPES.indexOf(filters.transaction_type) !== -1) {
      list = list.filter(t => t.transaction_type === filters.transaction_type);
    }
    if (filters.category) {
      list = list.filter(t => t.category === filters.category);
    }
    if (filters.date_from) {
      list = list.filter(t => t.transaction_date >= filters.date_from);
    }
    if (filters.date_to) {
      list = list.filter(t => t.transaction_date <= filters.date_to);
    }
    if (filters.search) {
      const q = String(filters.search).toLowerCase();
      list = list.filter(t =>
        String(t.transaction_id).toLowerCase().includes(q) ||
        String(t.description || '').toLowerCase().includes(q) ||
        String(t.person_name || '').toLowerCase().includes(q) ||
        String(t.category || '').toLowerCase().includes(q)
      );
    }
  }

  // Sort by transaction_date desc, then created_at desc
  list.sort((a, b) => {
    const d = String(b.transaction_date).localeCompare(String(a.transaction_date));
    if (d !== 0) return d;
    return String(b.created_at).localeCompare(String(a.created_at));
  });

  // Pagination
  const page = parseInt(filters && filters.page) || 1;
  const limit = Math.min(parseInt(filters && filters.limit) || 50, 200);
  const total = list.length;
  const start = (page - 1) * limit;
  const paged = list.slice(start, start + limit);

  return {
    items: paged,
    pagination: {
      page: page,
      limit: limit,
      total: total,
      total_pages: Math.ceil(total / limit) || 1
    }
  };
}

function getCashReport(filters) {
  const cashType = filters && filters.cash_type;
  let list = getAllTransactions().filter(t => t.status === 'ACTIVE');

  if (cashType && CASH_TYPES.indexOf(cashType) !== -1) {
    list = list.filter(t => t.cash_type === cashType);
  }
  if (filters && filters.date_from) {
    list = list.filter(t => t.transaction_date >= filters.date_from);
  }
  if (filters && filters.date_to) {
    list = list.filter(t => t.transaction_date <= filters.date_to);
  }

  let income = 0, expense = 0;
  const byCategory = {};

  list.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.transaction_type === 'INCOME') {
      income += amt;
    } else {
      expense += amt;
    }
    const key = t.category || 'Lainnya';
    if (!byCategory[key]) byCategory[key] = { income: 0, expense: 0 };
    if (t.transaction_type === 'INCOME') byCategory[key].income += amt;
    else byCategory[key].expense += amt;
  });

  const balances = calculateBalances(
    getAllTransactions().filter(t => t.status === 'ACTIVE' && (!cashType || t.cash_type === cashType))
  );

  return {
    cash_type: cashType || 'ALL',
    date_from: filters && filters.date_from || null,
    date_to: filters && filters.date_to || null,
    total_pemasukan: income,
    total_pengeluaran: expense,
    saldo_akhir: cashType === 'HIMPI' ? balances.himpi.saldo :
                 cashType === 'USAHA_KELAS' ? balances.usaha.saldo :
                 balances.gabungan.saldo,
    by_category: byCategory,
    transaction_count: list.length,
    balances: balances,
    generated_at: nowISO()
  };
}

// ==================== USERS (read-only for now) ====================
function getUsers(identity) {
  const auth = authorizeUser(identity, 'manageUsers');
  // Allow read for admin only in strict mode, but for demo allow any authenticated
  const sheet = getSheet('Pengguna');
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  const users = [];
  for (let i = 1; i < data.length; i++) {
    const u = {};
    headers.forEach((h, idx) => { u[h] = data[i][idx]; });
    // Never expose sensitive fields (none stored anyway)
    users.push(u);
  }
  return users;
}

// ==================== MAIN ENTRY POINTS ====================
function doGet(e) {
  const action = getParam(e, 'action', 'ping');
  const requestId = generateId('REQ');

  try {
    // Simple identity from query (DEMO ONLY)
    const identity = {
      user_id: getParam(e, 'user_id', ''),
      email: getParam(e, 'email', '')
    };

    if (action === 'ping') {
      return jsonResponse(true, 'KAS MPI Backend OK', {
        version: APP_VERSION,
        timezone: TIMEZONE,
        mode: 'DEMO'
      }, requestId);
    }

    if (action === 'getDashboard') {
      const auth = authorizeUser(identity, 'getDashboard');
      if (!auth.allowed) return jsonResponse(false, auth.reason, null, requestId);
      const summary = getDashboardSummary({ month: getParam(e, 'month') });
      return jsonResponse(true, 'OK', summary, requestId);
    }

    if (action === 'getTransactions') {
      const auth = authorizeUser(identity, 'getTransactions');
      if (!auth.allowed) return jsonResponse(false, auth.reason, null, requestId);
      const filters = {
        cash_type: getParam(e, 'cash_type'),
        transaction_type: getParam(e, 'transaction_type'),
        category: getParam(e, 'category'),
        date_from: getParam(e, 'date_from'),
        date_to: getParam(e, 'date_to'),
        search: getParam(e, 'search'),
        page: getParam(e, 'page', '1'),
        limit: getParam(e, 'limit', '50')
      };
      const result = getTransactions(filters);
      return jsonResponse(true, 'OK', result, requestId);
    }

    if (action === 'getTransactionById') {
      const auth = authorizeUser(identity, 'getTransactionById');
      if (!auth.allowed) return jsonResponse(false, auth.reason, null, requestId);
      const id = getParam(e, 'id');
      const tx = findTransactionById(id);
      if (!tx) return jsonResponse(false, 'Transaksi tidak ditemukan.', null, requestId);
      return jsonResponse(true, 'OK', tx, requestId);
    }

    if (action === 'getReport') {
      const auth = authorizeUser(identity, 'getReport');
      if (!auth.allowed) return jsonResponse(false, auth.reason, null, requestId);
      const filters = {
        cash_type: getParam(e, 'cash_type'),
        date_from: getParam(e, 'date_from'),
        date_to: getParam(e, 'date_to')
      };
      const report = getCashReport(filters);
      return jsonResponse(true, 'OK', report, requestId);
    }

    if (action === 'getSettings') {
      const auth = authorizeUser(identity, 'getSettings');
      if (!auth.allowed) return jsonResponse(false, auth.reason, null, requestId);
      return jsonResponse(true, 'OK', getAllSettings(), requestId);
    }

    if (action === 'getCategories') {
      return jsonResponse(true, 'OK', DEFAULT_CATEGORIES, requestId);
    }

    if (action === 'getUsers') {
      const auth = authorizeUser(identity, 'manageUsers');
      if (!auth.allowed) return jsonResponse(false, auth.reason, null, requestId);
      return jsonResponse(true, 'OK', getUsers(identity), requestId);
    }

    return jsonResponse(false, 'Aksi tidak dikenal: ' + action, null, requestId);
  } catch (err) {
    console.error(err);
    return jsonResponse(false, 'Terjadi kesalahan server. Silakan coba lagi.', null, requestId);
  }
}

function doPost(e) {
  const requestId = generateId('REQ');
  try {
    const body = parseBody(e);
    const action = body.action || getParam(e, 'action', '');
    const identity = body.identity || {
      user_id: body.user_id || '',
      email: body.email || ''
    };

    if (action === 'createTransaction') {
      const result = createTransaction(body.payload || body, identity);
      return jsonResponse(result.success, result.message, result.data, requestId);
    }

    if (action === 'setOpeningBalance') {
      const auth = authorizeUser(identity, 'setOpeningBalance');
      if (!auth.allowed) return jsonResponse(false, auth.reason, null, requestId);

      const cashType = body.cash_type;
      const amount = parseFloat(body.amount);
      if (CASH_TYPES.indexOf(cashType) === -1 || isNaN(amount) || amount < 0) {
        return jsonResponse(false, 'Data saldo awal tidak valid.', null, requestId);
      }
      const key = cashType === 'HIMPI' ? 'saldo_awal_himpi' : 'saldo_awal_usaha';
      const oldVal = getSetting(key, '0');
      setSetting(key, amount, auth.user.user_id);
      writeAuditLog({
        user_id: auth.user.user_id,
        action: 'SET_OPENING_BALANCE',
        old_value: { key: key, value: oldVal },
        new_value: { key: key, value: amount },
        reason: body.reason || 'Perubahan saldo awal'
      });
      return jsonResponse(true, 'Saldo awal berhasil diperbarui.', { key: key, value: amount }, requestId);
    }

    if (action === 'ping') {
      return jsonResponse(true, 'POST OK', { version: APP_VERSION }, requestId);
    }

    return jsonResponse(false, 'Aksi POST tidak dikenal: ' + action, null, requestId);
  } catch (err) {
    console.error(err);
    return jsonResponse(false, 'Terjadi kesalahan server. Silakan coba lagi.', null, requestId);
  }
}

// ==================== TEST HELPERS (run from editor) ====================
function testCreateSample() {
  const result = createTransaction({
    cash_type: 'HIMPI',
    transaction_type: 'INCOME',
    category: 'Iuran Anggota',
    amount: 50000,
    transaction_date: Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd'),
    person_name: 'Budi',
    payment_method: 'Tunai',
    description: 'Iuran bulan Oktober',
    idempotency_key: 'test-' + Date.now()
  }, { user_id: 'USR-ADMIN' });
  Logger.log(JSON.stringify(result));
}
