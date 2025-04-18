document.addEventListener("DOMContentLoaded", function () {
    // Initialize Chart.js Doughnut Chart
    const ctx = document.getElementById('doughnutChart').getContext('2d');
    let doughnutChart;
  
    const dataSets = {
      today: [30, 20, 50],
      week: [40, 30, 30],
      month: [25, 25, 50],
      all: [10, 40, 50],
    };
  
    function createChart(data) {
      if (doughnutChart) {
        doughnutChart.destroy(); // Destroy the previous chart instance to prevent memory leaks
      }
      doughnutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Task A', 'Task B', 'Task C'],
          datasets: [{
            data: data,
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
            hoverBackgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false, // Ensure the chart respects the container's dimensions
        }
      });
    }
  
    // Add event listeners to buttons
    document.querySelectorAll('#card-4 button').forEach(button => {
      button.addEventListener('click', () => {
        const period = button.getAttribute('data-period');
        const newData = dataSets[period];
        if (newData) {
          createChart(newData); // Update the chart with new data
        } else {
          console.error(`Invalid period: ${period}`);
        }
      });
    });
  
    // Initialize with "Today" data
    createChart(dataSets.today);
  
    // Optional: Reinitialize the chart on window resize
    window.addEventListener('resize', () => {
      if (doughnutChart) {
        doughnutChart.resize(); // Trigger Chart.js resize logic
      }
    });
  });