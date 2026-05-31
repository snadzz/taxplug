const authToken = localStorage.getItem('authToken');
const userEmail = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const openChatBtn = document.getElementById('open-chat-btn');
const openirp5Btn = document.getElementById('irp5-btn');
const openNeedsBtn = document.getElementById('open-needs-btn');
const openContactBtn = document.getElementById('open-contact-btn');
const payeForm = document.getElementById('paye-form');
const salaryInput = document.getElementById('salary-monthly');
const totalPackageInput = document.getElementById('total-package-monthly');
const overtime1Rate = document.getElementById('overtime1-rate');
const overtime1Hours = document.getElementById('Overtime1');
const overtime1TotalLabel = document.getElementById('overtime1-total');
const overtime2Rate = document.getElementById('overtime2-rate');
const overtime2Hours = document.getElementById('Overtime2');
const overtime2TotalLabel = document.getElementById('overtime2-total');
const overtime3Rate = document.getElementById('overtime3-rate');
const overtime3Hours = document.getElementById('Overtime3');
const overtime3TotalLabel = document.getElementById('overtime3-total');
const thresholdLabel = document.getElementById('threshold');
const overtimeHoursTotal = document.getElementById('overtime-hours-total');
const overtimePayTotal = document.getElementById('overtime-pay-total');
const payeResult = document.getElementById('paye-result');
let thresholdFactor = 0;
let overtimeThreshold = 22466.74;

async function init() {
  if (!authToken) {
    window.location.href = 'index.html';
    return;
  }

  if (userEmail) {
    userEmail.textContent = localStorage.getItem('userEmail') || '';
  }

  await loadThresholdConfig();
  setupEventListeners();
  updateOvertimeTotals();
}

async function loadThresholdConfig() {
  try {
    const response = await fetch('/api/config/overtime-threshold');
    if (!response.ok) return;

    const data = await response.json();
    overtimeThreshold = Number(data.threshold) || overtimeThreshold;
  } catch (error) {
    console.warn('Unable to load overtime threshold config', error);
  }
}

function setupEventListeners() {
  logoutBtn?.addEventListener('click', logout);
  openChatBtn?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
  openirp5Btn?.addEventListener('click', () => {
    window.location.href = 'irp5-viewer.html';
  });
  openNeedsBtn?.addEventListener('click', () => {
    window.location.href = 'needs-analysis.html';
  });
  openContactBtn?.addEventListener('click', () => {
    window.location.href = 'contact.html';
  });

  overtime1Rate?.addEventListener('change', updateOvertimeTotals);
  overtime1Hours?.addEventListener('input', updateOvertimeTotals);
  overtime2Rate?.addEventListener('change', updateOvertimeTotals);
  overtime2Hours?.addEventListener('input', updateOvertimeTotals);
  overtime3Rate?.addEventListener('change', updateOvertimeTotals);
  overtime3Hours?.addEventListener('input', updateOvertimeTotals);
  
  totalPackageInput?.addEventListener('input', updateOvertimeTotals);

  payeForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    calculatePAYE();
  });
}

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('is_admin');
  window.location.href = 'index.html';
}

function updateThresholdLabel() {
  const totalPackage = parseFloat(totalPackageInput?.value);

  if (!thresholdLabel) return;

  if (isNaN(totalPackage) || totalPackage === 0) {
    thresholdLabel.textContent = 'Threshold: ---';
    thresholdFactor = 0;
  } else if (totalPackage <= overtimeThreshold) {
    thresholdLabel.textContent = 'Threshold: Yes';
    thresholdFactor = 0.7;
  } else {
    thresholdLabel.textContent = 'Threshold: No';
    thresholdFactor = 1;
  }
}

