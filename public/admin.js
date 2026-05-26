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
    const [usersResponse, statsResponse] = await Promise.all([
      fetch('/api/admin/users', {
        headers: { Authorization: 'Bearer ' + token }
      }),
      fetch('/api/admin/stats', {
        headers: { Authorization: 'Bearer ' + token }
      })
    ]);

    if (!usersResponse.ok || !statsResponse.ok) {
      throw new Error('Admin access is required.');
    }

    const users = await usersResponse.json();
    const stats = await statsResponse.json();

    renderUserTable(users);
    renderStats(stats);
    renderAdminEmails(stats.adminEmails);
    renderBackendState(stats);
  } catch (error) {
    console.error(error);
    window.location.href = 'index.html';
  }
}



function renderUserTable(users) {
  if (!userTable) return;
  if (!users.length) {
    userTable.innerHTML = '<tr><th>No registered users found</th></tr>';
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
        <td>${user.name || '-'}</td>
        <td>${user.email}</td>
        <td>${user.is_admin ? 'Yes' : 'No'}</td>
        <td>${new Date(user.created_at).toLocaleString()}</td>
      </tr>
    `).join('')}
  `;
}


function renderStats(stats) {
  if (!onlineCount || !visitsToday || !thresholdValue) return;
  onlineCount.textContent = stats.onlineVisitors;
  visitsToday.textContent = stats.visitsToday;
  thresholdValue.textContent = stats.overtimeThreshold;
  thresholdInput.value = stats.overtimeThreshold;
}

document.addEventListener('DOMContentLoaded', renderAdminTransact);

function renderAdminEmails(emails) {
  if (!adminList) return;
  adminList.innerHTML = emails.length
    ? emails.map(email => `<li>${email}</li>`).join('')
    : '<li>No admin users configured yet.</li>';
}

function renderBackendState(stats) {
  if (!backendState) return;
  backendState.innerHTML = `
    <p><strong>Overtime threshold:</strong> ${stats.overtimeThreshold}</p>
    <p><strong>Admin users:</strong> ${stats.adminEmails.length}</p>
  `;
}

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
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ overtimeThreshold: value })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to update threshold');

    thresholdValue.textContent = result.overtimeThreshold;
    thresholdInput.value = result.overtimeThreshold;
    showAdminMessage('Overtime threshold updated successfully.', true);
    loadAdminData();
  } catch (error) {
    showAdminMessage(error.message, false);
  }
});

adminEmailForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = adminEmailInput.value.trim();
  if (!email) {
    showAdminMessage('Please enter an email address.', false);
    return;
  }

  try {
    const response = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ email })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to promote user');

    adminEmailInput.value = '';
    showAdminMessage(`User ${email} is now an admin.`, true);
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

window.addEventListener('DOMContentLoaded', () => {
  if (requireAdminLogin()) {
    loadAdminData();
  }
});

function renderAdminTransact(){
    const tableBody = document.getElementById('transactTableBody');
    if(!tableBody) return;

    tableBody.innerHTML = '';

    const transactions = JSON.parse(localStorage.getItem('transactTable')) || [];

    transactions.forEach((item) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.timestamp}</td>
            <td>${item.name} ${item.surname}</td>
            <td>${item.cellno}</td>
            <td>${item.province}</td>
            <td>R ${item.totalIncome.toLocaleString()}</td>
            <td>R ${item.totalExpenditure.toLocaleString()}</td>
            <td>${item.advisorCallback ? '<span style="color:green; font-weight:bold;">YES</span>' : 'No'}</td>
            <td>
                <button class="action-btn edit-btn" onclick="editTransaction('${item.transactionId}')">Edit</button>
                <button class="action-btn delete-btn" onclick="deleteTransaction('${item.transactionId}')">Delete</button>
            </td>
            `;
        tableBody.appendChild(row);
    });
}