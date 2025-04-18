document.addEventListener("DOMContentLoaded", function () {
    // Sample data for the line chart
    const chartData = {
        today: {
          labels: ['09:00', '12:00', '15:00', '18:00', '21:00'],
          data: [10, 20, 15, 25, 30],
        },
        week: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          data: [5, 10, 15, 20, 25, 30, 35],
        },
        month: {
          labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
          data: [10, 20, 25, 30],
        },
        all: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          data: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
        },
      };
  
      // Initialize Chart.js
      const ctx = document.getElementById('lineChart').getContext('2d');
      let lineChart;
  
      function renderLineChart(period) {
        const data = chartData[period];
        if (lineChart) {
          lineChart.destroy(); // Destroy existing chart instance
        }
    
        lineChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: data.labels,
            datasets: [
              {
                label: 'Performance',
                data: data.data,
                borderColor: '#6161f9',
                backgroundColor: 'rgba(97, 97, 249, 0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: 'top',
              },
            },
            scales: {
              x: {
                grid: {
                  display: false,
                },
              },
              y: {
                beginAtZero: true,
                grid: {
                  color: '#e5e7eb',
                },
              },
            },
          },
        });
      }
  
      // Event listeners for buttons
      document.querySelectorAll('#card-5 button').forEach((button) => {
        button.addEventListener('click', () => {
          const period = button.getAttribute('data-period');
          renderLineChart(period);
        });
      });
  
      // Render default chart (Today)
      renderLineChart('today');
});