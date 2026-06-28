// Admin Dashboard Script
let ordersList = [];
let portfolioList = [];
let packagesList = [];

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
    });
  });

  // Load overview tab initially
  loadOverviewData();

  // Modals management
  setupModal('btn-add-portfolio', 'portfolio-modal', 'portfolio-modal-close');
  setupModal('btn-add-package', 'package-modal', 'package-modal-close');

  // Forms submissions
  document.getElementById('portfolio-form').addEventListener('submit', handleAddPortfolio);
  document.getElementById('package-form').addEventListener('submit', handleAddPackage);

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
        <td><img src="${item.image_url || '/placeholder.png'}" style="width: 50px; height: 35px; object-fit: cover; border-radius: 4px; border: 1px solid var(--card-border);"></td>
        <td style="font-weight: 600;">${item.title}</td>
        <td>${item.category}</td>
        <td>${item.sort_order}</td>
        <td>
          <input type="checkbox" class="toggle-visible-chk" data-id="${item.id}" ${item.is_visible ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;">
        </td>
        <td>
          <button class="btn btn-outline btn-sm delete-portfolio-btn" data-id="${item.id}" style="border-color: #dc2626; color: #ef4444;">Hapus</button>
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

// Add Portfolio Item
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
    const { error } = await supabaseClient
      .from('portfolio_items')
      .insert({ title, category, description, image_url, link_url, sort_order, is_visible: true });

    if (error) throw error;

    showToast('Portofolio baru berhasil ditambahkan!', 'success');
    document.getElementById('portfolio-modal').classList.remove('open');
    document.getElementById('portfolio-form').reset();
    loadAdminPortfolio();
  } catch (err) {
    showToast(err.message || 'Gagal menambahkan portofolio.', 'error');
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

    tbody.innerHTML = packagesList.map(pkg => `
      <tr>
        <td style="font-weight: 600;">${pkg.name}</td>
        <td>${formatPrice(pkg.price)}</td>
        <td>${pkg.discount_percentage}%</td>
        <td>${pkg.is_popular ? 'Ya' : 'Tidak'}</td>
        <td>
          <button class="btn btn-outline btn-sm delete-package-btn" data-id="${pkg.id}" style="border-color: #dc2626; color: #ef4444;">Hapus</button>
        </td>
      </tr>
    `).join('');

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

// Add Price Package
async function handleAddPackage(e) {
  e.preventDefault();

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
    const { error } = await supabaseClient
      .from('pricing_packages')
      .insert({
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
    document.getElementById('package-modal').classList.remove('open');
    document.getElementById('package-form').reset();
    loadAdminPackages();
  } catch (err) {
    showToast(err.message || 'Gagal menambahkan paket.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
}
