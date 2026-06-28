// Admin Dashboard Script
let ordersList = [];
let portfolioList = [];
let packagesList = [];
let usersList = [];

let editingPortfolioId = null;
let editingPackageId = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check authorization
  const isAdmin = await checkAdminStatus();
  if (!isAdmin) {
    showToast('Akses ditolak. Halaman khusus Administrator.', 'error');
    setTimeout(() => window.location.href = 'index.html', 1500);
    return;
  }

  // Hook up tab controls
  const tabButtons = document.querySelectorAll('.db-tab-btn');
  const tabContents = document.querySelectorAll('.db-tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      tabContents.forEach(c => c.style.display = 'none');
      const targetId = btn.getAttribute('data-target');
      document.getElementById(targetId).style.display = 'block';

      // Load specific tab data
      if (targetId === 'admin-overview') loadOverviewData();
      else if (targetId === 'admin-orders') loadAdminOrders();
      else if (targetId === 'admin-portfolio') loadAdminPortfolio();
      else if (targetId === 'admin-packages') loadAdminPackages();
      else if (targetId === 'admin-users') loadAdminUsers();
    });
  });

  // Load overview tab initially
  loadOverviewData();

  // Modals management
  setupModal('btn-add-portfolio', 'portfolio-modal', 'portfolio-modal-close');
  setupModal('btn-add-package', 'package-modal', 'package-modal-close');
  setupModal('btn-add-invoice', 'invoice-modal', 'invoice-modal-close');

  // Adjust package modal on open for addition
  document.getElementById('btn-add-package').addEventListener('click', () => {
    editingPackageId = null;
    document.getElementById('package-modal-title').textContent = 'Tambah Paket Harga Baru';
    document.getElementById('package-submit-btn').textContent = 'Tambah Paket';
    document.getElementById('package-form').reset();
  });

  // Adjust portfolio modal on open for addition
  document.getElementById('btn-add-portfolio').addEventListener('click', () => {
    editingPortfolioId = null;
    document.getElementById('portfolio-modal-title').textContent = 'Tambah Portofolio';
    document.getElementById('portfolio-submit-btn').textContent = 'Tambah Item';
    document.getElementById('portfolio-form').reset();
  });

  // Forms submissions
  document.getElementById('portfolio-form').addEventListener('submit', handleAddPortfolio);
  document.getElementById('package-form').addEventListener('submit', handleAddPackage);
  document.getElementById('invoice-form').addEventListener('submit', handleAddInvoice);

  // Auto populate custom amount in manual invoice form when package changes
  document.getElementById('inv-package').addEventListener('change', (e) => {
    const pkgId = e.target.value;
    const selectedPkg = packagesList.find(p => p.id === pkgId);
    if (selectedPkg) {
      const price = parseFloat(selectedPkg.price);
      const discount = parseFloat(selectedPkg.discount_percentage || 0);
      const finalPrice = discount > 0 ? price * (1 - discount / 100) : price;
      document.getElementById('inv-amount').value = Math.round(finalPrice);
    }
  });

  // Sign out
  document.getElementById('admin-signout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    showToast('Berhasil sign out', 'success');
    setTimeout(() => window.location.href = 'index.html', 1000);
  });
});

// Modal helper
function setupModal(triggerId, modalId, closeId) {
  const trigger = document.getElementById(triggerId);
  const modal = document.getElementById(modalId);
  const close = document.getElementById(closeId);

  if (!trigger || !modal || !close) return;

  trigger.addEventListener('click', () => modal.classList.add('open'));
  close.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });
}

