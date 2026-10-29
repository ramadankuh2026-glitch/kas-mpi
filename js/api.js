/**
 * KAS MPI – API Client
 * Semua komunikasi ke Google Apps Script Web App dilakukan di sini.
 */

const API_CONFIG = {
  // GANTI dengan URL Web App Google Apps Script Anda setelah deploy
  // Contoh: 'https://script.google.com/macros/s/AKfycbx.../exec'
  BASE_URL: '', // kosong = mode demo lokal
  TIMEOUT_MS: 25000
};

/**
 * Cek apakah backend sudah dikonfigurasi
 */
function isBackendConfigured() {
  return API_CONFIG.BASE_URL && API_CONFIG.BASE_URL.trim().length > 10;
}

/**
 * Request helper – GET
 */
async function apiGet(action, params = {}) {
  if (!isBackendConfigured()) {
    return demoHandler(action, params, 'GET');
  }

  const user = Auth.getCurrentUser();
  const query = new URLSearchParams({
    action,
    user_id: user ? user.user_id : '',
    email: user ? user.email : '',
    ...params
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);

  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}?${query.toString()}`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timer);
    const json = await res.json();
    return json;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { success: false, message: 'Koneksi timeout. Periksa jaringan Anda.' };
    }
    return { success: false, message: 'Gagal terhubung ke server. ' + (err.message || '') };
  }
}

/**
 * Request helper – POST
 */
async function apiPost(action, payload = {}) {
  if (!isBackendConfigured()) {
    return demoHandler(action, payload, 'POST');
  }

  const user = Auth.getCurrentUser();
  const body = {
    action,
    identity: user ? { user_id: user.user_id, email: user.email } : {},
    ...payload
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);

  try {
    const res = await fetch(API_CONFIG.BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS often needs text/plain for CORS
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timer);
    const json = await res.json();
    return json;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { success: false, message: 'Koneksi timeout. Periksa jaringan Anda.' };
    }
    return { success: false, message: 'Gagal terhubung ke server. ' + (err.message || '') };
  }
}

// ==================== PUBLIC API ====================

const API = {
  ping: () => apiGet('ping'),

  getDashboard: (month) => apiGet('getDashboard', month ? { month } : {}),

  getTransactions: (filters = {}) => apiGet('getTransactions', filters),

  getTransactionById: (id) => apiGet('getTransactionById', { id }),

  getReport: (filters = {}) => apiGet('getReport', filters),

  getSettings: () => apiGet('getSettings'),

  getCategories: () => apiGet('getCategories'),

  getUsers: () => apiGet('getUsers'),

  createTransaction: (payload) => apiPost('createTransaction', { payload }),

  setOpeningBalance: (cash_type, amount, reason) =>
    apiPost('setOpeningBalance', { cash_type, amount, reason })
};

// ==================== DEMO MODE (localStorage) ====================
const DEMO_STORAGE_KEY = 'kas_mpi_demo_data_v1';

function getDemoData() {
  const raw = localStorage.getItem(DEMO_STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }
  // Seed initial demo data
  const seed = {
    transactions: [],
    settings: {
      saldo_awal_himpi: '0',
      saldo_awal_usaha: '0',
      nama_kelas: 'Manajemen Pemasaran Internasional',
      app_name: 'KAS MPI'
    },
    users: [
      { user_id: 'USR-ADMIN', display_name: 'Admin Utama', email: 'admin@example.com', role: 'ADMIN', allowed_cash: 'HIMPI,USAHA_KELAS', active: 'TRUE' },
      { user_id: 'USR-BH', display_name: 'Bendahara HIMPI', email: 'bendahara.himpi@example.com', role: 'BENDAHARA_HIMPI', allowed_cash: 'HIMPI', active: 'TRUE' },
      { user_id: 'USR-BU', display_name: 'Bendahara Usaha', email: 'bendahara.usaha@example.com', role: 'BENDAHARA_USAHA', allowed_cash: 'USAHA_KELAS', active: 'TRUE' },
      { user_id: 'USR-ANG', display_name: 'Anggota Kelas', email: 'anggota@example.com', role: 'ANGGOTA', allowed_cash: 'HIMPI,USAHA_KELAS', active: 'TRUE' }
    ],
    audit: []
  };
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

function saveDemoData(data) {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
}

function demoGenerateId(prefix) {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${ts}-${rand}`;
}

