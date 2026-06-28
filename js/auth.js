// Authentication Scripts
let currentMode = 'login'; // 'login', 'register', 'forgot'
let returnUrl = 'index.html';

document.addEventListener('DOMContentLoaded', () => {
  // Parse return destination query parameter
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('returnTo')) {
    returnUrl = decodeURIComponent(urlParams.get('returnTo'));
  }

  // Redirect if already logged in
  checkLoggedIn();

  // Navigation Links
  const goRegister = document.getElementById('go-register');
  const goLogin = document.getElementById('go-login');
  const goForgot = document.getElementById('go-forgot');
  const goLoginBack = document.getElementById('go-login-back');

  goRegister.addEventListener('click', (e) => { e.preventDefault(); switchMode('register'); });
  goLogin.addEventListener('click', (e) => { e.preventDefault(); switchMode('login'); });
  goForgot.addEventListener('click', (e) => { e.preventDefault(); switchMode('forgot'); });
  goLoginBack.addEventListener('click', (e) => { e.preventDefault(); switchMode('login'); });

  // Form Submissions
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('register-form').addEventListener('submit', handleRegister);
  document.getElementById('forgot-form').addEventListener('submit', handleForgot);
});

async function checkLoggedIn() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    window.location.href = returnUrl;
  }
}

function switchMode(mode) {
  currentMode = mode;
  
  // Hide all headers & forms & footers
  const forms = ['login', 'register', 'forgot'];
  forms.forEach(f => {
    document.getElementById(`${f}-header`).style.display = 'none';
    document.getElementById(`${f}-form`).style.display = 'none';
    document.getElementById(`${f}-footer`).style.display = 'none';
  });

  // Show active view
  document.getElementById(`${mode}-header`).style.display = 'block';
  document.getElementById(`${mode}-form`).style.display = 'block';
  document.getElementById(`${mode}-footer`).style.display = 'block';
}

// Login
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const submitBtn = document.getElementById('login-submit-btn');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Membuka Sesi...';

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    await logActivity('signin_success', 'Pengguna berhasil sign in');

    showToast('Sign in berhasil! Mengalihkan...', 'success');
    setTimeout(() => {
      window.location.href = returnUrl;
    }, 1000);

  } catch (err) {
    console.error('Sign in error:', err);
    showToast(err.message || 'Email atau password salah.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  }
}

// Signup
async function handleRegister(e) {
  e.preventDefault();
  const fullName = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const submitBtn = document.getElementById('register-submit-btn');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Mendaftarkan...';

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (error) throw error;

    // Supabase can require email confirmation. Check if session was created automatically.
    if (data.session) {
      // Create user profile record
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .insert({
          user_id: data.user.id,
          full_name: fullName,
          role: 'user'
        });
      
      if (profileError) console.error('Profile create error:', profileError);

      showToast('Registrasi berhasil! Mengalihkan...', 'success');
      setTimeout(() => {
        window.location.href = returnUrl;
      }, 1000);
    } else {
      showToast('Registrasi berhasil! Silakan periksa kotak masuk email Anda untuk melakukan verifikasi.', 'success');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Daftar Akun';
    }

  } catch (err) {
    console.error('Register error:', err);
    showToast(err.message || 'Pendaftaran gagal. Silakan coba lagi.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Daftar Akun';
  }
}

// Forgot Password
async function handleForgot(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value;
  const submitBtn = document.getElementById('forgot-submit-btn');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Mengirim...';

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?mode=reset`
    });

    if (error) throw error;

    showToast('Tautan reset password telah dikirim ke email Anda!', 'success');
    switchMode('login');

  } catch (err) {
    console.error('Forgot password error:', err);
    showToast(err.message || 'Gagal mengirim email reset password.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Kirim Link Reset';
  }
}
