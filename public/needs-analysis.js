const authToken = localStorage.getItem('authToken');
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const openChatBtn = document.getElementById('open-chat-btn');
const openOvertimeBtn = document.getElementById('open-overtime-btn');
const irp5Btn = document.getElementById('irp5-btn');
const openContactBtn = document.getElementById('open-contact-btn');
const goalOptions = document.querySelectorAll('#goal-options .option-card');
const goalDetailCard = document.getElementById('goal-detail-card');
const goalDetailOptions = document.getElementById('goal-detail-options');
const nextStepBtn = document.getElementById('next-step-btn');
const previousStepBtn = document.getElementById('previous-step-btn');
const submitAnalysisBtn = document.getElementById('submit-analysis-btn');
const step1Card = document.getElementById('step-1-card');
const step2Card = document.getElementById('step-2-card');
const summaryCard = document.getElementById('analysis-summary');
const summaryList = document.getElementById('summary-list');

const goalDetails = {
  investment: [
    'Short term Goal',
    'Educational cover',
    'Long-Term Goal',
    'Rainy Day'
  ],
  retirement: [
    'Retirement Annuity',
    'Retirement Reevaulation',
    'Retirement Planning'
  ],
  insurance: [
    'Car Insurance',
    'Funeral Cover',
    'Medical Insurance',
    'Life Cover',
    'Other'
  ],
  'financial-health': [
    'Budget',
    'Debt Review'
  ]
};

const formFields = [
  'gross-salary', 'net-salary', 'rental-income', 'interest-dividends', 'supplemental-income',
  'bond', 'rates', 'electricity', 'home-insurance',
  'car-repayment', 'car-insurance', 'monthly-petrol',
  'child-maintenance', 'school-fees', 'extra-mural',
  'groceries', 'clothing-account', 'cellphone-contract', 'entertainment', 'health-club'
];

let selectedGoal = null;
let selectedDetail = null;

window.addEventListener('DOMContentLoaded', () => {
  if (!authToken) {
    window.location.href = 'index.html';
    return;
  }

  if (userEmailSpan) {
    userEmailSpan.textContent = localStorage.getItem('userEmail') || '';
  }

  setupEventListeners();
});

function setupEventListeners() {
  logoutBtn?.addEventListener('click', logout);
  openChatBtn?.addEventListener('click', () => window.location.href = 'index.html');
  openOvertimeBtn?.addEventListener('click', () => window.location.href = 'Overtime-Calc.html');
  irp5Btn?.addEventListener('click', () => window.location.href = 'irp5-viewer.html');
  openContactBtn?.addEventListener('click', () => window.location.href = 'contact.html');

  goalOptions.forEach(card => {
    const radio = card.querySelector('input[type="radio"]');
    card.addEventListener('click', () => {
      radio.checked = true;
      handleGoalSelection(radio.value, card);
    });
    radio.addEventListener('change', () => handleGoalSelection(radio.value, card));
  });

  nextStepBtn?.addEventListener('click', goToStepTwo);
  previousStepBtn?.addEventListener('click', goToStepOne);

}

submitAnalysisBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    const currentUser = JSON.parse(localStorage.getItem('authUser') || 'null');
   
    if (!currentUser) {
      alert('User not authenticated. Please log in again.');
      logout();
      return;
    }

      const Ti = computeTotals.totalIncome || 0;
      const Te = computeTotals.totalExpenses || 0;
      const Di = computeTotals.discretionary || 0;

      const transactionData = {
        transactionId: `txn_${Date.now()}`,
        timestamp: new Date().toLocaleDateString(),

        name: currentUser.name || 'Unknown User',
        surname: currentUser.surname || '',
        cellno: currentUser.cellno || '',
        province: currentUser.province || '',
        email: currentUser.email || '',

        totalIncome: Ti,
        totalExpenses: Te,
        discretionaryIncome: Di
      }        
      const userWantsCallback = confirm('Do you want to submit your analysis and request a callback from our financial advisors?');

      transactionData.advisorCallback = userWantsCallback

      try { 
        let transactTable = JSON.parse(localStorage.getItem('transactTable') || '[]');
        transactTable.push(transactionData);
        localStorage.setItem('transactTable', JSON.stringify(transactTable));
        alert("Financial assessment submitted successfully! Our team will review your information and get back to you shortly.");
      } catch (error) {
        console.error('Error saving transaction data:', error);
        alert("Could not process transaction data.")
      }
  });

function handleGoalSelection(goal, card) {
  selectedGoal = goal;
  selectedDetail = null;
  goalOptions.forEach(item => item.classList.toggle('active', item === card));
  renderGoalDetails(goal);
  step1Card.querySelector('#goal-help').textContent = 'Now choose a specific objective below.';
}

function renderGoalDetails(goal) {
  const options = goalDetails[goal] || [];
  goalDetailOptions.innerHTML = '';

  if (options.length === 0) {
    goalDetailCard.style.display = 'none';
    return;
  }

  goalDetailCard.style.display = 'block';
  options.forEach(detail => {
    const label = document.createElement('label');
    label.className = 'option-card';
    label.innerHTML = `
      <input type="radio" name="goalDetail" value="${detail}">
      <span>${detail}</span>
    `;
    const radio = label.querySelector('input[type="radio"]');
    label.addEventListener('click', () => {
      radio.checked = true;
      selectedDetail = detail;
      goalDetailOptions.querySelectorAll('.option-card').forEach(card => card.classList.toggle('active', card === label));
    });
    radio.addEventListener('change', () => {
      selectedDetail = detail;
      goalDetailOptions.querySelectorAll('.option-card').forEach(card => card.classList.toggle('active', card === label));
    });
    goalDetailOptions.appendChild(label);
  });
}

function goToStepTwo() {
  if (!selectedGoal || !selectedDetail) {
    alert('Please select a financial goal and a specific objective before continuing.');
    return;
  }

  step1Card.style.display = 'none';
  step2Card.style.display = 'block';
  summaryCard.style.display = 'none';
}

function goToStepOne() {
  step1Card.style.display = 'block';
  step2Card.style.display = 'none';
  summaryCard.style.display = 'none';
}

function showSummary() {
  const values = formFields.map(id => {
    const element = document.getElementById(id);
    return {
      label: element?.previousElementSibling?.textContent || element?.id.replace(/-/g, ' '),
      value: element?.value || '0'
    };
  });

  summaryList.innerHTML = `
    <li><strong>Financial goal:</strong> ${selectedGoal}</li>
    <li><strong>Selected objective:</strong> ${selectedDetail}</li>
    ${values.map(item => `<li><strong>${item.label}:</strong> ${item.value}</li>`).join('')}
  `;

  summaryCard.style.display = 'block';
  window.scrollTo({ top: summaryCard.offsetTop - 20, behavior: 'smooth' });
}

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('is_admin');
  window.location.href = 'index.html';
}
