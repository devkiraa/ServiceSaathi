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
});