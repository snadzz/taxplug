// public/app.js
const API_BASE = '/api';
let authToken = localStorage.getItem('authToken');
let currentSources = [];

// DOM Elements
const authSection = document.getElementById('auth-section');
const chatSection = document.getElementById('chat-section');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const questionForm = document.getElementById('question-form');
const chatMessages = document.getElementById('chat-messages');
const questionInput = document.getElementById('question-input');
const sourcesPanel = document.getElementById('sources-panel');
const sourcesList = document.getElementById('sources-list');
const authError = document.getElementById('auth-error');
const userEmail = document.getElementById('user-email');
const openOvertimeBtn = document.getElementById('open-overtime-btn');
const openNeedsBtn = document.getElementById('open-needs-btn');
const openContactBtn = document.getElementById('open-contact-btn');
const openAdminBtn = document.getElementById('open-admin-btn');
const adminLink = document.getElementById('admin-link');
const chatPanel = document.getElementById('chat-panel');

// New Password Recovery UI Elements
const forgotPasswordSection = document.getElementById('forgot-password-section');
const forgotEmailForm = document.getElementById('forgot-email-form');
const forgotResetForm = document.getElementById('forgot-reset-form');
const toForgotViewBtn = document.getElementById('to-forgot-view');
const backToLoginBtn = document.getElementById('back-to-login');
const forgotEmailInput = document.getElementById('forgot-email');
const forgotCodeInput = document.getElementById('forgot-code');
const forgotNewPasswordInput = document.getElementById('forgot-new-password');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // If the user lands on the registration/login views but has a valid active token session
  if (authToken && window.location.pathname.endsWith('login.html')) {
    window.location.href = 'chat.html'; // Direct them instantly to their active canvas
    return;
  }

  // If the user tries to load the chat view without being logged in
  if (!authToken && window.location.pathname.endsWith('chat.html')) {
    window.location.href = 'login.html'; // Force security portal check redirection
    return;
  }

  if (authToken) {
    loadUserInfo();
  }
  setupEventListeners();
});

function setupEventListeners() {
  // Auth tabs
  document.querySelectorAll('#auth-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#auth-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const tabName = tab.dataset.tab;
      if (loginForm) loginForm.classList.toggle('hidden', tabName !== 'login');
      if (registerForm) registerForm.classList.toggle('hidden', tabName !== 'register');
      if (forgotPasswordSection) forgotPasswordSection.classList.add('hidden'); 
      if (authError) authError.textContent = '';
    });
  });

  // Toggle Visibility: Into Password Reset wizard state
  toForgotViewBtn?.addEventListener('click', () => {
    if (loginForm) loginForm.classList.add('hidden');
    if (registerForm) registerForm.classList.add('hidden');
    if (forgotPasswordSection) {
      forgotPasswordSection.classList.remove('hidden');
      forgotEmailForm?.classList.remove('hidden');
      forgotResetForm?.classList.add('hidden');
    }
    if (authError) authError.textContent = '';
  });

  // Toggle Visibility: Exit Wizard back to normal login state
  backToLoginBtn?.addEventListener('click', () => {
    if (forgotPasswordSection) forgotPasswordSection.classList.add('hidden');
    if (loginForm) loginForm.classList.remove('hidden');
    if (authError) authError.textContent = '';
    
    // Set login tab state visually back to active
    document.querySelectorAll('#auth-tabs .tab').forEach(t => t.classList.remove('active'));
    document.querySelector('#auth-tabs .tab[data-tab="login"]')?.classList.add('active');
  });

  // Forgot Password Step 1: Submit email to request a random verification token code
  forgotEmailForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (authError) authError.textContent = '';
    const email = forgotEmailInput?.value.trim();

    try {
      const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send recovery code.');
      }

      // Success: Proceed to validation code input state
      forgotEmailForm.classList.add('hidden');
      forgotResetForm?.classList.remove('hidden');
    } catch (error) {
      if (authError) authError.textContent = error.message;
    }
  });

  // Forgot Password Step 2: Validate token code and apply the new password changes
  forgotResetForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (authError) authError.textContent = '';
    const email = forgotEmailInput?.value.trim();
    const token = forgotCodeInput?.value.trim();
    const newPassword = forgotNewPasswordInput?.value;

    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, newPassword })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update your password.');
      }

      alert('Password changed successfully! You can now log in.');
      if (forgotEmailInput) forgotEmailInput.value = '';
      if (forgotCodeInput) forgotCodeInput.value = '';
      if (forgotNewPasswordInput) forgotNewPasswordInput.value = '';
      backToLoginBtn?.click();
    } catch (error) {
      if (authError) authError.textContent = error.message;
    }
  });

  // Login
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    await authenticate('/auth/login', {
      email: formData.get('email'),
      password: formData.get('password')
    });
  });

  // Register
  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(registerForm);
    await authenticate('/auth/register', {
      name: formData.get('name'),
      cellno: formData.get('cellno'),
      addressLine1: formData.get('addressLine1'),
      addressLine2: formData.get('addressLine2'),
      province: formData.get('province'),
      country: formData.get('country'),
      email: formData.get('email'),
      password: formData.get('password')
    });
  });

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn?.addEventListener('click', logout);

  // IRP5 Form Viewer
  const irp5Btn = document.getElementById('irp5-btn');
  irp5Btn?.addEventListener('click', () => {
    window.location.href = 'irp5-viewer.html';
  });

  // Question submission
  questionForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitQuestion();
  });

  // Enter to submit (Shift+Enter for new line)
  questionInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitQuestion();
    }
  });

  openOvertimeBtn?.addEventListener('click', () => {
    window.location.href = 'Overtime-Calc.html';
  });

  openNeedsBtn?.addEventListener('click', () => {
    window.location.href = 'needs-analysis.html';
  });

  openContactBtn?.addEventListener('click', () => {
    window.location.href = 'contact.html';
  });

  openAdminBtn?.addEventListener('click', () => {
    window.location.href = 'admin.html';
  });

  // Close sources panel
  const closeSourcesBtn = document.getElementById('close-sources');
  closeSourcesBtn?.addEventListener('click', () => {
    sourcesPanel?.classList.add('hidden');
  });
}

