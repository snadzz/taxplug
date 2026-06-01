// IRP5 Codes Reference Page - Search and Navigation
const authToken = localStorage.getItem('authToken');

// Auth guard: redirect if not logged in
if (!authToken) {
  window.location.href = 'index.html';
}

const defaultCodes = [
  { code: '3601', description: 'Income (Taxable)' },
  {code: '3605', description: 'Annual Payment (Taxable)' },
  { code: '3607', description: 'Overtime (Subject to PAYE)' },
  {code: '3713', description: 'Restraint Of Trade' },
  {code: '3808' , description: "Payment of Employee's Debt'" },
  { code: '3701', description: 'Travel allowance (Subject to PAYE)'},
   {code: '3810' , description: 'Medical Scheme Fees Fringe Benefit' },
    { code: '3696', description: 'Gross Non-taxable Income'}, 
    {code: '3706' , description: 'Entertainment Allowance' },
  { code: '3801', description: 'Fringe benefits' }
];

let allCodes = [];

// DOM elements
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const clearBtn = document.getElementById('clear-btn');
const searchMode = document.getElementById('search-mode');
const codesTableBody = document.getElementById('codes-tbody');
const resultsCount = document.getElementById('results-count');
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const backChatBtn = document.getElementById('back-chat-btn');
const backOvertimeBtn = document.getElementById('back-overtime-btn');
const openNeedsBtn = document.getElementById('open-needs-btn');
const openContactBtn = document.getElementById('open-contact-btn');

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadUserEmail();
  loadCodes();
  setupEventListeners();
});

// Load and display user email
function loadUserEmail() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.email) {
      userEmailSpan.textContent = user.email;
    }
  } catch (e) {
    console.error('Error loading user email:', e);
  }
}

// Load codes into the page without any external file dependency
function loadCodes() {
  // Prefer a static data file placed at public/data/form-codes.json
  fetch('/data/form-codes.json')
    .then(resp => {
      if (!resp.ok) throw new Error('Missing data file');
      return resp.json();
    })
    .then(data => {
      let entries = [];
      if (Array.isArray(data)) {
        entries = data;
      } else if (typeof data === 'object' && data !== null) {
        const arrays = Object.values(data).filter(v => Array.isArray(v));
        entries = arrays.reduce((acc, arr) => acc.concat(arr), []);
      }

      allCodes = entries.map(item => ({
        code: String(item.code || item.Code || '').trim(),
        description: String(item.description || item.Description || item.explanation || '').trim(),
        explanation: String(item.explanation || item.Explanation || '').trim()
      })).filter(item => item.code || item.description);

      if (allCodes.length === 0) {
        console.warn('Loaded form-codes.json but found no entries; using defaultCodes.');
        allCodes = [...defaultCodes];
      }
      displayAllCodes();
      updateResultsCount(allCodes.length);
    })
    .catch(err => {
      console.warn('Could not load form-codes.json, using defaultCodes', err);
      allCodes = [...defaultCodes];
      displayAllCodes();
      updateResultsCount(allCodes.length);
    });
}

// Display all codes in table
function displayAllCodes() {
  if (allCodes.length === 0) {
    codesTableBody.innerHTML = `
      <tr>
        <td colspan="2" class="no-results">
          No codes available. Please check back later.
        </td>
      </tr>
    `;
    return;
  }

  const html = allCodes.map(item => `
    <tr>
      <td class="code-col">${escapeHtml(item.code)}</td>
      <td class="description-col">${escapeHtml(item.description)}</td>
    </tr>
  `).join('');

  codesTableBody.innerHTML = html;
}

// Search and filter codes
function performSearch() {
  const query = searchInput.value.trim().toLowerCase();

  if (!query) {
    displayAllCodes();
    updateResultsCount(allCodes.length);
    return;
  }

  const mode = (searchMode?.value || 'both');
  const filtered = allCodes.filter(item => {
    const codeMatch = item.code.toLowerCase().includes(query);
    const descMatch = item.description.toLowerCase().includes(query);
    if (mode === 'code') return codeMatch;
    if (mode === 'description') return descMatch;
    return codeMatch || descMatch;
  });

  if (filtered.length === 0) {
    codesTableBody.innerHTML = `
      <tr>
        <td colspan="2" class="no-results">
          No codes found matching "${escapeHtml(query)}". Try a different search.
        </td>
      </tr>
    `;
  } else {
    const html = filtered.map(item => {
      const highlightCode = highlightMatch(item.code, query);
      const highlightDesc = highlightMatch(item.description, query);
      // include data-explanation for potential future use (tooltip/panel)
      return `
        <tr class="highlight" data-explanation="${escapeHtml(item.explanation || '')}">
          <td class="code-col">${highlightCode}</td>
          <td class="description-col">${highlightDesc}</td>
        </tr>
      `;
    }).join('');
    codesTableBody.innerHTML = html;
  }

  updateResultsCount(filtered.length);
}

// Highlight search matches in text
function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);

  const regex = new RegExp(`(${query})`, 'gi');
  const highlighted = escapeHtml(text).replace(regex, '<mark style="background: #fffbea; font-weight: 600;">$1</mark>');
  return highlighted;
}

// Update results count display
function updateResultsCount(count) {
  resultsCount.textContent = `Found ${count} code${count !== 1 ? 's' : ''}`;
}

// Clear search
function clearSearch() {
  searchInput.value = '';
  displayAllCodes();
  updateResultsCount(allCodes.length);
  searchInput.focus();
}

// Setup event listeners
function setupEventListeners() {
  searchBtn?.addEventListener('click', performSearch);
  clearBtn?.addEventListener('click', clearSearch);
  searchMode?.addEventListener('change', () => {
    if (searchInput.value.trim()) performSearch();
  });

  // Live search as user types
  searchInput?.addEventListener('input', performSearch);

  // Alternative: Enter key for search (already covered by input event)
  searchInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });

  // Navigation buttons
  logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  });

  backChatBtn?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  openNeedsBtn?.addEventListener('click', () => {
    window.location.href = 'needs-analysis.html';
  });

  openContactBtn?.addEventListener('click', () => {
    window.location.href = 'contact.html';
  });

  backOvertimeBtn?.addEventListener('click', () => {
    window.location.href = 'Overtime-Calc.html';
  });
}

// Escape HTML special characters
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}
