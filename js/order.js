// Order Detail Page Script
document.addEventListener('DOMContentLoaded', async () => {
  // Extract order ID from query parameter id
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');

  if (!orderId) {
    showError();
    return;
  }

  // Load order details
  try {
    const { data: order, error } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      throw new Error('Order not found');
    }

    // Populate data
    document.getElementById('order-subtitle').textContent = `Invoice ID: ${order.id}`;
    document.getElementById('order-package').textContent = order.package_name;
    document.getElementById('order-date').textContent = new Date(order.created_at).toLocaleDateString('id-ID', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Status badge
    const badge = document.getElementById('order-status-badge');
    badge.textContent = order.status.toUpperCase();
    badge.className = `status-badge ${order.status}`;

    // Customer Info
    document.getElementById('cust-name-val').textContent = order.customer_name;
    document.getElementById('cust-email-val').textContent = order.customer_email;
    document.getElementById('cust-phone-val').textContent = order.customer_phone || '-';

    // Payment Info
    document.getElementById('pay-method-val').textContent = order.payment_method || 'Belum dipilih';
    document.getElementById('pay-time-val').textContent = order.paid_at 
      ? new Date(order.paid_at).toLocaleString('id-ID') 
      : 'Belum lunas';
    
    // Invoice link
    const invoiceVal = document.getElementById('pay-invoice-val');
    if (order.status === 'pending' && order.xendit_invoice_url) {
      invoiceVal.innerHTML = `<a href="${order.xendit_invoice_url}" target="_blank" style="color: var(--primary); text-decoration: none;">Link Pembayaran &rarr;</a>`;
    } else if (order.xendit_invoice_url) {
      invoiceVal.innerHTML = `<a href="${order.xendit_invoice_url}" target="_blank" style="color: var(--muted); text-decoration: none;">Lihat Invoice asli</a>`;
    } else {
      invoiceVal.textContent = '-';
    }

    // Total Amount
    document.getElementById('order-amount-val').textContent = formatPrice(order.amount);

    // Toggle views
    document.getElementById('order-loading').style.display = 'none';
    document.getElementById('order-content').style.display = 'block';

  } catch (err) {
    console.error('Error loading order details:', err);
    showError();
  }

  // Print button listener
  const printBtn = document.getElementById('btn-print-receipt');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }
});

function showError() {
  document.getElementById('order-loading').style.display = 'none';
  document.getElementById('order-content').style.display = 'none';
  document.getElementById('order-error').style.display = 'block';
}
