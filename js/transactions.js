/**
 * KAS MPI – Transactions Page Logic (Riwayat, Kas HIMPI, Kas Usaha)
 */

const Transactions = {
  currentPage: 1,
  filters: {},
  categories: null,
  cashTypeFixed: null, // 'HIMPI' | 'USAHA_KELAS' | null (all)

  async init(options = {}) {
    if (!Auth.requireAuth()) return;
    this.cashTypeFixed = options.cashType || null;
    const pageName = options.pageName || 'transactions';
    App.setActiveNav(pageName);
    App.checkBackendStatus();

    // Load categories
    const catRes = await API.getCategories();
    if (catRes.success) this.categories = catRes.data;

    this.bindEvents();
    this.updateCategoryOptions();
    this.toggleAddButton();
    await this.loadSummary();
    await this.loadList();
  },

  bindEvents() {
    const filterBtn = document.getElementById('btnFilter');
    if (filterBtn) filterBtn.addEventListener('click', () => this.applyFilters());

    const searchInput = document.getElementById('filterSearch');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.applyFilters();
      });
    }

    const addBtn = document.getElementById('btnAddTransaction');
    if (addBtn) addBtn.addEventListener('click', () => this.openAddModal());

    const form = document.getElementById('formTransaction');
    if (form) form.addEventListener('submit', (e) => this.submitTransaction(e));

    // Dynamic category when cash_type or transaction_type changes
    ['txCashType', 'txType'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => this.updateCategoryOptions());
    });

    // Close modal
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        App.closeModal(btn.dataset.closeModal);
      });
    });
  },

  toggleAddButton() {
    const btn = document.getElementById('btnAddTransaction');
    if (!btn) return;
    if (Auth.isAnggota()) {
      btn.classList.add('hidden');
      return;
    }
    if (this.cashTypeFixed && !Auth.canCreate(this.cashTypeFixed)) {
      btn.classList.add('hidden');
    } else {
      btn.classList.remove('hidden');
    }
  },

  updateCategoryOptions() {
    const cashEl = document.getElementById('txCashType');
    const typeEl = document.getElementById('txType');
    const catEl = document.getElementById('txCategory');
    if (!catEl || !this.categories) return;

    const cash = cashEl ? cashEl.value : (this.cashTypeFixed || 'HIMPI');
    const type = typeEl ? typeEl.value : 'INCOME';
    const list = (this.categories[cash] && this.categories[cash][type]) || ['Lainnya'];

    catEl.innerHTML = list.map(c => `<option value="${c}">${c}</option>`).join('');
  },

  applyFilters() {
    this.filters = {
      cash_type: this.cashTypeFixed || document.getElementById('filterCashType')?.value || '',
      transaction_type: document.getElementById('filterType')?.value || '',
      category: document.getElementById('filterCategory')?.value || '',
      date_from: document.getElementById('filterDateFrom')?.value || '',
      date_to: document.getElementById('filterDateTo')?.value || '',
      search: document.getElementById('filterSearch')?.value || '',
      page: 1
    };
    this.currentPage = 1;
    this.loadList();
  },

  async loadSummary() {
    const el = document.getElementById('cashSummary');
    if (!el) return;

    const res = await API.getDashboard();
    if (!res.success) {
      el.innerHTML = '';
      return;
    }
    const b = res.data.balances;

    if (this.cashTypeFixed === 'HIMPI') {
      el.innerHTML = `
        <div class="stat-grid">
          <div class="stat-card"><div class="label">Saldo Awal</div><div class="value">${App.formatRp(b.himpi.saldo_awal)}</div></div>
          <div class="stat-card income"><div class="label">Total Pemasukan</div><div class="value">${App.formatRp(b.himpi.total_pemasukan)}</div></div>
          <div class="stat-card expense"><div class="label">Total Pengeluaran</div><div class="value">${App.formatRp(b.himpi.total_pengeluaran)}</div></div>
          <div class="stat-card primary"><div class="label">Saldo Saat Ini</div><div class="value">${App.formatRp(b.himpi.saldo)}</div></div>
        </div>
      `;
    } else if (this.cashTypeFixed === 'USAHA_KELAS') {
      el.innerHTML = `
        <div class="stat-grid">
          <div class="stat-card"><div class="label">Modal Disetorkan</div><div class="value">${App.formatRp(b.usaha.total_modal)}</div></div>
          <div class="stat-card income"><div class="label">Total Omzet</div><div class="value">${App.formatRp(b.usaha.total_omzet)}</div></div>
          <div class="stat-card expense"><div class="label">Total Pengeluaran</div><div class="value">${App.formatRp(b.usaha.total_pengeluaran)}</div></div>
          <div class="stat-card primary"><div class="label">Saldo Kas Usaha</div><div class="value">${App.formatRp(b.usaha.saldo)}</div></div>
          ${b.usaha.estimasi_laba !== null ? `
          <div class="stat-card"><div class="label">Estimasi Laba*</div><div class="value ${b.usaha.estimasi_laba >= 0 ? 'text-green' : 'text-red'}">${App.formatRp(b.usaha.estimasi_laba)}</div><div class="sub">*Tanpa HPP detail</div></div>
          ` : ''}
        </div>
      `;
    } else {
      el.innerHTML = '';
    }
  },

  async loadList() {
    const container = document.getElementById('transactionList');
    if (!container) return;
    App.showLoading('transactionList');

    const params = {
      ...this.filters,
      page: this.currentPage,
      limit: 20
    };
    if (this.cashTypeFixed) params.cash_type = this.cashTypeFixed;

    const res = await API.getTransactions(params);
    if (!res.success) {
      container.innerHTML = `<div class="alert alert-error">${App.escapeHtml(res.message)}</div>`;
      return;
    }

    const { items, pagination } = res.data;
    if (!items.length) {
      container.innerHTML = App.emptyState('Belum ada transaksi', 'Gunakan tombol Tambah Transaksi untuk mencatat.');
      this.renderPagination(pagination);
      return;
    }

    container.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tanggal</th>
              ${!this.cashTypeFixed ? '<th>Kas</th>' : ''}
              <th>Jenis</th>
              <th>Kategori</th>
              <th class="text-right">Nominal</th>
              <th>Orang</th>
              <th>Metode</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(t => `
              <tr>
                <td class="font-mono">${App.escapeHtml(t.transaction_id)}</td>
                <td>${App.formatDate(t.transaction_date)}</td>
                ${!this.cashTypeFixed ? `<td><span class="badge ${t.cash_type === 'HIMPI' ? 'badge-himpi' : 'badge-usaha'}">${t.cash_type === 'HIMPI' ? 'HIMPI' : 'Usaha'}</span></td>` : ''}
                <td><span class="badge ${t.transaction_type === 'INCOME' ? 'badge-income' : 'badge-expense'}">${App.typeLabel(t.transaction_type)}</span></td>
                <td>${App.escapeHtml(t.category)}</td>
                <td class="text-right ${t.transaction_type === 'INCOME' ? 'text-green' : 'text-red'} font-mono">
                  ${t.transaction_type === 'INCOME' ? '+' : '−'}${App.formatRp(t.amount)}
                </td>
                <td>${App.escapeHtml(t.person_name || '–')}</td>
                <td>${App.escapeHtml(t.payment_method || '–')}</td>
                <td class="text-muted">${App.escapeHtml(t.description || '–')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    this.renderPagination(pagination);
  },

  renderPagination(p) {
    const el = document.getElementById('pagination');
    if (!el || !p) return;
    if (p.total_pages <= 1) {
      el.innerHTML = `<span class="text-muted">Total ${p.total} transaksi</span>`;
      return;
    }
    let html = '';
    html += `<button ${p.page <= 1 ? 'disabled' : ''} data-page="${p.page - 1}">‹</button>`;
    for (let i = 1; i <= p.total_pages; i++) {
      if (i === 1 || i === p.total_pages || Math.abs(i - p.page) <= 1) {
        html += `<button class="${i === p.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
      } else if (Math.abs(i - p.page) === 2) {
        html += `<span>…</span>`;
      }
    }
    html += `<button ${p.page >= p.total_pages ? 'disabled' : ''} data-page="${p.page + 1}">›</button>`;
    el.innerHTML = html;
    el.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentPage = parseInt(btn.dataset.page);
        this.loadList();
      });
    });
  },

  openAddModal() {
    const form = document.getElementById('formTransaction');
    if (form) form.reset();

    // Pre-fill cash type if fixed
    const cashEl = document.getElementById('txCashType');
    if (cashEl) {
      if (this.cashTypeFixed) {
        cashEl.value = this.cashTypeFixed;
        cashEl.disabled = true;
      } else {
        cashEl.disabled = false;
        // Restrict options based on role
        if (!Auth.isAdmin()) {
          Array.from(cashEl.options).forEach(opt => {
            if (opt.value && !Auth.canCreate(opt.value)) opt.disabled = true;
          });
        }
      }
    }

    const dateEl = document.getElementById('txDate');
    if (dateEl) dateEl.value = App.today();

    this.updateCategoryOptions();
    document.getElementById('txIdempotency').value = App.idempotencyKey();
    App.openModal('modalTransaction');
  },

  async submitTransaction(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitTx');
    if (btn.disabled) return;

    const payload = {
      cash_type: document.getElementById('txCashType').value,
      transaction_type: document.getElementById('txType').value,
      category: document.getElementById('txCategory').value,
      amount: document.getElementById('txAmount').value,
      transaction_date: document.getElementById('txDate').value,
      person_name: document.getElementById('txPerson').value,
      payment_method: document.getElementById('txMethod').value,
      description: document.getElementById('txDesc').value,
      idempotency_key: document.getElementById('txIdempotency').value
    };

    // Client-side quick check
    if (!payload.cash_type || !payload.transaction_type || !payload.category || !payload.amount || !payload.transaction_date) {
      App.toast('Lengkapi semua kolom wajib.', 'error');
      return;
    }
    if (parseFloat(payload.amount) <= 0) {
      App.toast('Nominal harus lebih dari 0.', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    const res = await API.createTransaction(payload);

    btn.disabled = false;
    btn.textContent = 'Simpan Transaksi';

    if (res.success) {
      App.toast(res.message || 'Transaksi berhasil disimpan.', 'success');
      App.closeModal('modalTransaction');
      // New key for next time
      document.getElementById('txIdempotency').value = App.idempotencyKey();
      await this.loadSummary();
      await this.loadList();
    } else {
      App.toast(res.message || 'Gagal menyimpan transaksi.', 'error');
    }
  }
};
