/**
 * KAS MPI – Reports Page Logic
 */

const Reports = {
  async init() {
    if (!Auth.requireAuth()) return;
    App.setActiveNav('reports');
    App.checkBackendStatus();
    this.bindEvents();
    // Default: current month
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fromEl = document.getElementById('reportDateFrom');
    const toEl = document.getElementById('reportDateTo');
    if (fromEl) fromEl.value = first.toISOString().slice(0, 10);
    if (toEl) toEl.value = last.toISOString().slice(0, 10);
  },

  bindEvents() {
    const btn = document.getElementById('btnGenerateReport');
    if (btn) btn.addEventListener('click', () => this.generate());

    const exportBtn = document.getElementById('btnExportCSV');
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportCSV());
  },

  async generate() {
    const container = document.getElementById('reportResult');
    App.showLoading('reportResult');

    const filters = {
      cash_type: document.getElementById('reportCashType')?.value || '',
      date_from: document.getElementById('reportDateFrom')?.value || '',
      date_to: document.getElementById('reportDateTo')?.value || ''
    };

    const res = await API.getReport(filters);
    if (!res.success) {
      container.innerHTML = `<div class="alert alert-error">${App.escapeHtml(res.message)}</div>`;
      return;
    }

    const r = res.data;
    this.lastReport = r;
    this.lastFilters = filters;

    // Also fetch transactions for the period for detailed list / export
    const txRes = await API.getTransactions({
      ...filters,
      limit: 200,
      page: 1
    });
    this.lastTransactions = (txRes.success && txRes.data.items) || [];

    const catRows = Object.entries(r.by_category || {}).map(([cat, v]) => `
      <tr>
        <td>${App.escapeHtml(cat)}</td>
        <td class="text-right text-green">${App.formatRp(v.income)}</td>
        <td class="text-right text-red">${App.formatRp(v.expense)}</td>
        <td class="text-right">${App.formatRp(v.income - v.expense)}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card income">
          <div class="label">Total Pemasukan</div>
          <div class="value">${App.formatRp(r.total_pemasukan)}</div>
        </div>
        <div class="stat-card expense">
          <div class="label">Total Pengeluaran</div>
          <div class="value">${App.formatRp(r.total_pengeluaran)}</div>
        </div>
        <div class="stat-card primary">
          <div class="label">Saldo Akhir (periode)</div>
          <div class="value">${App.formatRp(r.saldo_akhir)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Jumlah Transaksi</div>
          <div class="value">${r.transaction_count}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Rekap per Kategori</h3>
        </div>
        <div class="card-body" style="padding:0">
          ${catRows ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th class="text-right">Pemasukan</th>
                  <th class="text-right">Pengeluaran</th>
                  <th class="text-right">Net</th>
                </tr>
              </thead>
              <tbody>${catRows}</tbody>
            </table>
          </div>
          ` : App.emptyState('Tidak ada data', 'Tidak ada transaksi pada periode ini.')}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Detail Transaksi Periode</h3>
          <button class="btn btn-sm btn-secondary" id="btnExportCSV2">Ekspor CSV</button>
        </div>
        <div class="card-body" style="padding:0">
          ${this.renderTxTable(this.lastTransactions)}
        </div>
      </div>

      <p class="text-muted mt-2" style="font-size:0.8125rem">
        Laporan digenerate: ${App.formatDateTime(r.generated_at)} · 
        Filter: ${r.cash_type === 'ALL' ? 'Semua Kas' : App.cashLabel(r.cash_type)} · 
        ${r.date_from || '–'} s/d ${r.date_to || '–'}
      </p>
    `;

    const exp2 = document.getElementById('btnExportCSV2');
    if (exp2) exp2.addEventListener('click', () => this.exportCSV());
  },

  renderTxTable(items) {
    if (!items.length) return App.emptyState('Tidak ada transaksi');
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Kas</th>
              <th>Jenis</th>
              <th>Kategori</th>
              <th class="text-right">Nominal</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(t => `
              <tr>
                <td>${App.formatDate(t.transaction_date)}</td>
                <td><span class="badge ${t.cash_type === 'HIMPI' ? 'badge-himpi' : 'badge-usaha'}">${t.cash_type === 'HIMPI' ? 'HIMPI' : 'Usaha'}</span></td>
                <td><span class="badge ${t.transaction_type === 'INCOME' ? 'badge-income' : 'badge-expense'}">${App.typeLabel(t.transaction_type)}</span></td>
                <td>${App.escapeHtml(t.category)}</td>
                <td class="text-right ${t.transaction_type === 'INCOME' ? 'text-green' : 'text-red'}">${t.transaction_type === 'INCOME' ? '+' : '−'}${App.formatRp(t.amount)}</td>
                <td class="text-muted">${App.escapeHtml(t.description || '–')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  exportCSV() {
    if (!this.lastTransactions || !this.lastTransactions.length) {
      App.toast('Generate laporan terlebih dahulu.', 'warning');
      return;
    }
    const rows = this.lastTransactions.map(t => ({
      transaction_id: t.transaction_id,
      tanggal: t.transaction_date,
      kas: t.cash_type,
      jenis: t.transaction_type,
      kategori: t.category,
      nominal: t.amount,
      orang: t.person_name,
      metode: t.payment_method,
      keterangan: t.description,
      dicatat_oleh: t.created_by,
      status: t.status
    }));
    const name = `kas-mpi-laporan-${this.lastFilters?.date_from || 'all'}-${this.lastFilters?.date_to || 'all'}.csv`;
    App.exportCSV(rows, name);
  }
};

document.addEventListener('DOMContentLoaded', () => Reports.init());
