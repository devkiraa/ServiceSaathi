document.addEventListener("DOMContentLoaded", function () {
  // Search functionality
  document.getElementById('searchInput').addEventListener('input', function () {
    const query = this.value.toLowerCase();
    const rows = document.querySelectorAll('#centresTableBody tr');
  
    rows.forEach(row => {
      const centreName = row.cells[0].textContent.toLowerCase();
      const ownerName = row.cells[1].textContent.toLowerCase();
      const contact = row.cells[2].textContent.toLowerCase();
    
      if (centreName.includes(query) || ownerName.includes(query) || contact.includes(query)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });
  
  // Reset functionality
  document.querySelector('.reset').addEventListener('click', function () {
    document.getElementById('searchInput').value = '';
    const rows = document.querySelectorAll('#centresTableBody tr');
    rows.forEach(row => {
      row.style.display = '';
    });
  });
  applyFilter(currentFilter);
});
  
// Functionality for Filter Menu
let currentFilter = 'all'; // Default filter

function toggleFilterMenu() {
  const menu = document.getElementById('filterMenu');
  menu.classList.toggle('hidden');
}

function applyFilter(filter) {
  // Remove tick marks from all options
  ['all', 'pending', 'approved', 'rejected'].forEach(status => {
    document.getElementById(`tick-${status}`).classList.add('hidden');
  });

  // Add tick mark to the selected option
  document.getElementById(`tick-${filter}`).classList.remove('hidden');

  // Update the button text
  document.getElementById('filterButton').querySelector('span').textContent = filter.charAt(0).toUpperCase() + filter.slice(1);

  // Close the filter menu
  document.getElementById('filterMenu').classList.add('hidden');

  // Apply filter to table rows
  currentFilter = filter;
  filterCentres();
}

function filterCentres() {
  const rows = document.querySelectorAll('.centre-row');
  rows.forEach(row => {
    const status = row.getAttribute('data-status');
    if (currentFilter === 'all' || status === currentFilter) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

async function redirect(direction) {
  if(direction === 'logout'){
    window.location.href = '/logout';
  } else if (direction === 'profile'){
    window.location.href = '/profile';
  } else if (direction === 'change-pass'){
    window.location.href = '/change-password';
  } else {
    console.error("Invalid Redirection!");
  }
}