function demoCalculateBalances(transactions, settings) {
  let himpiIncome = 0, himpiExpense = 0;
  let usahaIncome = 0, usahaExpense = 0;
  let usahaModal = 0, usahaPenjualan = 0, usahaBiaya = 0;

  transactions.filter(t => t.status === 'ACTIVE').forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.cash_type === 'HIMPI') {
      if (t.transaction_type === 'INCOME') himpiIncome += amt;
      else himpiExpense += amt;
    } else {
      if (t.transaction_type === 'INCOME') {
        usahaIncome += amt;
        if (t.category === 'Modal Awal' || t.category === 'Tambahan Modal') usahaModal += amt;
        else if (t.category === 'Penjualan Produk') usahaPenjualan += amt;
      } else {
        usahaExpense += amt;
        usahaBiaya += amt;
      }
    }
  });

  const saldoAwalHimpi = parseFloat(settings.saldo_awal_himpi || 0) || 0;
  const saldoAwalUsaha = parseFloat(settings.saldo_awal_usaha || 0) || 0;

  return {
    himpi: {
      saldo_awal: saldoAwalHimpi,
      total_pemasukan: himpiIncome,
      total_pengeluaran: himpiExpense,
      saldo: saldoAwalHimpi + himpiIncome - himpiExpense
    },
    usaha: {
      saldo_awal: saldoAwalUsaha,
      total_modal: usahaModal,
      total_omzet: usahaPenjualan,
      total_pengeluaran: usahaExpense,
      saldo: saldoAwalUsaha + usahaIncome - usahaExpense,
      estimasi_laba: usahaPenjualan > 0 ? usahaPenjualan - usahaBiaya : null
    },
    gabungan: {
      saldo: saldoAwalHimpi + himpiIncome - himpiExpense + saldoAwalUsaha + usahaIncome - usahaExpense
    }
  };
}

