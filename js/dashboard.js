/**
 * KAS MPI – Dashboard Page Logic
 */

const Dashboard = {
  async init() {
    if (!Auth.requireAuth()) return;
    App.setActiveNav('dashboard');
    App.checkBackendStatus();
    await this.load();
  },

  async load() {
    App.showLoading('dashboardContent');
    const res = await API.getDashboard();
    const container = document.getElementById('dashboardContent');

    if (!res.success) {
      container.innerHTML = `<div class="alert alert-error">${App.escapeHtml(res.message || 'Gagal memuat dashboard.')}</div>`;
      return;
    }

    const d = res.data;
    const b = d.balances;

    container.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card primary">
          <div class="label">Total Saldo Gabungan</div>
          <div class="value">${App.formatRp(b.gabungan.saldo)}</div>
          <div class="sub">HIMPI + Usaha Kelas</div>
        </div>
        <div class="stat-card">
          <div class="label">Saldo Kas HIMPI</div>
          <div class="value">${App.formatRp(b.himpi.saldo)}</div>
          <div class="sub">Awal: ${App.formatRp(b.himpi.saldo_awal)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Saldo Kas Usaha</div>
          <div class="value">${App.formatRp(b.usaha.saldo)}</div>
          <div class="sub">Modal: ${App.formatRp(b.usaha.total_modal)} · Omzet: ${App.formatRp(b.usaha.total_omzet)}</div>
        </div>
        <div class="stat-card income">
          <div class="label">Pemasukan Bulan Ini</div>
          <div class="value">${App.formatRp(d.this_month.pemasukan)}</div>
          <div class="sub">${d.this_month.jumlah_transaksi} transaksi bulan ini</div>
        </div>
        <div class="stat-card expense">
          <div class="label">Pengeluaran Bulan Ini</div>
          <div class="value">${App.formatRp(d.this_month.pengeluaran)}</div>
          <div class="sub">Total transaksi: ${d.total_transaksi}</div>
        </div>
        ${b.usaha.estimasi_laba !== null ? `
        <div class="stat-card">
          <div class="label">Estimasi Laba Usaha*</div>
          <div class="value ${b.usaha.estimasi_laba >= 0 ? 'text-green' : 'text-red'}">${App.formatRp(b.usaha.estimasi_laba)}</div>
          <div class="sub">*Omzet − biaya (tanpa HPP detail)</div>
        </div>` : ''}
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Transaksi Terbaru</h3>
          <a href="transactions.html" class="btn btn-sm btn-secondary">Lihat Semua</a>
        </div>
        <div class="card-body" style="padding:0">
          ${this.renderRecentTable(d.recent_transactions)}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Ringkasan Kas</h3>
        </div>
        <div class="card-body">
          <div class="form-row">
            <div>
              <strong>Kas HIMPI</strong>
              <p class="text-muted mt-1">Pemasukan: ${App.formatRp(b.himpi.total_pemasukan)}</p>
              <p class="text-muted">Pengeluaran: ${App.formatRp(b.himpi.total_pengeluaran)}</p>
            </div>
            <div>
              <strong>Kas Usaha Kelas</strong>
              <p class="text-muted mt-1">Pemasukan: ${App.formatRp(b.usaha.total_omzet + b.usaha.total_modal)}</p>
              <p class="text-muted">Pengeluaran: ${App.formatRp(b.usaha.total_pengeluaran)}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderRecentTable(items) {
    if (!items || !items.length) {
      return App.emptyState('Belum ada transaksi', 'Tambah transaksi pertama dari menu Kas HIMPI atau Kas Usaha.');
    }
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
  }
};

document.addEventListener('DOMContentLoaded', () => Dashboard.init());
