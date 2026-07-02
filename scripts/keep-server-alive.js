// scripts/keep-server-alive.js
const https = require('https');

const PING_INTERVAL = 10 * 60 * 1000; 
const SERVER_URL = process.env.GAME_SERVER_URL || 'https://tanjo-game-server.onrender.com';

function pingServer() {
    const url = `${SERVER_URL}/health`;
    
    https.get(url, (res) => {
        console.log(`[${new Date().toISOString()}] Ping successful: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error(`[${new Date().toISOString()}] Ping failed:`, err.message);
    });
}

console.log(`Starting ping service for ${SERVER_URL}`);
console.log(`Pinging every ${PING_INTERVAL / 1000} seconds...`);

pingServer();

setInterval(pingServer, PING_INTERVAL);