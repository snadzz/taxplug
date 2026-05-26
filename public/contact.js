const contactForm = document.getElementById('contact-form');
const successMessage = document.getElementById('contact-success');
const contactClearBtn = document.getElementById('contact-clear-btn');
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const openChatBtn = document.getElementById('open-chat-btn');
const openOvertimeBtn = document.getElementById('open-overtime-btn');
const irp5Btn = document.getElementById('irp5-btn');
const openNeedsBtn = document.getElementById('open-needs-btn');

function updateUserInfo() {
  const savedUser = JSON.parse(localStorage.getItem('authUser') || 'null');
  if (savedUser?.email) {
    userEmailSpan.textContent = `Signed in as ${savedUser.email}`;
    logoutBtn.style.display = 'inline-flex';
  } else {
    userEmailSpan.textContent = '';
    logoutBtn.style.display = 'none';
  }
}

function navigateTo(url) {
  window.location.href = url;
}

logoutBtn?.addEventListener('click', () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('authUser');
  navigateTo('index.html');
});

openChatBtn?.addEventListener('click', () => navigateTo('index.html'));
openOvertimeBtn?.addEventListener('click', () => navigateTo('Overtime-Calc.html'));
irp5Btn?.addEventListener('click', () => navigateTo('irp5-viewer.html'));
openNeedsBtn?.addEventListener('click', () => navigateTo('needs-analysis.html'));

contactForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  successMessage.style.display = 'block';
  contactForm.reset();
});

contactClearBtn?.addEventListener('click', () => {
  contactForm.reset();
  successMessage.style.display = 'none';
});

updateUserInfo();
