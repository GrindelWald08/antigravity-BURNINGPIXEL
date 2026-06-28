// Home Page Dynamic Logic
const rotatingTexts = [
  'Website Company Profile',
  'Landing Page',
  'Website Tour & Travel',
  'Website Toko Online',
];

let textIndex = 0;
let allPackages = [];
let selectedPackage = null;

document.addEventListener('DOMContentLoaded', () => {
  // 1. Start Rotating Hero Badge Text
  const rotatingTextEl = document.getElementById('rotating-text');
  if (rotatingTextEl) {
    setInterval(() => {
      textIndex = (textIndex + 1) % rotatingTexts.length;
      rotatingTextEl.style.opacity = 0;
      setTimeout(() => {
        rotatingTextEl.textContent = rotatingTexts[textIndex];
        rotatingTextEl.style.opacity = 1;
      }, 250);
    }, 3000);
  }

  // 2. Setup Navbar Auth Status dynamically
  setupNavbarAuth();

  // 3. Load pricing packages and portfolio
  loadPricingPackages();
  loadPortfolioItems();

  // 4. Hook up tab filters for pricing
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const category = e.target.getAttribute('data-category');
      renderPricingPackages(category);
    });
  });

  // 5. Setup Checkout Modal listeners
  setupCheckoutModal();
});

// Setup dynamic authentication in Navbar
async function setupNavbarAuth() {
  const authNavItem = document.getElementById('auth-nav-item');
  if (!authNavItem) return;

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    // Check if admin
    const isAdmin = await checkAdminStatus();
    authNavItem.innerHTML = `
      <div style="display: flex; gap: 0.50rem; align-items: center;">
        <a href="account.html" class="btn btn-outline btn-sm">Akun Saya</a>
        ${isAdmin ? '<a href="admin.html" class="btn btn-outline btn-sm" style="border-color: var(--primary); color: var(--primary);">Admin</a>' : ''}
        <button id="signout-btn" class="btn btn-secondary btn-sm">Sign Out</button>
      </div>
    `;

    document.getElementById('signout-btn').addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      showToast('Berhasil sign out', 'success');
      setTimeout(() => window.location.reload(), 1000);
    });
  } else {
    authNavItem.innerHTML = `<a href="auth.html" class="btn btn-outline btn-sm">Sign In</a>`;
  }
}

// Load packages from Supabase
async function loadPricingPackages() {
  const container = document.getElementById('pricing-container');
  try {
    const { data, error } = await supabaseClient
      .from('pricing_packages')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    allPackages = data || [];
    renderPricingPackages('landing-page');
  } catch (err) {
    console.error('Error loading packages:', err);
    if (container) {
      container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #dc2626;">Gagal memuat paket harga. Silakan muat ulang halaman.</p>`;
    }
  }
}

// Render filtered packages in pricing grid
function renderPricingPackages(category) {
  const container = document.getElementById('pricing-container');
  if (!container) return;

  // Filter criteria: match package category directly
  const categoryMap = {
    'landing-page': 'Landing Page',
    'company-profile': 'Company Profile',
    'travel-tour': 'Travel & Tour',
    'toko-online': 'Toko Online'
  };
  const filterCategory = categoryMap[category] || '';

  const filtered = allPackages.filter(pkg => 
    pkg.category === filterCategory
  );

  if (filtered.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--muted); padding: 3rem 0;">Tidak ada paket harga untuk kategori ini.</p>`;
    return;
  }

  container.innerHTML = filtered.map(pkg => {
    const discountedPrice = pkg.discount_percentage > 0
      ? pkg.price * (1 - pkg.discount_percentage / 100)
      : pkg.price;

    let tierName = pkg.name;
    if (tierName.includes(' - ')) {
      tierName = tierName.split(' - ')[1]?.trim();
    }

    return `
      <div class="pricing-card ${pkg.is_popular ? 'popular' : ''} animate-fade-up">
        ${pkg.is_popular ? '<span class="popular-badge">Populer</span>' : ''}
        
        <div>
          <h3 class="pricing-tier">${tierName}</h3>
          <p class="pricing-desc">${pkg.description || 'Solusi website berkualitas tinggi'}</p>
          
          <div class="pricing-price-box">
            ${pkg.discount_percentage > 0 
              ? `<p class="price-original">${formatPrice(pkg.price)}</p>` 
              : ''
            }
            <div class="price-current">
              <span class="amount">${formatPrice(discountedPrice)}</span>
              ${pkg.discount_percentage > 0 
                ? `<span class="price-discount-tag">${pkg.discount_percentage}% OFF</span>` 
                : ''
              }
            </div>
          </div>
          
          <ul class="pricing-features">
            ${pkg.features.map(f => `
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                ${f}
              </li>
            `).join('')}
          </ul>
        </div>
        
        <button class="btn ${pkg.is_popular ? 'btn-primary' : 'btn-secondary'} order-now-btn" data-id="${pkg.id}" data-name="${pkg.name}" data-price="${discountedPrice}">
          Pesan Sekarang
        </button>
      </div>
    `;
  }).join('');

  // Attach event listeners to Order buttons
  const orderButtons = container.querySelectorAll('.order-now-btn');
  orderButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      const name = e.target.getAttribute('data-name');
      const price = parseFloat(e.target.getAttribute('data-price'));
      
      handleOrderClick(id, name, price);
    });
  });
}

