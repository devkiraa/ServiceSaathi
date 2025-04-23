// Function to fetch service request details and display in modal.
async function viewDocuments(serviceRequestId) {
  try {
    const response = await fetch(`/api/service-request/${serviceRequestId}`);
    if (!response.ok) {
      alert("Unable to fetch documents.");
      return;
    }
    const sr = await response.json();
    const docContent = document.getElementById('docContent');
    docContent.innerHTML = '';
    sr.requiredDocuments.forEach(doc => {
      const card = document.createElement('div');
      card.className = "border rounded p-2";
      const title = document.createElement('p');
      title.className = "font-semibold mb-2";
      title.textContent = doc.name;
      card.appendChild(title);
      const img = document.createElement('img');
      img.className = "w-full h-40 object-cover rounded";
      img.src = doc.uploadedFile ? doc.uploadedFile : "https://via.placeholder.com/150?text=Not+Uploaded";
      card.appendChild(img);
      docContent.appendChild(card);
    });
    document.getElementById('docModal').classList.remove('hidden');
  } catch (error) {
    console.error(error);
    alert("An error occurred while fetching documents.");
  }
}
function closeModal() {
  document.getElementById('docModal').classList.add('hidden');
}

document.addEventListener("DOMContentLoaded", function () {
  // Search functionality
  document.getElementById('searchInput').addEventListener('input', function () {
    const query = this.value.toLowerCase();
    const rows = document.querySelectorAll('#serviceRequestsTableBody tr');
  
    rows.forEach(row => {
      const mobileNumber = row.cells[0].textContent.toLowerCase();
      const applicationDate = row.cells[2].textContent.toLowerCase();
    
      if (mobileNumber.includes(query) || applicationDate.includes(query)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });
  
  // Reset functionality
  document.querySelector('.reset').addEventListener('click', function () {
    document.getElementById('searchInput').value = '';
    const rows = document.querySelectorAll('#serviceRequestsTableBody tr');
    rows.forEach(row => {
      row.style.display = '';
    });
  });
});