// 1. Overview data loading
async function loadOverviewData() {
  try {
    // Fetch orders for metrics
    const { data: orders, error: ordersErr } = await supabaseClient
      .from('orders')
      .select('*');

    if (ordersErr) throw ordersErr;

    // Calculate metrics
    let revenue = 0;
    let paidCount = 0;
    let pendingCount = 0;

    orders.forEach(o => {
      if (o.status === 'paid') {
        revenue += o.amount;
        paidCount++;
      } else if (o.status === 'pending') {
        pendingCount++;
      }
    });

    // Fetch user count
    const { count: usersCount, error: usersErr } = await supabaseClient
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Set metric displays
    document.getElementById('stat-revenue').textContent = formatPrice(revenue);
    document.getElementById('stat-paid-orders').textContent = paidCount;
    document.getElementById('stat-pending-orders').textContent = pendingCount;
    document.getElementById('stat-total-users').textContent = usersCount || 0;

    // Fetch Activity Logs
    const { data: logs, error: logsErr } = await supabaseClient
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    const logBody = document.getElementById('activity-log-body');
    if (!logsErr && logs && logs.length > 0) {
      logBody.innerHTML = logs.map(l => {
        const timeStr = new Date(l.created_at).toLocaleString('id-ID', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        return `
          <tr>
            <td style="font-size: 0.85rem; color: var(--muted);">${timeStr}</td>
            <td style="font-weight: 600;">${l.user_email || 'System'}</td>
            <td><span class="status-badge paid" style="font-size: 0.7rem; background: rgba(255,255,255,0.05); color: var(--foreground);">${l.action}</span></td>
            <td style="font-size: 0.85rem;">${l.description || '-'}</td>
          </tr>
        `;
      }).join('');
    } else {
      logBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--muted);">Belum ada log aktivitas.</td></tr>`;
    }

  } catch (err) {
    console.error('Error loading overview metrics:', err);
  }
}

// 2. Load Client Orders
async function loadAdminOrders() {
  const tbody = document.getElementById('admin-orders-body');
  if (!tbody) return;

  try {
    const { data, error } = await supabaseClient
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    ordersList = data || [];

    if (ordersList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--muted); padding: 3rem 0;">Belum ada pesanan masuk.</td></tr>`;
      return;
    }

    tbody.innerHTML = ordersList.map(o => {
      const dateStr = new Date(o.created_at).toLocaleDateString('id-ID', {
        year: 'numeric', month: 'short', day: 'numeric'
      });

      const actions = o.status === 'pending'
        ? `
          <div style="display: flex; gap: 0.25rem;">
            <button class="btn btn-primary btn-sm pay-order-btn" data-id="${o.id}">Lunas</button>
            <button class="btn btn-outline btn-sm cancel-order-btn" data-id="${o.id}">Batal</button>
          </div>
        `
        : `<a href="order-detail.html?id=${o.id}" class="btn btn-secondary btn-sm">Detail</a>`;

      return `
        <tr>
          <td style="font-size: 0.85rem;">${dateStr}</td>
          <td>
            <div style="font-weight: 600;">${o.customer_name}</div>
            <div style="font-size: 0.75rem; color: var(--muted);">${o.customer_email}</div>
          </td>
          <td style="font-weight: 500;">${o.package_name}</td>
          <td style="font-weight: 700; color: var(--primary);">${formatPrice(o.amount)}</td>
          <td>${o.payment_method || '-'}</td>
          <td><span class="status-badge ${o.status}">${o.status}</span></td>
          <td>${actions}</td>
        </tr>
      `;
    }).join('');

    // Attach button events
    tbody.querySelectorAll('.pay-order-btn').forEach(b => {
      b.addEventListener('click', (e) => updateOrderStatus(e.target.getAttribute('data-id'), 'paid'));
    });
    tbody.querySelectorAll('.cancel-order-btn').forEach(b => {
      b.addEventListener('click', (e) => updateOrderStatus(e.target.getAttribute('data-id'), 'failed'));
    });

  } catch (err) {
    console.error('Error loading admin orders:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #dc2626;">Gagal memuat daftar pesanan.</td></tr>`;
  }
}

