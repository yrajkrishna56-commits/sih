/**
 * Demo Flight Booking Site — Interactive script.
 * Handles form submissions, flight selection, and UI feedback.
 * All data is synthetic — no network calls, no real bookings.
 */

document.addEventListener('DOMContentLoaded', function() {
  // Set default date to tomorrow
  const dateInput = document.getElementById('travelDate');
  if (dateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.value = tomorrow.toISOString().split('T')[0];
  }

  // Search form submission
  const searchForm = document.getElementById('searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const resultsSection = document.getElementById('results');
      if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: 'smooth' });
      }
      // Flash the results section
      resultsSection.style.outline = '3px solid #1a237e';
      setTimeout(function() {
        resultsSection.style.outline = 'none';
      }, 1500);
    });
  }

  // Flight selection buttons
  const selectButtons = document.querySelectorAll('.btn-select:not([disabled])');
  selectButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      const flightId = btn.getAttribute('data-flight');
      // Reset all buttons
      selectButtons.forEach(function(b) {
        b.textContent = 'Select Flight';
        b.style.background = '#4caf50';
      });
      // Set selected
      btn.textContent = '✓ Selected';
      btn.style.background = '#1a237e';

      // Show passenger section
      const passengerSection = document.getElementById('passenger');
      if (passengerSection) {
        passengerSection.scrollIntoView({ behavior: 'smooth' });
        passengerSection.style.outline = '3px solid #4caf50';
        setTimeout(function() {
          passengerSection.style.outline = 'none';
        }, 1500);
      }
    });
  });

  // Card number formatting
  const cardInput = document.getElementById('cardNumber');
  if (cardInput) {
    cardInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
      value = value.match(/.{1,4}/g)?.join(' ') || value;
      e.target.value = value;
    });
  }

  // Expiry date formatting
  const expiryInput = document.getElementById('cardExpiry');
  if (expiryInput) {
    expiryInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2);
      }
      e.target.value = value;
    });
  }

  console.log('[Demo] SkyBook flight booking demo loaded. All data is synthetic.');
});
