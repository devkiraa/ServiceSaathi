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
});

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