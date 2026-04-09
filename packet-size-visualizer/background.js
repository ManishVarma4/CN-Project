// background.js

const MAX_LOGS = 100;
let requestLogs = [];
let isTracking = true;

// Temporary storage for active requests to calculate timings
const activeRequests = {};

// Initialize state
chrome.storage.local.get(['requestLogs', 'isTracking'], (data) => {
  if (data.requestLogs) {
    requestLogs = data.requestLogs;
  }
  if (data.isTracking !== undefined) {
    isTracking = data.isTracking;
  }
});

// Watch for toggle updates from popup
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.isTracking !== undefined) {
      isTracking = changes.isTracking.newValue;
    }
    // Sync logs if cleared by popup
    if (changes.requestLogs && changes.requestLogs.newValue.length === 0) {
      requestLogs = [];
    }
  }
});

// 1. Capture start time
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!isTracking) return;
    activeRequests[details.requestId] = {
      startTime: details.timeStamp
    };
  },
  { urls: ["<all_urls>"] }
);

// 2. Capture headers time for TTFB
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!isTracking || !activeRequests[details.requestId]) return;
    activeRequests[details.requestId].headersTime = details.timeStamp;
  },
  { urls: ["<all_urls>"] }
);

// 3. Capture completion and finalize log
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (!isTracking || !activeRequests[details.requestId]) return;

    const reqData = activeRequests[details.requestId];
    const endTime = details.timeStamp;

    // Calculate Timings
    const latency = endTime - reqData.startTime;
    const ttfb = reqData.headersTime ? (reqData.headersTime - reqData.startTime) : 0;

    // Estimate size from 'Content-Length' header or fallback to encodedDataLength
    let size = 0;
    const sizeHeader = details.responseHeaders?.find(
      h => h.name.toLowerCase() === 'content-length'
    );
    
    if (sizeHeader && sizeHeader.value) {
      size = parseInt(sizeHeader.value, 10);
    } else if (details.encodedDataLength !== undefined) {
      size = details.encodedDataLength; // Fallback accuracy improvement
    }

    // Creating log entry
    const logEntry = {
      id: details.requestId,
      url: details.url,
      method: details.method,
      statusCode: details.statusCode,
      size: size, // in bytes
      latency: Math.round(latency),
      ttfb: Math.round(ttfb),
      timestamp: Date.now(),
      type: details.type
    };

    requestLogs.push(logEntry);
    
    // Prune for memory efficiency
    if (requestLogs.length > MAX_LOGS) {
      requestLogs.shift();
    }

    // Clean up active request tracker
    delete activeRequests[details.requestId];
    
    chrome.storage.local.set({ requestLogs });

    // Push new data to the popup immediately in real-time
    chrome.runtime.sendMessage({
      action: "NEW_REQUEST",
      data: logEntry
    }).catch(() => {
      // Intentional empty catch: message sending fails harmlessly when popup is closed
    });
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// Cleanup failed requests to avoid memory leaks
chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    delete activeRequests[details.requestId];
  },
  { urls: ["<all_urls>"] }
);