async function updateOrderStatus(orderId, status) {
  if (!confirm(`Konfirmasi ganti status pesanan ini menjadi ${status.toUpperCase()}?`)) return;

  try {
    const updateData = { status };
    if (status === 'paid') {
      updateData.paid_at = new Date().toISOString();
    }

    const { error } = await supabaseClient
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (error) throw error;

    await logActivity('order_status_update', `Admin mengubah status pesanan ${orderId} menjadi ${status}`, {
      order_id: orderId,
      new_status: status
    });

    showToast('Status pesanan berhasil diperbarui!', 'success');
    loadAdminOrders();
  } catch (err) {
    console.error('Error updating order status:', err);
    showToast(err.message || 'Gagal mengubah status pesanan.', 'error');
  }
}

// 3. Load Portfolio items list
async function loadAdminPortfolio() {
  const tbody = document.getElementById('admin-portfolio-body');
  if (!tbody) return;

  try {
    const { data, error } = await supabaseClient
      .from('portfolio_items')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    portfolioList = data || [];

    if (portfolioList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 3rem 0;">Belum ada portofolio.</td></tr>`;
      return;
    }

    tbody.innerHTML = portfolioList.map(item => `
      <tr>
        <td><img src="${item.image_url || 'placeholder.svg'}" style="width: 50px; height: 35px; object-fit: cover; border-radius: 4px; border: 1px solid var(--card-border);"></td>
        <td style="font-weight: 600;">${item.title}</td>
        <td>${item.category}</td>
        <td>${item.sort_order}</td>
        <td>
          <input type="checkbox" class="toggle-visible-chk" data-id="${item.id}" ${item.is_visible ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;">
        </td>
        <td>
          <div style="display: flex; gap: 0.25rem;">
            <button class="btn btn-secondary btn-sm edit-portfolio-btn" data-id="${item.id}">Edit</button>
            <button class="btn btn-outline btn-sm delete-portfolio-btn" data-id="${item.id}" style="border-color: #dc2626; color: #ef4444;">Hapus</button>
          </div>
        </td>
      </tr>
    `).join('');

    // Attach listeners
    tbody.querySelectorAll('.toggle-visible-chk').forEach(c => {
      c.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        const isChecked = e.target.checked;
        await supabaseClient.from('portfolio_items').update({ is_visible: isChecked }).eq('id', id);
        showToast('Status visibilitas portofolio diperbarui.', 'success');
      });
    });

    tbody.querySelectorAll('.edit-portfolio-btn').forEach(b => {
      b.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        const item = portfolioList.find(p => p.id === id);
        if (item) {
          editingPortfolioId = id;
          document.getElementById('portfolio-modal-title').textContent = 'Edit Portofolio';
          document.getElementById('portfolio-submit-btn').textContent = 'Simpan Perubahan';
          
          document.getElementById('port-title').value = item.title;
          document.getElementById('port-category').value = item.category;
          document.getElementById('port-desc').value = item.description;
          document.getElementById('port-image').value = item.image_url;
          document.getElementById('port-link').value = item.link_url || '';
          document.getElementById('port-sort').value = item.sort_order;

          document.getElementById('portfolio-modal').classList.add('open');
        }
      });
    });

    tbody.querySelectorAll('.delete-portfolio-btn').forEach(b => {
      b.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (confirm('Konfirmasi hapus item portofolio ini?')) {
          await supabaseClient.from('portfolio_items').delete().eq('id', id);
          showToast('Portofolio berhasil dihapus!', 'success');
          loadAdminPortfolio();
        }
      });
    });

  } catch (err) {
    console.error('Error loading portfolio admin:', err);
  }
}