function updateOvertimeTotals() {
  updateThresholdLabel();

  const rate1 = parseFloat(overtime1Rate?.value);
  const hours1 = parseFloat(overtime1Hours?.value);
  const totalPackage = parseFloat(totalPackageInput?.value);
  const hourlyRate = !isNaN(totalPackage) && totalPackage > 0 ? totalPackage / 173.36 : 0;
  const total1 = (!isNaN(rate1) && !isNaN(hours1) && hourlyRate > 0)
    ? hourlyRate * thresholdFactor * rate1 * hours1
    : 0;
  if (overtime1TotalLabel) overtime1TotalLabel.textContent = `Total: ${total1.toFixed(2)}`;

  const rate2 = parseFloat(overtime2Rate?.value);
  const hours2 = parseFloat(overtime2Hours?.value);
  const total2 = (!isNaN(rate2) && !isNaN(hours2)) ? hourlyRate * thresholdFactor *rate2 * hours2 : 0;
  if (overtime2TotalLabel) overtime2TotalLabel.textContent = `Total: ${total2.toFixed(2)}`;

  const rate3 = parseFloat(overtime3Rate?.value);
  const hours3 = parseFloat(overtime3Hours?.value);
  const total3 = (!isNaN(rate3) && !isNaN(hours3)) ? hourlyRate * thresholdFactor * rate3 * hours3 : 0;
  if (overtime3TotalLabel) overtime3TotalLabel.textContent = `Total: ${total3.toFixed(2)}`;

  const hoursTotal = [hours1, hours2, hours3].reduce((sum, h) => sum + (isNaN(h) ? 0 : h), 0);
  const payTotal = [total1, total2, total3].reduce((sum, t) => sum + t, 0);

  if (overtimeHoursTotal) overtimeHoursTotal.value = hoursTotal.toFixed(2);
  if (overtimePayTotal) overtimePayTotal.value = payTotal.toFixed(2);
  updateThresholdLabel();
}

function calculatePAYE() {
  const salary = parseFloat(salaryInput?.value);
  const totalPackage = parseFloat(totalPackageInput?.value);

  if (isNaN(salary) || salary <= 0) {
    if (payeResult) payeResult.innerHTML = '<p class="error">Please enter a valid monthly salary.</p>';
    return;
  }

  const annualSalary = salary * 12;
  let hourlyrate = salary / 173.36;
  const annualPAYE = calculateAnnualPAYE(annualSalary);
  const monthlyPAYE = annualPAYE / 12;
  const monthlyNetSalary = salary - monthlyPAYE;
  const annualNetSalary = annualSalary - annualPAYE;
  const packageInfo = !isNaN(totalPackage) && totalPackage > 0;

  if (payeResult) {
    payeResult.innerHTML = `
      <p><strong>Monthly salary (taxable):</strong> ${formatCurrency(salary)}</p>
      ${packageInfo ? `<p><strong>Total package (monthly):</strong> ${formatCurrency(totalPackage)}</p>` : ''}
      <p><strong>Estimated monthly PAYE:</strong> ${formatCurrency(monthlyPAYE)}</p>
      <p><strong>Estimated monthly take-home pay:</strong> ${formatCurrency(monthlyNetSalary)}</p>
      <p><strong>Estimated annual PAYE:</strong> ${formatCurrency(annualPAYE)}</p>
      <p><strong>Estimated annual take-home pay:</strong> ${formatCurrency(annualNetSalary)}</p>
      <p class="text-muted">This estimate uses standard PAYE brackets and a primary rebate. It does not include other deductions such as UIF, pension or medical aid.</p>
    `;
  }
}

function calculateAnnualPAYE(annualIncome) {
  const brackets = [
    { upTo: 237100, rate: 0.18, base: 0 },
    { upTo: 370500, rate: 0.26, base: 42768 },
    { upTo: 512800, rate: 0.31, base: 77362 },
    { upTo: 673000, rate: 0.36, base: 121475 },
    { upTo: 857900, rate: 0.39, base: 179147 },
    { upTo: 1892000, rate: 0.41, base: 251258 },
    { upTo: Infinity, rate: 0.45, base: 723357 }
  ];
  const primaryRebate = 17235;

  const bracket = brackets.find(b => annualIncome <= b.upTo);
  const previousBracket = brackets[brackets.indexOf(bracket) - 1];
  const lowerBound = previousBracket ? previousBracket.upTo : 0;
  const tax = bracket.base + (annualIncome - lowerBound) * bracket.rate;
  return Math.max(0, tax - primaryRebate);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 2
  }).format(value);
}

window.addEventListener('DOMContentLoaded', init);
