// public/irp5-viewer.js

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let formCodes = {};
let scale = 1.5;

// DOM Elements
const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');
const pdfWrapper = document.getElementById('pdf-wrapper');
const pdfStatus = document.getElementById('pdf-status');
const pdfError = document.getElementById('pdf-error');
const tooltip = document.getElementById('tooltip');
const codeInfoPanel = document.getElementById('code-info-panel');
const backBtn = document.getElementById('back-btn');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const currentPageSpan = document.getElementById('current-page');
const totalPagesSpan = document.getElementById('total-pages');

const openNeedsBtn = document.getElementById('open-needs-btn');
const openContactBtn = document.getElementById('open-contact-btn');

// Get auth token
function getAuthToken() {
  return localStorage.getItem('authToken');
}

// Initialize
async function init() {
  try {
    // Load form codes
    await loadFormCodes();
    
    // Load PDF
    await loadPDF();
    
    // Render first page
    await renderPage(1);
  } catch (error) {
    console.error('Initialization error:', error);
    showError('Failed to initialize form viewer');
  }
}

// Load form codes from backend
async function loadFormCodes() {
  try {
    const token = getAuthToken();
    const response = await fetch('/api/qa/form-codes', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to load codes');
    formCodes = await response.json();
    console.log(`Loaded ${Object.keys(formCodes).length} form codes`);
  } catch (error) {
    console.error('Error loading form codes:', error);
    showError('Could not load code descriptions');
  }
}

// Load PDF from server
async function loadPDF() {
  try {
    const token = getAuthToken();
    const response = await fetch('/api/qa/irp5-pdf', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to load PDF');
    
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    // Load PDF document
    pdfDoc = await pdfjsLib.getDocument(url).promise;
    totalPages = pdfDoc.numPages;
    totalPagesSpan.textContent = totalPages;
    
    pdfStatus.style.display = 'none';
    pdfWrapper.style.display = 'flex';
  } catch (error) {
    console.error('Error loading PDF:', error);
    showError('Failed to load IRP5 form. Please ensure the file exists.');
  }
}

// Render a specific page
async function renderPage(pageNum) {
  if (!pdfDoc || pageNum < 1 || pageNum > totalPages) return;
  
  try {
    currentPage = pageNum;
    currentPageSpan.textContent = currentPage;
    
    // Update button states
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
    
    const page = await pdfDoc.getPage(pageNum);
    
    // Set canvas size
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Render page
    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;
    
    // Add interactive hotspots for codes
    await addCodeHotspots(page, viewport);
  } catch (error) {
    console.error('Error rendering page:', error);
    showError('Failed to render page');
  }
}

// Add interactive code hotspots to the page
async function addCodeHotspots(page, viewport) {
  // Get text content to find code positions
  try {
    const textContent = await page.getTextContent();
    
    // Clear existing hotspots
    const existingHotspots = canvas.parentElement.querySelectorAll('.code-hotspot');
    existingHotspots.forEach(h => h.remove());
    
    // Create hotspots for each detected code
    textContent.items.forEach(item => {
      const text = item.str.trim();
      
      // Check if this text is a form code (typically 1-3 letters/numbers)
      if (isFormCode(text) && formCodes[text]) {
        createHotspot(item, text, viewport);
      }
    });
  } catch (error) {
    console.error('Error adding hotspots:', error);
  }
}

// Check if text is likely a form code
function isFormCode(text) {
  return /^[A-Z0-9]{1,3}$/.test(text) && Object.keys(formCodes).some(code => 
    code.toUpperCase() === text.toUpperCase()
  );
}

// Create a hotspot div for a code
function createHotspot(item, code, viewport) {
  const hotspot = document.createElement('div');
  hotspot.className = 'code-hotspot';
  hotspot.dataset.code = code;
  hotspot.title = `Click for code: ${code}`;
  
  // Position based on text item
  const x = item.x;
  const y = viewport.height - item.y - item.height;
  const width = Math.max(item.width, 30);
  const height = item.height + 4;
  
  hotspot.style.left = x + 'px';
  hotspot.style.top = y + 'px';
  hotspot.style.width = width + 'px';
  hotspot.style.height = height + 'px';
  
  // Add hover events
  hotspot.addEventListener('mouseenter', (e) => showTooltip(e, code));
  hotspot.addEventListener('mouseleave', hideTooltip);
  
  canvas.parentElement.appendChild(hotspot);
}

// Show tooltip with code description
function showTooltip(event, code) {
  const description = formCodes[code.toUpperCase()];
  if (!description) return;
  
  const rect = event.target.getBoundingClientRect();
  const tooltipWidth = 250;
  
  // Position tooltip
  let left = rect.left + rect.width / 2 - tooltipWidth / 2;
  let top = rect.top - 10; // Above the hotspot
  
  // Keep tooltip in viewport
  if (left < 10) left = 10;
  if (left + tooltipWidth > window.innerWidth) left = window.innerWidth - tooltipWidth - 10;
  if (top < 10) top = rect.bottom + 10; // Move below if near top
  
  tooltip.textContent = `${code}: ${description}`;
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
  tooltip.classList.add('visible');
  
  // Show info panel
  showCodeInfo(code, description);
}

// Hide tooltip
function hideTooltip() {
  tooltip.classList.remove('visible');
  codeInfoPanel.style.display = 'none';
}

// Show code info in side panel
function showCodeInfo(code, description) {
  document.getElementById('code-label').textContent = `Code: ${code}`;
  document.getElementById('code-description').textContent = description;
  codeInfoPanel.style.display = 'block';
}

// Show error message
function showError(message) {
  pdfError.textContent = message;
  pdfError.style.display = 'block';
  pdfStatus.style.display = 'none';
}

// Button event listeners
backBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});
openNeedsBtn?.addEventListener('click', () => {
  window.location.href = 'needs-analysis.html';
});

openContactBtn?.addEventListener('click', () => {
  window.location.href = 'contact.html';
});

prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) renderPage(currentPage - 1);
});

nextPageBtn.addEventListener('click', () => {
  if (currentPage < totalPages) renderPage(currentPage + 1);
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') prevPageBtn.click();
  if (e.key === 'ArrowRight') nextPageBtn.click();
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
