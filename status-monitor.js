// status-monitor.js - Checks system internet connectivity with colored status and ping time (Delayed Start)
require('dotenv').config();
const axios = require('axios');
const ping = require('ping');
const chalk = require('chalk'); // Ensure chalk v4 is installed (npm install --save-dev chalk@4)

// --- Configuration ---
const CHECK_INTERVAL_MS = 10000; // Check every 10 seconds
const PING_TIMEOUT_S = 4;      // Timeout for ping command in seconds
const HTTP_TIMEOUT_MS = 5000;  // Timeout for the HTTP check

const PING_HOST = '1.1.1.1'; // Target for ICMP ping (Cloudflare DNS)
const HTTP_CHECK_HOST = 'https://1.1.1.1'; // Target for HTTP check

// --- Helper function for coloring status ---
function colorStatus(status, value = null) {
    let coloredStatus;
    switch (status) {
        case 'OK':
            coloredStatus = chalk.green(status);
            break;
        case 'Timeout':
            coloredStatus = chalk.yellow(status);
            break;
        case 'FAIL':
        case 'FAIL (Error)':
        case 'FAIL (Host Unreachable)':
             coloredStatus = chalk.red(status);
            break;
        default:
            coloredStatus = chalk.gray(status); // For 'Checking...' or other states
            break;
    }
    // Color ping time based on latency
    if (value !== null && typeof value === 'number') {
         let coloredValue;
         if (value < 100) {
             coloredValue = chalk.green(`${value}ms`);
         } else if (value < 500) {
             coloredValue = chalk.yellow(`${value}ms`);
         } else {
             coloredValue = chalk.red(`${value}ms`);
         }
         return `${coloredStatus} (${coloredValue})`;
    } else if (value !== null) { // Handle non-numeric values like 'N/A'
        return `${coloredStatus} (${chalk.gray(value)})`;
    }

    return coloredStatus;
}


// --- Helper function for network check ---
async function performNetworkCheck() {
    const timestamp = new Date().toLocaleTimeString();
    let icmpStatus = 'Checking...';
    let httpStatus = 'Checking...';
    let pingTime = 'N/A';

    // 1. Check ICMP Ping
    try {
        const res = await ping.promise.probe(PING_HOST, {
            timeout: PING_TIMEOUT_S,
        });
        if (res.alive) {
            icmpStatus = 'OK';
            // Use res.avg or res.time. Ensure it's a number, default to 'N/A' if not.
            pingTime = typeof res.time === 'number' ? Math.round(res.time) : (typeof res.avg === 'number' ? Math.round(res.avg) : 'N/A');
        } else {
            icmpStatus = 'FAIL (Host Unreachable)';
        }
    } catch (error) {
        // Log ping errors only once, not repeatedly if the interval keeps failing
        if (!performNetworkCheck.pingErrorLogged) {
             console.error('\n[Ping Error]', error);
             performNetworkCheck.pingErrorLogged = true; // Set flag after logging
        }
        icmpStatus = 'FAIL (Error)';
    }
     // Reset flag if ping succeeds later
     if(icmpStatus === 'OK') {
       performNetworkCheck.pingErrorLogged = false;
     }


    // 2. Check HTTP/DNS via Axios
    try {
        await axios.head(HTTP_CHECK_HOST, { timeout: HTTP_TIMEOUT_MS });
        httpStatus = 'OK';
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            httpStatus = `Timeout`;
        } else {
            httpStatus = `FAIL`;
        }
    }

    // Format colored output
    const coloredIcmp = colorStatus(icmpStatus, pingTime);
    const coloredHttp = colorStatus(httpStatus);


    // Clear previous line and print new status line
    process.stdout.write('\r\x1b[K'); // Clear line
    process.stdout.write(`[${chalk.cyan(timestamp)}] Internet Status | Ping (${chalk.blue(PING_HOST)}): ${coloredIcmp} | HTTP Check (${chalk.blue(HTTP_CHECK_HOST)}): ${coloredHttp}  `);
}
// Static property for error logging flag
performNetworkCheck.pingErrorLogged = false;

// --- Main Execution ---
console.log(chalk.bold.blue('🚀 Starting System Network Status Monitor (Ping + HTTP)...'));
console.log(`Checking internet connectivity every ${chalk.yellow(CHECK_INTERVAL_MS / 1000)} seconds.`);
console.log(`(First check will run after ${CHECK_INTERVAL_MS / 1000} seconds)`); // Indicate the delay
console.log(`Ping Target: ${chalk.magenta(PING_HOST)}`);
console.log('---');

// REMOVED: setTimeout(performNetworkCheck, 1000); // No immediate first check

// Set interval for subsequent checks - the first execution will be after CHECK_INTERVAL_MS
const checkIntervalId = setInterval(performNetworkCheck, CHECK_INTERVAL_MS);

// Graceful shutdown
function shutdown() {
    console.log(chalk.bold.red('\nSignal received: stopping monitor.'));
    clearInterval(checkIntervalId);
    console.log(chalk.green('Monitor stopped.'));
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
