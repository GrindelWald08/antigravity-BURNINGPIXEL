// User Dashboard Account Script
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check if authenticated
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    window.location.href = `auth.html?returnTo=${encodeURIComponent(window.location.pathname)}`;
    return;
  }
  
  currentUser = user;
  
  // Set navbar name/email display
  document.getElementById('user-email-display').textContent = user.email;
  document.getElementById('profile-name').value = user.user_metadata?.full_name || '';

  // 1. Sidebar tab switching logic
  const tabButtons = document.querySelectorAll('.db-tab-btn');
  const tabContents = document.querySelectorAll('.db-tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Deactivate all buttons
      tabButtons.forEach(b => b.classList.remove('active'));
      // Activate clicked button
      btn.classList.add('active');

      // Hide all contents
      tabContents.forEach(c => c.style.display = 'none');
      // Show targeted content
      const targetId = btn.getAttribute('data-target');
      document.getElementById(targetId).style.display = 'block';

      // Load orders if switching to orders tab
      if (targetId === 'orders-tab') {
        loadUserOrders();
      }
    });
  });

  // 2. Profile name update
  document.getElementById('update-profile-form').addEventListener('submit', handleProfileUpdate);

  // 3. Password update
  document.getElementById('update-password-form').addEventListener('submit', handlePasswordUpdate);

  // 4. Sign out
  document.getElementById('header-signout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    showToast('Berhasil sign out', 'success');
    setTimeout(() => window.location.href = 'index.html', 1000);
  });
});

// Update Profile
async function handleProfileUpdate(e) {
  e.preventDefault();
  const name = document.getElementById('profile-name').value.trim();
  const submitBtn = document.getElementById('profile-submit-btn');

  if (!name) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Menyimpan...';

  try {
    // 1. Update auth user metadata
    const { error: authError } = await supabaseClient.auth.updateUser({
      data: { full_name: name }
    });
    if (authError) throw authError;

    // 2. Update profiles table
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .update({ full_name: name })
      .eq('user_id', currentUser.id);
    
    if (profileError) console.error('Profiles table update error:', profileError);

    await logActivity('profile_update', 'Pengguna memperbarui informasi nama profil');

    showToast('Nama profil berhasil disimpan!', 'success');
  } catch (err) {
    console.error('Profile update error:', err);
    showToast(err.message || 'Gagal memperbarui profil.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Simpan Nama';
  }
}

// Update Password
async function handlePasswordUpdate(e) {
  e.preventDefault();
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const submitBtn = document.getElementById('password-submit-btn');

  if (newPassword !== confirmPassword) {
    showToast('Konfirmasi kata sandi tidak cocok.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Memproses...';

  try {
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    await logActivity('password_change', 'Pengguna memperbarui kata sandi akun');

    showToast('Kata sandi berhasil diubah!', 'success');
    
    // Reset inputs
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
  } catch (err) {
    console.error('Password change error:', err);
    showToast(err.message || 'Gagal mengubah kata sandi.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Ubah Password';
  }
}

// Load Orders history from Supabase
async function loadUserOrders() {
  const tbody = document.getElementById('orders-table-body');
  if (!tbody) return;

  try {
    const { data: orders, error } = await supabaseClient
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!orders || orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--muted); padding: 3rem 0;">
            Belum ada transaksi pemesanan.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = orders.map(order => {
      const dateStr = new Date(order.created_at).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      const actionBtn = order.status === 'pending' && order.xendit_invoice_url
        ? `<a href="${order.xendit_invoice_url}" target="_blank" class="btn btn-outline btn-sm" style="border-color: var(--primary); color: var(--primary);">Bayar Sekarang</a>`
        : `<a href="order-detail.html?id=${order.id}" class="btn btn-secondary btn-sm">Lihat Detail</a>`;

      return `
        <tr>
          <td>${dateStr}</td>
          <td style="font-weight: 600;">${order.package_name}</td>
          <td style="font-weight: 700; color: var(--primary);">${formatPrice(order.amount)}</td>
          <td>${order.payment_method || '-'}</td>
          <td>
            <span class="status-badge ${order.status}">${order.status}</span>
          </td>
          <td>${actionBtn}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error loading user orders:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: #dc2626; padding: 2rem 0;">
          Gagal memuat riwayat transaksi.
        </td>
      </tr>
    `;
  }
}
