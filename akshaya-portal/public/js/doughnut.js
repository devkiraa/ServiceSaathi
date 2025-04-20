// Initialize Chart.js
const doughnutChartCtx = document.getElementById('doughnutChart').getContext('2d');
let doughnutChart;

// Function to initialize or update the doughnut chart
function updateDoughnutChart(data) {
  const labels = data.map(item => item.label);
  const values = data.map(item => item.value);

  // Destroy existing chart instance if it exists
  if (doughnutChart) {
    doughnutChart.destroy();
  }

  // Create a new doughnut chart
  doughnutChart = new Chart(doughnutChartCtx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: [
          '#FF6384', // Red
          '#36A2EB', // Blue
          '#FFCE56', // Yellow
          '#4BC0C0', // Teal
          '#9966FF', // Purple
          '#F7DC6F', // Light Yellow
          '#B22222', // Firebrick
          '#4682B4', // Steel Blue
          '#FFD700', // Gold
          '#8B4513', // Saddle Brown
        ],
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right',
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || '';
              const value = context.raw || 0;
              return `${label}: ${value}%`;
            },
          },
        },
      },
    },
  });
}

// Function to fetch service data based on the selected period
async function fetchServiceData(period) {
  try {
    const response = await fetch(`/api/service-data?period=${period}`);
    if (!response.ok) throw new Error("Failed to fetch service data");
    const data = await response.json();

    // Update the doughnut chart with the fetched data
    updateDoughnutChart(data);
  } catch (error) {
    console.error("Error fetching service data:", error);
    alert("An error occurred while fetching service data.");
  }
}

// Add event listeners to the period buttons
document.querySelectorAll('.btn-xs').forEach(button => {
  button.addEventListener('click', () => {
    const period = button.getAttribute('data-period'); // Get the period (today, week, month, all)
    fetchServiceData(period); // Fetch data for the selected period
  });
});

// Initialize the chart with "All" data by default
fetchServiceData('all');