/**
 * KAS MPI – Authentication (Demo Mode)
 * 
 * PERINGATAN: Ini adalah autentikasi demo.
 * Tidak ada verifikasi password/token yang aman.
 * Cocok hanya untuk pengujian UI dan alur data.
 */

const Auth = {
  STORAGE_KEY: 'kas_mpi_user',

  /**
   * Login dengan memilih user demo
   */
  login(userId) {
    const demoUsers = {
      'USR-ADMIN': {
        user_id: 'USR-ADMIN',
        display_name: 'Admin Utama',
        email: 'admin@example.com',
        role: 'ADMIN',
        allowed_cash: ['HIMPI', 'USAHA_KELAS']
      },
      'USR-BH': {
        user_id: 'USR-BH',
        display_name: 'Bendahara HIMPI',
        email: 'bendahara.himpi@example.com',
        role: 'BENDAHARA_HIMPI',
        allowed_cash: ['HIMPI']
      },
      'USR-BU': {
        user_id: 'USR-BU',
        display_name: 'Bendahara Usaha',
        email: 'bendahara.usaha@example.com',
        role: 'BENDAHARA_USAHA',
        allowed_cash: ['USAHA_KELAS']
      },
      'USR-ANG': {
        user_id: 'USR-ANG',
        display_name: 'Anggota Kelas',
        email: 'anggota@example.com',
        role: 'ANGGOTA',
        allowed_cash: ['HIMPI', 'USAHA_KELAS']
      }
    };

    const user = demoUsers[userId];
    if (!user) {
      return { success: false, message: 'Pengguna tidak ditemukan.' };
    }

    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    return { success: true, user };
  },

  logout() {
    sessionStorage.removeItem(this.STORAGE_KEY);
    window.location.href = 'login.html';
  },

  getCurrentUser() {
    try {
      const raw = sessionStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  isLoggedIn() {
    return !!this.getCurrentUser();
  },

  /**
   * Require login – redirect if not
   */
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  /**
   * Check if current user can create transaction for a cash type
   */
  canCreate(cashType) {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    if (user.role === 'ANGGOTA') return false;
    if (user.role === 'BENDAHARA_HIMPI') return cashType === 'HIMPI';
    if (user.role === 'BENDAHARA_USAHA') return cashType === 'USAHA_KELAS';
    return (user.allowed_cash || []).includes(cashType);
  },

  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.role === 'ADMIN';
  },

  isAnggota() {
    const user = this.getCurrentUser();
    return user && user.role === 'ANGGOTA';
  },

  roleLabel(role) {
    const map = {
      ADMIN: 'Admin Utama',
      BENDAHARA_HIMPI: 'Bendahara HIMPI',
      BENDAHARA_USAHA: 'Bendahara Usaha',
      ANGGOTA: 'Anggota'
    };
    return map[role] || role;
  }
};
