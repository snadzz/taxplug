async function trackVisitor() {
  try {
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    });
  } catch (error) {
    console.warn('Visitor tracking failed:', error);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  trackVisitor();
});