// Add/Edit Portfolio Item
async function handleAddPortfolio(e) {
  e.preventDefault();
  
  const title = document.getElementById('port-title').value.trim();
  const category = document.getElementById('port-category').value;
  const description = document.getElementById('port-desc').value.trim();
  const image_url = document.getElementById('port-image').value.trim();
  const link_url = document.getElementById('port-link').value.trim() || null;
  const sort_order = parseInt(document.getElementById('port-sort').value);

  const submitBtn = document.getElementById('portfolio-submit-btn');
  submitBtn.disabled = true;

  try {
    if (editingPortfolioId) {
      // Edit Mode
      const { error } = await supabaseClient
        .from('portfolio_items')
        .update({ title, category, description, image_url, link_url, sort_order })
        .eq('id', editingPortfolioId);

      if (error) throw error;
      showToast('Portofolio berhasil diperbarui!', 'success');
    } else {
      // Add Mode
      const { error } = await supabaseClient
        .from('portfolio_items')
        .insert({ title, category, description, image_url, link_url, sort_order, is_visible: true });

      if (error) throw error;
      showToast('Portofolio baru berhasil ditambahkan!', 'success');
    }

    document.getElementById('portfolio-modal').classList.remove('open');
    document.getElementById('portfolio-form').reset();
    editingPortfolioId = null;
    loadAdminPortfolio();
  } catch (err) {
    showToast(err.message || 'Gagal menyimpan portofolio.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

// 4. Load pricing packages
async function loadAdminPackages() {
  const tbody = document.getElementById('admin-packages-body');
  if (!tbody) return;

  try {
    const { data, error } = await supabaseClient
      .from('pricing_packages')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    packagesList = data || [];

    // Populate select field in Manual Invoice Modal
    const selectPackage = document.getElementById('inv-package');
    if (selectPackage) {
      selectPackage.innerHTML = '<option value="" disabled selected>Pilih Paket</option>' + 
        packagesList.map(p => `<option value="${p.id}">${p.name} - ${formatPrice(p.price)}</option>`).join('');
    }

    tbody.innerHTML = packagesList.map(pkg => `
      <tr>
        <td style="font-weight: 600;">${pkg.name}</td>
        <td>${pkg.category || '-'}</td>
        <td>${formatPrice(pkg.price)}</td>
        <td>${pkg.discount_percentage}%</td>
        <td>${pkg.is_popular ? 'Ya' : 'Tidak'}</td>
        <td>
          <div style="display: flex; gap: 0.25rem;">
            <button class="btn btn-secondary btn-sm edit-package-btn" data-id="${pkg.id}">Edit</button>
            <button class="btn btn-outline btn-sm delete-package-btn" data-id="${pkg.id}" style="border-color: #dc2626; color: #ef4444;">Hapus</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.edit-package-btn').forEach(b => {
      b.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        const pkg = packagesList.find(p => p.id === id);
        if (pkg) {
          editingPackageId = id;
          document.getElementById('package-modal-title').textContent = 'Edit Paket Harga';
          document.getElementById('package-submit-btn').textContent = 'Simpan Perubahan';

          document.getElementById('pkg-category').value = pkg.category || 'Landing Page';
          document.getElementById('pkg-name').value = pkg.name;
          document.getElementById('pkg-price').value = pkg.price;
          document.getElementById('pkg-discount').value = pkg.discount_percentage || 0;
          document.getElementById('pkg-desc').value = pkg.description || '';
          document.getElementById('pkg-features').value = (pkg.features || []).join('\n');
          document.getElementById('pkg-popular').checked = pkg.is_popular;
          document.getElementById('pkg-sort').value = pkg.sort_order;

          document.getElementById('package-modal').classList.add('open');
        }
      });
    });

    tbody.querySelectorAll('.delete-package-btn').forEach(b => {
      b.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (confirm('Konfirmasi hapus paket harga ini?')) {
          await supabaseClient.from('pricing_packages').delete().eq('id', id);
          showToast('Paket harga berhasil dihapus!', 'success');
          loadAdminPackages();
        }
      });
    });
  } catch (err) {
    console.error('Error loading admin packages:', err);
  }
}

// Add/Edit Price Package
async function handleAddPackage(e) {
  e.preventDefault();

  const category = document.getElementById('pkg-category').value;
  const name = document.getElementById('pkg-name').value.trim();
  const price = parseFloat(document.getElementById('pkg-price').value);
  const discount_percentage = parseInt(document.getElementById('pkg-discount').value);
  const description = document.getElementById('pkg-desc').value.trim() || null;
  const featuresText = document.getElementById('pkg-features').value.trim();
  const is_popular = document.getElementById('pkg-popular').checked;
  const sort_order = parseInt(document.getElementById('pkg-sort').value);

  // Parse features by line break
  const features = featuresText.split('\n').map(f => f.trim()).filter(f => f.length > 0);

  const submitBtn = document.getElementById('package-submit-btn');
  submitBtn.disabled = true;

  try {
    if (editingPackageId) {
      // Edit mode
      const { error } = await supabaseClient
        .from('pricing_packages')
        .update({
          category,
          name,
          price,
          description,
          features,
          is_popular,
          discount_percentage,
          sort_order
        })
        .eq('id', editingPackageId);

      if (error) throw error;
      showToast('Paket harga berhasil diperbarui!', 'success');
    } else {
      // Add mode
      const { error } = await supabaseClient
        .from('pricing_packages')
        .insert({
          category,
          name,
          price,
          period: 'proyek',
          description,
          features,
          is_popular,
          discount_percentage,
          sort_order
        });

      if (error) throw error;
      showToast('Paket harga baru berhasil ditambahkan!', 'success');
    }

    document.getElementById('package-modal').classList.remove('open');
    document.getElementById('package-form').reset();
    editingPackageId = null;
    loadAdminPackages();
  } catch (err) {
    showToast(err.message || 'Gagal menyimpan paket.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

// 5. Load Users (User Management)
async function loadAdminUsers() {
  const tbody = document.getElementById('admin-users-body');
  if (!tbody) return;

  try {
    const { data: profiles, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    usersList = profiles || [];

    if (usersList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--muted); padding: 3rem 0;">Belum ada pengguna terdaftar.</td></tr>`;
      return;
    }

    tbody.innerHTML = usersList.map(user => {
      const dateStr = new Date(user.created_at).toLocaleDateString('id-ID', {
        year: 'numeric', month: 'short', day: 'numeric'
      });

      return `
        <tr>
          <td style="font-size: 0.85rem; color: var(--muted);">${dateStr}</td>
          <td style="font-weight: 600;">${user.full_name || '-'}</td>
          <td>${user.email || '-'}</td>
          <td>
            <select class="form-control user-role-select" data-id="${user.id}" data-user-id="${user.user_id}" style="padding: 0.25rem 0.5rem; width: auto; font-size: 0.85rem; background: var(--card-bg); border-color: var(--card-border);">
              <option value="user" ${user.role === 'user' ? 'selected' : ''}>User (Klien)</option>
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrator</option>
            </select>
          </td>
          <td>
            <button class="btn btn-outline btn-sm delete-user-btn" data-id="${user.id}" data-user-id="${user.user_id}" style="border-color: #dc2626; color: #ef4444;">Hapus</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach role change listeners
    tbody.querySelectorAll('.user-role-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        const userId = e.target.getAttribute('data-user-id');
        const newRole = e.target.value;

        if (confirm(`Ganti peran pengguna ini menjadi ${newRole.toUpperCase()}?`)) {
          try {
            // Update role in profiles
            const { error: pErr } = await supabaseClient
              .from('profiles')
              .update({ role: newRole })
              .eq('id', id);

            if (pErr) throw pErr;

            // Update role in user_roles if table is used
            const { error: rErr } = await supabaseClient
              .from('user_roles')
              .upsert({ user_id: userId, role: newRole }, { onConflict: 'user_id, role' });

            showToast('Peran pengguna berhasil diperbarui!', 'success');
            loadAdminUsers();
          } catch (err) {
            console.error('Role update error:', err);
            showToast('Gagal memperbarui peran pengguna.', 'error');
            e.target.value = newRole === 'admin' ? 'user' : 'admin'; // Revert selection
          }
        } else {
          loadAdminUsers(); // Reload to reset select state
        }
      });
    });

    // Attach delete user listeners
    tbody.querySelectorAll('.delete-user-btn').forEach(b => {
      b.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        const userId = e.target.getAttribute('data-user-id');

        if (confirm('Hapus pengguna ini beserta semua data miliknya secara permanen? Catatan: Akun Auth di Supabase tidak terpengaruh secara langsung.')) {
          try {
            // Delete profile
            const { error: pErr } = await supabaseClient
              .from('profiles')
              .delete()
              .eq('id', id);

            if (pErr) throw pErr;

            // Delete user_roles
            await supabaseClient
              .from('user_roles')
              .delete()
              .eq('user_id', userId);

            showToast('Profil pengguna berhasil dihapus!', 'success');
            loadAdminUsers();
          } catch (err) {
            console.error('Delete user profile error:', err);
            showToast('Gagal menghapus profil pengguna.', 'error');
          }
        }
      });
    });

  } catch (err) {
    console.error('Error loading admin users:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #dc2626;">Gagal memuat daftar pengguna.</td></tr>`;
  }
}

// 6. Manual Invoice Creation
async function handleAddInvoice(e) {
  e.preventDefault();

  const name = document.getElementById('inv-cust-name').value.trim();
  const email = document.getElementById('inv-cust-email').value.trim();
  const phone = document.getElementById('inv-cust-phone').value.trim() || null;
  const packageId = document.getElementById('inv-package').value;
  const amount = parseFloat(document.getElementById('inv-amount').value);
  const paymentMethod = document.getElementById('inv-payment-method').value;

  const submitBtn = document.getElementById('invoice-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Memproses...';

  try {
    const selectedPkg = packagesList.find(p => p.id === packageId);
    if (!selectedPkg) throw new Error('Paket tidak valid');

    // Look up client user_id by email if exists
    const { data: clientProfile } = await supabaseClient
      .from('profiles')
      .select('user_id')
      .eq('email', email)
      .maybeSingle();

    const userIdVal = clientProfile ? clientProfile.user_id : null;

    if (paymentMethod === 'Manual Transfer') {
      // Create a directly completed/paid order in client-side Supabase
      const { data: orderData, error } = await supabaseClient
        .from('orders')
        .insert({
          user_id: userIdVal,
          package_id: packageId,
          package_name: selectedPkg.name,
          amount: amount,
          customer_name: name,
          customer_email: email,
          customer_phone: phone,
          status: 'paid',
          payment_method: 'Manual Transfer',
          paid_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      await logActivity('manual_invoice_create', `Admin membuat invoice manual lunas untuk ${email}`, {
        order_id: orderData.id,
        amount
      });

      showToast('Invoice manual lunas berhasil dibuat!', 'success');
      document.getElementById('invoice-modal').classList.remove('open');
      document.getElementById('invoice-form').reset();
      loadAdminOrders();

    } else {
      // Create via Midtrans Snap API - invoke Edge Function
      const { data, error } = await supabaseClient.functions.invoke('create-midtrans-transaction', {
        body: {
          packageId,
          packageName: selectedPkg.name,
          amount,
          customerName: name,
          customerEmail: email,
          customerPhone: phone || undefined
        }
      });

      if (error || !data) {
        throw new Error(error?.message || 'Gagal memanggil Midtrans Edge Function');
      }

      // If client user exists, link the created order to their user ID
      if (userIdVal && data.orderId) {
        await supabaseClient
          .from('orders')
          .update({ user_id: userIdVal })
          .eq('id', data.orderId);
      }

      await logActivity('midtrans_invoice_create', `Admin membuat invoice Midtrans untuk ${email}`, {
        order_id: data.orderId,
        amount
      });

      showToast('Invoice Midtrans berhasil dibuat!', 'success');
      document.getElementById('invoice-modal').classList.remove('open');
      document.getElementById('invoice-form').reset();
      loadAdminOrders();
    }
  } catch (err) {
    console.error('Error creating invoice:', err);
    showToast(err.message || 'Gagal membuat invoice.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Buat Invoice';
  }
}
