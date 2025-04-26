document.addEventListener("DOMContentLoaded", function () {
  document.getElementById('add-btn').addEventListener('click', () => {
    const container = document.getElementById('documents-container');
    const div = document.createElement('div');
    div.className = 'doc-row';
    div.innerHTML = `
      <input type="text" name="requiredDocuments" placeholder="Document Name" required class="block w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary sm:text-sm">
      <button type="button" class="remove-btn ml-2 text-red-500 hover:text-red-700">Remove</button>
    `;
    container.appendChild(div);
  });
  
  document.getElementById('documents-container').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-btn')) {
      const row = e.target.closest('.doc-row');
      row.remove();
    }
  });
  document.getElementById('update-service-btn').addEventListener('click', async () => {
    try {
      const form = document.getElementById('edit-service-form');
      const formData = new FormData(form);

      // Debugging: Log the form data to the console
      const data = {};
      formData.forEach((value, key) => {
        if (!data[key]) {
          data[key] = value;
        } else {
          if (!Array.isArray(data[key])) {
            data[key] = [data[key]];
          }
          data[key].push(value);
        }
      });

      // Send the POST request to the server
      const response = await fetch(`/edit-service/${serviceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Success:', result);
        window.location.href = '/view-services'; // Redirect on success
      } else {
        const errorData = await response.json();
        console.error('Error Response:', errorData);
        alert(`Error: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error updating service:', error);
      alert('An unexpected error occurred. Please try again.');
    }
  });
});