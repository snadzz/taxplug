const token = localStorage.getItem('authToken');
const userTable = document.getElementById('user-table');
const onlineCount = document.getElementById('online-visitors');
const visitsToday = document.getElementById('visits-today');
const thresholdValue = document.getElementById('threshold-value');
const thresholdForm = document.getElementById('threshold-form');
const thresholdInput = document.getElementById('threshold-input');
const adminEmailForm = document.getElementById('admin-email-form');
const adminEmailInput = document.getElementById('admin-email-input');
const adminList = document.getElementById('admin-list');
const backendState = document.getElementById('backend-state');
const adminError = document.getElementById('admin-error');
const adminSuccess = document.getElementById('admin-success');

function requireAdminLogin() {
  if (!token) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

async function loadAdminData() {
  try {
    const [usersResponse, statsResponse, transactionsResponse] = await Promise.all([
      fetch('/api/admin/users', {
        headers: { Authorization: 'Bearer ' + token }
      }),
      fetch('/api/admin/stats', {
        headers: { Authorization: 'Bearer ' + token }
      }),
      // 👇 NEW DB PIPELINE: Fetch global analyses from LibSQL backend instead of local machine sandboxes
      fetch('/api/admin/transactions', {
        headers: { Authorization: 'Bearer ' + token }
      }).catch(err => {
        console.warn("Transactions API fallback active:", err);
        return { ok: false };
      })
    ]);

    if (!usersResponse.ok || !statsResponse.ok) {
      throw new Error('Admin access verification failed.');
    }

    const users = await usersResponse.json();
    const stats = await statsResponse.json();

    renderUserTable(users);
    renderStats(stats);
    renderAdminEmails(stats.adminEmails);
    renderBackendState(stats);

    // Render transactions from server if endpoint exists, otherwise fallback gracefully
    if (transactionsResponse && transactionsResponse.ok) {
      const transactions = await transactionsResponse.json();
      renderAdminTransact(transactions);
    } else {
      // Fallback local option to keep existing workflow active until backend is pushed
      const fallbackData = JSON.parse(localStorage.getItem('transactTable')) || [];
      renderAdminTransact(fallbackData);
    }

  } catch (error) {
    console.error("Admin dashboard runtime error:", error);
    showAdminMessage(error.message, false);
    // window.location.href = 'index.html'; // Optional: comment back in once live checks are fully set up
  }
}

function renderUserTable(users) {
  if (!userTable) return;
  if (!users.length) {
    userTable.innerHTML = '<tr><th colspan="5">No registered users found</th></tr>';
    return;
  }

  userTable.innerHTML = `
    <tr>
      <th>ID</th>
      <th>Name</th>
      <th>Email</th>
      <th>Admin</th>
      <th>Joined</th>
    </tr>
    ${users.map(user => `
      <tr>
        <td>${user.id}</td>
        <td>${escapeHtml(user.name || '-')}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>${user.is_admin ? '<span style="color:blue; font-weight:bold;">Yes</span>' : 'No'}</td>
        <td>${user.created_at ? new Date(user.created_at).toLocaleString() : '-'}</td>
      </tr>
    `).join('')}
  `;
}

function renderStats(stats) {
  if (!onlineCount || !visitsToday || !thresholdValue) return;
  onlineCount.textContent = stats.onlineVisitors || 0;
  visitsToday.textContent = stats.visitsToday || 0;
  thresholdValue.textContent = stats.overtimeThreshold || 0;
  if (thresholdInput) thresholdInput.value = stats.overtimeThreshold || 0;
}

function renderAdminEmails(emails) {
  if (!adminList) return;
  const adminArray = emails || [];
  adminList.innerHTML = adminArray.length
    ? adminArray.map(email => `<li>${escapeHtml(email)}</li>`).join('')
    : '<li>No admin users configured yet.</li>';
}

function renderBackendState(stats) {
  if (!backendState) return;
  const adminCount = stats.adminEmails ? stats.adminEmails.length : 0;
  backendState.innerHTML = `
    <p><strong>Overtime threshold:</strong> ${stats.overtimeThreshold || 0}</p>
    <p><strong>Admin users:</strong> ${adminCount}</p>
  `;
}

function renderAdminTransact(transactions) {
  const tableBody = document.getElementById('transactTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '';

  if (!transactions || !transactions.length) {
    tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1rem; color:#64748b;">No transaction needs analyses found.</td></tr>';
    return;
  }

  transactions.forEach((item) => {
    const row = document.createElement('tr');
    
    // Safety calculations for numeric metrics parsing
    const incValue = item.totalIncome ? parseFloat(item.totalIncome) : 0;
    const expValue = item.totalExpenditure ? parseFloat(item.totalExpenditure) : 0;

    row.innerHTML = `
      <td>${escapeHtml(item.timestamp || '-')}</td>
      <td>${escapeHtml(item.name || '')} ${escapeHtml(item.surname || '')}</td>
      <td>${escapeHtml(item.cellno || '-')}</td>
      <td>${escapeHtml(item.province || '-')}</td>
      <td>R ${incValue.toLocaleString()}</td>
      <td>R ${expValue.toLocaleString()}</td>
      <td>${item.advisorCallback ? '<span style="color:green; font-weight:bold;">YES</span>' : 'No'}</td>
      <td>
        <button class="action-btn edit-btn" onclick="globalEditTransaction('${item.transactionId}')">Edit</button>
        <button class="action-btn delete-btn" onclick="globalDeleteTransaction('${item.transactionId}')">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

// =========================================================================
// GLOBAL BINDING INTERFACE RULES (Solves Modular Execution Errors)
// =========================================================================
window.globalEditTransaction = function(transactionId) {
  console.log("Editing user analysis record profile target:", transactionId);
  // Add edit modal interaction workflow logic here
};

window.globalDeleteTransaction = async function(transactionId) {
  if (!confirm("Are you sure you want to completely delete this evaluation transaction?")) return;
  
  try {
    const response = await fetch(`/api/admin/transactions/${transactionId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token }
    });
    
    if (response.ok) {
      showAdminMessage("Analysis transaction purged securely from records.", true);
      loadAdminData();
    } else {
      // Local storage fallback sync
      let transactions = JSON.parse(localStorage.getItem('transactTable')) || [];
      transactions = transactions.filter(t => t.transactionId !== transactionId);
      localStorage.setItem('transactTable', JSON.stringify(transactions));
      showAdminMessage("Purged from local sandbox tracking cache.", true);
      loadAdminData();
    }
  } catch (err) {
    showAdminMessage("Failed to execute item cleanup request tracking parameters.", false);
  }
};

// =========================================================================
// EVENT HANDLERS & FORMS ACTIVATION
// =========================================================================
thresholdForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const value = parseFloat(thresholdInput.value);
  if (Number.isNaN(value) || value < 0) {
    showAdminMessage('Please enter a valid threshold value.', false);
    return;
  }

  try {
    const response = await fetch('/api/admin/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ overtimeThreshold: value })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to update threshold');

    showAdminMessage('Overtime threshold configuration adjusted successfully.', true);
    loadAdminData();
  } catch (error) {
    showAdminMessage(error.message, false);
  }
});

adminEmailForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = adminEmailInput.value.trim();
  if (!email) {
    showAdminMessage('Please enter a valid target email address.', false);
    return;
  }

  try {
    const response = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ email })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to promote user credentials');

    adminEmailInput.value = '';
    showAdminMessage(`User framework for ${email} expanded with master access.`, true);
    loadAdminData();
  } catch (error) {
    showAdminMessage(error.message, false);
  }
});

function showAdminMessage(message, success) {
  if (!adminError || !adminSuccess) return;
  adminError.textContent = '';
  adminSuccess.textContent = '';
  if (success) {
    adminSuccess.textContent = message;
  } else {
    adminError.textContent = message;
  }
}

// XSS Sanitizer Prevention Utility Rule
function escapeHtml(string) {
  return String(string).replace(/[&<>"']/g, function (s) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s];
  });
}

// Handle initialization sequence cleanly
window.addEventListener('DOMContentLoaded', () => {
  if (requireAdminLogin()) {
    loadAdminData();
  }
});