// Load portfolio items from Supabase
async function loadPortfolioItems() {
  const container = document.getElementById('portfolio-container');
  if (!container) return;

  try {
    const { data, error } = await supabaseClient
      .from('portfolio_items')
      .select('*')
      .eq('is_visible', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--muted); padding: 3rem 0;">Belum ada portofolio yang ditampilkan.</p>`;
      return;
    }

    container.innerHTML = data.map(item => `
      <div class="portfolio-card animate-fade-up">
        <img src="${item.image_url || '/placeholder.png'}" alt="${item.title}" class="portfolio-img">
        <div class="portfolio-info">
          <span class="portfolio-tag">${item.category}</span>
          <h3>${item.title}</h3>
          <p>${item.description || ''}</p>
          ${item.link_url 
            ? `<a href="${item.link_url}" target="_blank" class="btn btn-outline btn-sm" style="margin-top: 1rem; width: 100%;">Kunjungi Website</a>`
            : ''
          }
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading portfolio:', err);
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--muted);">Gagal memuat item portofolio.</p>`;
  }
}

// Checkout Modal handlers
function setupCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  const closeBtn = document.getElementById('modal-close');
  const orderForm = document.getElementById('order-form');
  const loginBtn = document.getElementById('modal-login-btn');
  const payNowBtn = document.getElementById('pay-now-btn');

  if (!modal) return;

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  loginBtn.addEventListener('click', () => {
    closeModal();
    window.location.href = `auth.html?returnTo=${encodeURIComponent('index.html#harga')}`;
  });

  orderForm.addEventListener('submit', handleCheckoutSubmit);
}

// Open modal and check user authorization status
async function handleOrderClick(id, name, price) {
  selectedPackage = { id, name, price };
  
  const modal = document.getElementById('checkout-modal');
  const authPrompt = document.getElementById('modal-auth-prompt');
  const checkoutForm = document.getElementById('modal-checkout-form');
  const paymentRedirect = document.getElementById('modal-payment-redirect');
  const formSubmitBtn = document.getElementById('order-submit-btn');

  if (!modal) return;

  // Reset display states
  authPrompt.style.display = 'none';
  checkoutForm.style.display = 'none';
  paymentRedirect.style.display = 'none';
  formSubmitBtn.disabled = false;
  formSubmitBtn.textContent = 'Buat Pesanan';

  // Open modal
  modal.classList.add('open');

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    authPrompt.style.display = 'block';
  } else {
    // Show checkout form
    checkoutForm.style.display = 'block';
    
    // Fill package name and total amount
    document.getElementById('checkout-package-title').textContent = name;
    document.getElementById('checkout-package-amount').textContent = formatPrice(price);

    // Pre-fill input fields
    document.getElementById('cust-name').value = user.user_metadata?.full_name || '';
    document.getElementById('cust-email').value = user.email || '';
    document.getElementById('cust-phone').value = '';
  }
}

function closeModal() {
  const modal = document.getElementById('checkout-modal');
  if (modal) modal.classList.remove('open');
  selectedPackage = null;
}

// Call Edge Function 'create-midtrans-transaction'
async function handleCheckoutSubmit(e) {
  e.preventDefault();

  if (!selectedPackage) return;

  const name = document.getElementById('cust-name').value;
  const email = document.getElementById('cust-email').value;
  const phone = document.getElementById('cust-phone').value;
  const submitBtn = document.getElementById('order-submit-btn');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Memproses Pesanan...';

  try {
    const { data, error } = await supabaseClient.functions.invoke('create-midtrans-transaction', {
      body: {
        packageId: selectedPackage.id,
        packageName: selectedPackage.name,
        amount: selectedPackage.price,
        customerName: name,
        customerEmail: email,
        customerPhone: phone || undefined
      }
    });

    if (error) throw error;

    // Log Activity
    await logActivity('order_created', `Pemesanan paket ${selectedPackage.name}`, {
      amount: selectedPackage.price,
      customer_email: email
    });

    // Display Redirect Panel
    document.getElementById('modal-checkout-form').style.display = 'none';
    const redirectPanel = document.getElementById('modal-payment-redirect');
    redirectPanel.style.display = 'block';

    const payNowBtn = document.getElementById('pay-now-btn');
    payNowBtn.onclick = () => {
      window.open(data.redirectUrl, '_blank');
      closeModal();
      window.location.href = `order-detail.html?id=${data.orderId}`;
    };

  } catch (err) {
    console.error('Checkout error:', err);
    showToast(err.message || 'Gagal memproses pesanan. Silakan coba lagi.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Buat Pesanan';
  }
}