function demoHandler(action, params, method) {
  return new Promise((resolve) => {
    // Simulate network delay
    setTimeout(() => {
      const data = getDemoData();
      const user = Auth.getCurrentUser();

      try {
        if (action === 'ping') {
          resolve({
            success: true,
            message: 'KAS MPI Backend OK (DEMO LOCAL)',
            data: { version: '1.0.0-demo', timezone: 'Asia/Makassar', mode: 'DEMO_LOCAL' }
          });
          return;
        }

        if (action === 'getDashboard') {
          const balances = demoCalculateBalances(data.transactions, data.settings);
          const now = new Date();
          const thisMonth = now.toISOString().slice(0, 7);
          const monthTx = data.transactions.filter(t =>
            t.status === 'ACTIVE' && String(t.transaction_date).startsWith(thisMonth)
          );
          let monthIncome = 0, monthExpense = 0;
          monthTx.forEach(t => {
            const amt = parseFloat(t.amount) || 0;
            if (t.transaction_type === 'INCOME') monthIncome += amt;
            else monthExpense += amt;
          });
          const recent = [...data.transactions]
            .filter(t => t.status === 'ACTIVE')
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
            .slice(0, 10);

          resolve({
            success: true,
            message: 'OK',
            data: {
              balances,
              this_month: { pemasukan: monthIncome, pengeluaran: monthExpense, jumlah_transaksi: monthTx.length },
              total_transaksi: data.transactions.filter(t => t.status === 'ACTIVE').length,
              recent_transactions: recent,
              generated_at: new Date().toISOString()
            }
          });
          return;
        }

        if (action === 'getTransactions') {
          let list = data.transactions.filter(t => t.status === 'ACTIVE');
          if (params.cash_type) list = list.filter(t => t.cash_type === params.cash_type);
          if (params.transaction_type) list = list.filter(t => t.transaction_type === params.transaction_type);
          if (params.category) list = list.filter(t => t.category === params.category);
          if (params.date_from) list = list.filter(t => t.transaction_date >= params.date_from);
          if (params.date_to) list = list.filter(t => t.transaction_date <= params.date_to);
          if (params.search) {
            const q = String(params.search).toLowerCase();
            list = list.filter(t =>
              String(t.transaction_id).toLowerCase().includes(q) ||
              String(t.description || '').toLowerCase().includes(q) ||
              String(t.person_name || '').toLowerCase().includes(q) ||
              String(t.category || '').toLowerCase().includes(q)
            );
          }
          list.sort((a, b) => {
            const d = String(b.transaction_date).localeCompare(String(a.transaction_date));
            if (d !== 0) return d;
            return String(b.created_at).localeCompare(String(a.created_at));
          });
          const page = parseInt(params.page) || 1;
          const limit = Math.min(parseInt(params.limit) || 50, 200);
          const total = list.length;
          const start = (page - 1) * limit;
          resolve({
            success: true,
            message: 'OK',
            data: {
              items: list.slice(start, start + limit),
              pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 }
            }
          });
          return;
        }

        if (action === 'getTransactionById') {
          const tx = data.transactions.find(t => t.transaction_id === params.id);
          if (!tx) {
            resolve({ success: false, message: 'Transaksi tidak ditemukan.' });
            return;
          }
          resolve({ success: true, message: 'OK', data: tx });
          return;
        }

        if (action === 'getReport') {
          let list = data.transactions.filter(t => t.status === 'ACTIVE');
          if (params.cash_type) list = list.filter(t => t.cash_type === params.cash_type);
          if (params.date_from) list = list.filter(t => t.transaction_date >= params.date_from);
          if (params.date_to) list = list.filter(t => t.transaction_date <= params.date_to);
          let income = 0, expense = 0;
          const byCategory = {};
          list.forEach(t => {
            const amt = parseFloat(t.amount) || 0;
            if (t.transaction_type === 'INCOME') income += amt;
            else expense += amt;
            const key = t.category || 'Lainnya';
            if (!byCategory[key]) byCategory[key] = { income: 0, expense: 0 };
            if (t.transaction_type === 'INCOME') byCategory[key].income += amt;
            else byCategory[key].expense += amt;
          });
          const balances = demoCalculateBalances(
            data.transactions.filter(t => !params.cash_type || t.cash_type === params.cash_type),
            data.settings
          );
          resolve({
            success: true,
            message: 'OK',
            data: {
              cash_type: params.cash_type || 'ALL',
              date_from: params.date_from || null,
              date_to: params.date_to || null,
              total_pemasukan: income,
              total_pengeluaran: expense,
              saldo_akhir: params.cash_type === 'HIMPI' ? balances.himpi.saldo :
                           params.cash_type === 'USAHA_KELAS' ? balances.usaha.saldo :
                           balances.gabungan.saldo,
              by_category: byCategory,
              transaction_count: list.length,
              balances,
              generated_at: new Date().toISOString()
            }
          });
          return;
        }

        if (action === 'getSettings') {
          resolve({ success: true, message: 'OK', data: data.settings });
          return;
        }

        if (action === 'getCategories') {
          resolve({
            success: true,
            message: 'OK',
            data: {
              HIMPI: {
                INCOME: ['Iuran Anggota', 'Sumbangan', 'Dana Kegiatan', 'Dana Rapat', 'Lainnya'],
                EXPENSE: ['Pembelian Perlengkapan', 'Biaya Operasional', 'Biaya Rapat', 'Lainnya']
              },
              USAHA_KELAS: {
                INCOME: ['Modal Awal', 'Tambahan Modal', 'Penjualan Produk', 'Pengembalian Dana', 'Lainnya'],
                EXPENSE: ['Pembelian Bahan/Stok', 'Biaya Operasional', 'Biaya Transportasi', 'Lainnya']
              }
            }
          });
          return;
        }

        if (action === 'getUsers') {
          resolve({ success: true, message: 'OK', data: data.users });
          return;
        }

        if (action === 'createTransaction') {
          const p = params.payload || params;
          // Basic validation
          if (!p.cash_type || !['HIMPI', 'USAHA_KELAS'].includes(p.cash_type)) {
            resolve({ success: false, message: 'Jenis kas tidak valid.' });
            return;
          }
          if (!p.transaction_type || !['INCOME', 'EXPENSE'].includes(p.transaction_type)) {
            resolve({ success: false, message: 'Jenis transaksi tidak valid.' });
            return;
          }
          const amount = parseFloat(p.amount);
          if (isNaN(amount) || amount <= 0) {
            resolve({ success: false, message: 'Nominal harus angka positif.' });
            return;
          }
          if (!p.category || !p.transaction_date) {
            resolve({ success: false, message: 'Kategori dan tanggal wajib diisi.' });
            return;
          }

          // Role check (demo)
          if (user) {
            if (user.role === 'ANGGOTA') {
              resolve({ success: false, message: 'Anggota hanya dapat melihat data.' });
              return;
            }
            if (user.role === 'BENDAHARA_HIMPI' && p.cash_type !== 'HIMPI') {
              resolve({ success: false, message: 'Anda hanya berwenang pada Kas HIMPI.' });
              return;
            }
            if (user.role === 'BENDAHARA_USAHA' && p.cash_type !== 'USAHA_KELAS') {
              resolve({ success: false, message: 'Anda hanya berwenang pada Kas Usaha Kelas.' });
              return;
            }
          }

          // Idempotency
          if (p.idempotency_key) {
            const existing = data.transactions.find(t => t.idempotency_key === p.idempotency_key);
            if (existing) {
              resolve({ success: true, message: 'Transaksi sudah pernah disimpan (idempotent).', data: existing, duplicate: true });
              return;
            }
          }

          const now = new Date().toISOString();
          const tx = {
            transaction_id: demoGenerateId('TX'),
            created_at: now,
            transaction_date: p.transaction_date,
            cash_type: p.cash_type,
            transaction_type: p.transaction_type,
            category: p.category,
            amount: amount,
            person_name: p.person_name || '',
            payment_method: p.payment_method || 'Tunai',
            description: p.description || '',
            created_by: user ? user.user_id : 'DEMO',
            status: 'ACTIVE',
            updated_at: now,
            idempotency_key: p.idempotency_key || ''
          };
          data.transactions.push(tx);
          data.audit.push({
            log_id: demoGenerateId('LOG'),
            timestamp: now,
            user_id: user ? user.user_id : 'DEMO',
            action: 'CREATE_TRANSACTION',
            transaction_id: tx.transaction_id,
            new_value: { amount, category: p.category, cash_type: p.cash_type }
          });
          saveDemoData(data);
          resolve({ success: true, message: 'Transaksi berhasil disimpan (demo).', data: tx });
          return;
        }

        if (action === 'setOpeningBalance') {
          if (!user || user.role !== 'ADMIN') {
            resolve({ success: false, message: 'Hanya Admin yang dapat mengubah saldo awal.' });
            return;
          }
          const key = params.cash_type === 'HIMPI' ? 'saldo_awal_himpi' : 'saldo_awal_usaha';
          data.settings[key] = String(params.amount);
          saveDemoData(data);
          resolve({ success: true, message: 'Saldo awal diperbarui (demo).', data: { key, value: params.amount } });
          return;
        }

        resolve({ success: false, message: 'Aksi tidak dikenal (demo): ' + action });
      } catch (err) {
        resolve({ success: false, message: 'Error demo: ' + err.message });
      }
    }, 200 + Math.random() * 300);
  });
}
