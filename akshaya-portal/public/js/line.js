

// Initialize Chart.js for the line chart
document.addEventListener("DOMContentLoaded", function () {
  const lineChartCtx = document.getElementById('lineChart').getContext('2d');
  let lineChart;

  // Function to initialize or update the line chart
 function updateLineChart(data) {
    const labels= data.map(item => item.value); // Example labels
    const values = data.map(item => item.value); // Extract values from the fetched data

    // Destroy existing chart instance if it exists
    if (lineChart) {
      lineChart.destroy();
    }

    // Create a new line chart
    lineChart = new Chart(lineChartCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Total No of Services',
            data: values,
            borderColor: '#6366F1', // Indigo 500
            backgroundColor: '#6366F1',
            fill: true,
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // Ensure the chart respects the container's dimensions
        scales: {
          y: {
            beginAtZero: true,
          },
        },
        plugins: {
          legend: {
            position: 'top',
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.dataset.label || '';
                const value = context.raw || 0;
                return `${label}: ${value}`;
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
    const response = await fetch(`/api/line-data?period=${period}`);
    if (!response.ok) throw new Error("Failed to fetch line data");
    const data = await response.json();

    // Update the line chart with the fetched data
    updateLineChart(data);
    
    // Display Total Services
    /* document.getElementById('total-services').textContent = data.totalServices; */ 
  } catch (error) {
    console.error("Error fetching line data:", error);
    alert("An error occurred while fetching line data.");
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
});