async function authenticate(endpoint, data) {
  try {
    if (authError) authError.textContent = '';
    const response = await fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Authentication failed');
    }

    authToken = result.token;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('userEmail', result.user.email);
    const isAdmin = result.user?.is_admin === 1 || result.user?.is_admin === '1' || result.user?.is_admin === true;
    localStorage.setItem('is_admin', isAdmin ? '1' : '0');
    
    showChat();
    loadUserInfo();
    
    return result;
  } catch (error) {
    if (authError) authError.textContent = error.message;
    return null;
  }
}

function logout() {
  authToken = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('is_admin');
  
  const adminLink = document.getElementById('admin-link');
  if (adminLink) {
    adminLink.classList.add('hidden');
  }
  
  showAuth();
}

function showAuth() {
  // Instead of shifting layout classes, bounce the window to the security form view
  if (!window.location.pathname.endsWith('login.html')) {
    window.location.href = 'login.html';
  }
}

function showChat() {
  // If we just authenticated inside login.html, route straight to chat space canvas
  if (window.location.pathname.endsWith('login.html')) {
    // Check if the user came from a specific home-page feature link target parameters string
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    
    if (redirect === 'overtime') {
      window.location.href = 'Overtime-Calc.html';
    } else if (redirect === 'needs') {
      window.location.href = 'needs-analysis.html';
    } else {
      window.location.href = 'chat.html'; // Route to core console workspace page
    }
  }
}
  


function loadUserInfo() {
  const email = localStorage.getItem('userEmail');
  const isAdmin = localStorage.getItem('is_admin') === '1';
  
  if (email && userEmail) {
    userEmail.textContent = email;
  }

  if (adminLink) {
    adminLink.classList.toggle('hidden', !isAdmin);
  }
  if (openAdminBtn) {
    openAdminBtn.classList.toggle('hidden', !isAdmin);
  }
}

async function submitQuestion() {
  if (!questionInput) return;
  const question = questionInput.value.trim();
  if (!question) return;

  addMessage(question, 'user');
  questionInput.value = '';

  const loadingEl = addLoading();

  try {
    const response = await fetch(API_BASE + '/qa/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ question })
    });

    if (response.status === 401 || response.status === 403) {
      logout();
      return;
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to get answer');
    }

    loadingEl.remove();
    addMessage(result.answer, 'assistant', result.sources);
  } catch (error) {
    loadingEl.remove();
    addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
    console.error('Question error:', error);
  }
}

function addMessage(content, role, sources = null) {
  if (!chatMessages) return;
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  const formattedContent = formatContent(content);
  contentDiv.innerHTML = formattedContent;

  if (sources && sources.length > 0) {
    const sourcesLink = document.createElement('span');
    sourcesLink.className = 'sources-link';
    sourcesLink.textContent = `View ${sources.length} source(s)`;
    sourcesLink.addEventListener('click', () => showSources(sources));
    contentDiv.appendChild(sourcesLink);
  }

  messageDiv.appendChild(contentDiv);
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatContent(content) {
  return content
    .replace(/\*\*(.*?)\*\"/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

function addLoading() {
  if (!chatMessages) return null;
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message assistant';
  loadingDiv.innerHTML = `
    <div class="message-content">
      <div class="loading">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  chatMessages.appendChild(loadingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return loadingDiv;
}

function showSources(sources) {
  if (!sourcesList || !sourcesPanel) return;
  sourcesList.innerHTML = sources.map(source => `
    <div class="source-item">
      <strong>${source.file}</strong>
      ${source.section ? `<span>${source.section}</span>` : ''}
      <br>
      <small>Relevance: ${source.relevance}%</small>
    </div>
  `).join('');
  
  sourcesPanel.classList.remove('hidden');
}