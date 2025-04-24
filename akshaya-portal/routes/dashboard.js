const express = require('express');
const router = express.Router();
const ServiceRequest = require('../models/ServiceRequest');

router.get('/service-data', async (req, res) => {
  const { period } = req.query; // Extracts the 'period' query parameter
  const user = req.session.user; // Get the logged-in user from the session

if (!user || !user.centerId) {
  return res.status(400).send("User or centerId not found in session");
}
  try {
    let serviceData;

    if (period === 'today') {
      serviceData = await ServiceRequest.aggregate([
        { $match: { createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } ,
        centreId: user.centerId } },
        { $group: { _id: '$documentType', count: { $sum: 1 } } },
      ]);
    } else if (period === 'week') {
      serviceData = await ServiceRequest.aggregate([
        { $match: { createdAt: { $gte: new Date(new Date() - 7 * 24 * 60 * 60 * 1000) } ,
        centreId: user.centerId } },
        { $group: { _id: '$documentType', count: { $sum: 1 } } },
      ]);
    } else if (period === 'month') {
      serviceData = await ServiceRequest.aggregate([
        { $match: { createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) },
        centreId: user.centerId  } },
        { $group: { _id: '$documentType', count: { $sum: 1 } } },
      ]);
    } else {
      serviceData = await ServiceRequest.aggregate([
        { $group: { _id: '$documentType', count: { $sum: 1 } } },
      ]);
    }

    const total = serviceData.reduce((sum, item) => sum + item.count, 0);
    const formattedData = serviceData.map(item => ({
      label: item._id,
      value: ((item.count / total) * 100).toFixed(2),
    }));

    res.json(formattedData);
  } catch (error) {
    console.error("Error fetching service data:", error);
    res.status(500).send("Server error");
  }
});

router.get('/line-data', async (req, res) => {
  const { period } = req.query; // Extract the 'period' query parameter
  const user = req.session.user; // Get the logged-in user from the session

if (!user || !user.centerId) {
  return res.status(400).send("User or centerId not found in session");
}
  try {
    let lineChartData;

    if (period === 'week') {
      // Line chart data for the last week (daily aggregation)
      lineChartData = await ServiceRequest.aggregate([
        { 
          $match: { createdAt: { $gte: new Date(new Date() - 7 * 24 * 60 * 60 * 1000) } ,
          centreId: user.centerId},
          
        },
        { 
          $group: { 
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }, }, 
            count: { $sum: 1 } 
          } 
        },
        { 
          $sort: { _id: 1 } 
        },
      ]);
    } else if (period === 'month') {
      // Line chart data for the current month (weekly aggregation)
      lineChartData = await ServiceRequest.aggregate([
        { 
          $match: { createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) } ,
          centreId: user.centerId },
         
        },
        { 
          $group: { 
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, 
            count: { $sum: 1 } 
          } 
        },
        { 
          $sort: { _id: 1 } 
        },
      ]);
    } else if (period === 'year') {
      // Line chart data for the last year (monthly aggregation)
      lineChartData = await ServiceRequest.aggregate([
        {
        $match: {
          
           createdAt: { $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)) } ,
          centreId: user.centerId, // Filter by the logged-in user's centerId
        }
      },
        { 
          $group: { 
            _id: { $dateToString: { format: '%Y', date: '$createdAt' } }, 
            count: { $sum: 1 } 
          }
        },
        { 
          $sort: { _id: 1 } 
        },
      ]);
      }

     else if(period ==='all'){// Default: All data
      lineChartData = await ServiceRequest.aggregate([
        { 
          $match: {
            createdAt: { $gte: new Date(0) }, // Matches all dates (from the epoch time)
            centreId: user.centerId, // Filter by the logged-in user's centerId
          }
        },
        {
          $group: { 
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }},
            count: { $sum: 1 } 
    
          } 
        
        },
    
        { 
          $sort: { _id: 1 } 
        },
      ]);
    }

    // Handle empty data gracefully
    if (lineChartData.length === 0) {
      return res.json({
        lineChart: [],
        totalServices: 0,
        pendingServices: 0,
        completedServices: 0,
      });
    }
// Calculate total services


// Format the data
const formattedData = lineChartData.map(item => ({
  label: item._id, // Time period (e.g., date, week, month, year)
  value: item.count, // Total number of services for this period
}));

// Send Response
res.json(formattedData);

    
  } catch (error) {
    console.error("Error fetching service data:", error);
    res.status(500).send("Server error");
  }
});

module.exports = router;