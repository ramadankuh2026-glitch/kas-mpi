/**
 * KAS MPI – Shared App Utilities
 */

const App = {
  /**
   * Format number as Indonesian Rupiah
   */
  formatRp(amount) {
    const n = parseFloat(amount) || 0;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(n);
  },

  /**
   * Format date YYYY-MM-DD to readable Indonesian
   */
  formatDate(dateStr) {
    if (!dateStr) return '–';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  },

  formatDateTime(iso) {
    if (!iso) return '–';
    try {
      const d = new Date(iso);
      return d.toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Makassar'
      });
    } catch (e) {
      return iso;
    }
  },

  /**
   * Toast notification
   */
  toast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<div>${this.escapeHtml(message)}</div>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100%)';
      el.style.transition = 'all .3s';
      setTimeout(() => el.remove(), 300);
    }, 3500);
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Generate simple UUID-like idempotency key
   */
  idempotencyKey() {
    return 'idem-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  },

  /**
   * Today as YYYY-MM-DD (Asia/Makassar approx via local)
   */
  today() {
    const d = new Date();
    // Adjust roughly for WITA (UTC+8)
    const offset = 8 * 60;
    const local = new Date(d.getTime() + (offset + d.getTimezoneOffset()) * 60000);
    return local.toISOString().slice(0, 10);
  },

  /**
   * Sidebar mobile toggle
   */
  initSidebar() {
    const toggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (toggle && sidebar) {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('show');
      });
    }
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      });
    }
  },

  /**
   * Render user info in sidebar
   */
  renderUserInfo() {
    const user = Auth.getCurrentUser();
    if (!user) return;

    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');

    if (nameEl) nameEl.textContent = user.display_name;
    if (roleEl) roleEl.textContent = Auth.roleLabel(user.role);
    if (avatarEl) {
      avatarEl.textContent = (user.display_name || 'U').charAt(0).toUpperCase();
    }
  },

  /**
   * Highlight active nav
   */
  setActiveNav(page) {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
  },

  /**
   * Modal helpers
   */
  openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('show');
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('show');
  },

  /**
   * Confirm dialog (simple)
   */
  confirm(message) {
    return window.confirm(message);
  },

  /**
   * Show loading state in a container
   */
  showLoading(containerId) {
    const el = document.getElementById(containerId);
    if (el) {
      el.innerHTML = `<div class="loading"><div class="spinner"></div> Memuat data...</div>`;
    }
  },

  /**
   * Empty state HTML
   */
  emptyState(title, subtitle) {
    return `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h4>${title || 'Belum ada data'}</h4>
        <p>${subtitle || 'Data akan muncul di sini setelah ada transaksi.'}</p>
      </div>
    `;
  },

  /**
   * Cash type label
   */
  cashLabel(type) {
    return type === 'HIMPI' ? 'Kas HIMPI' : type === 'USAHA_KELAS' ? 'Kas Usaha Kelas' : type;
  },

  typeLabel(type) {
    return type === 'INCOME' ? 'Pemasukan' : type === 'EXPENSE' ? 'Pengeluaran' : type;
  },

  /**
   * Check backend status and show banner if demo
   */
  async checkBackendStatus() {
    const banner = document.getElementById('demoBanner');
    if (!isBackendConfigured()) {
      if (banner) {
        banner.classList.remove('hidden');
        banner.innerHTML = `
          <strong>Mode Demo Lokal</strong> – Data disimpan di browser Anda (localStorage). 
          Untuk menggunakan Google Sheets, ikuti panduan deployment di README dan isi <code>API_BASE_URL</code> di <code>js/api.js</code>.
        `;
      }
      return;
    }
    try {
      const res = await API.ping();
      if (banner) {
        if (res.success && res.data && res.data.mode === 'DEMO') {
          banner.classList.remove('hidden');
          banner.innerHTML = `
            <strong>Mode Demo Backend</strong> – Autentikasi belum aman. 
            Jangan gunakan untuk transaksi uang nyata sampai autentikasi Google OAuth diimplementasikan.
          `;
        } else {
          banner.classList.add('hidden');
        }
      }
    } catch (e) {
      if (banner) {
        banner.classList.remove('hidden');
        banner.className = 'alert alert-error';
        banner.textContent = 'Gagal terhubung ke backend. Periksa URL API.';
      }
    }
  },

  /**
   * Export array of objects to CSV and download
   */
  exportCSV(rows, filename) {
    if (!rows || !rows.length) {
      this.toast('Tidak ada data untuk diekspor.', 'warning');
      return;
    }
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      const s = String(v ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const lines = [
      headers.join(','),
      ...rows.map(r => headers.map(h => escape(r[h])).join(','))
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'kas-mpi-export.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.toast('File CSV berhasil diunduh.', 'success');
  }
};

// Init common UI when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('sidebar')) {
    App.initSidebar();
    App.renderUserInfo();
  }
});
