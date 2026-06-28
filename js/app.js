// Supabase & Common Utility Configurations
const SUPABASE_URL = "https://wtdxhorkuiknosqjxjws.supabase.co";
const SUPABASE_KEY = "sb_publishable_BTXZhl5zaJz9j3qq1jmBwQ_dicL_zIb";

// Initialize Supabase Client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: window.localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Toast notification helper
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${type === 'success' 
        ? '<polyline points="20 6 9 17 4 12"></polyline>' 
        : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
      }
    </svg>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Trigger reflow & show
  setTimeout(() => toast.classList.add('show'), 10);

  // Remove after duration
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Format currency IDR
function formatPrice(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}

// Log activity wrapper
async function logActivity(action, description = '', metadata = {}) {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    // We can directly call the Supabase Edge Function 'log-activity'
    await supabaseClient.functions.invoke('log-activity', {
      body: { action, description, metadata }
    });
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

// Check admin role
async function checkAdminStatus() {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return false;
    
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();
      
    if (error || !data) return false;
    return data.role === 'admin';
  } catch (err) {
    return false;
  }
}

// Toggle mobile menu
document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.getElementById('menu-toggle');
  const navLinks = document.getElementById('nav-links');
  
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }
  
  // Style header on scroll
  const header = document.querySelector('header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }
});
