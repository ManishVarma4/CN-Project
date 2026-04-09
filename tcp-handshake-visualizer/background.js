const requestData = {};

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.type === 'main_frame') {
      requestData[details.tabId] = {
        url: details.url,
        method: details.method,
        startTime: details.timeStamp,
        headersTime: null,
        completedTime: null,
        synTime: null,
        synAckTime: null,
        ackTime: null,
        totalTime: null,
        status: 'Initiating (SYN)'
      };
      
      chrome.storage.session.set({ [`tab_${details.tabId}`]: requestData[details.tabId] });
    }
  },
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.type === 'main_frame' && requestData[details.tabId]) {
      const data = requestData[details.tabId];
      data.headersTime = details.timeStamp;
      
      // Calculate SYN and SYN-ACK times based on TTFB
      // TTFB = headersTime - startTime
      // We approximate the RTT split evenly between SYN (out) and SYN-ACK (in)
      const ttfb = data.headersTime - data.startTime;
      data.synTime = Math.floor(ttfb / 2);
      data.synAckTime = Math.ceil(ttfb / 2);
      
      data.status = 'Waiting (SYN-ACK)';
      
      chrome.storage.session.set({ [`tab_${details.tabId}`]: data });
    }
  },
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.type === 'main_frame' && requestData[details.tabId]) {
      const data = requestData[details.tabId];
      data.completedTime = details.timeStamp;
      
      // Calculate ACK / Transfer time
      if (data.headersTime) {
        data.ackTime = data.completedTime - data.headersTime;
      } else {
        data.ackTime = 0;
      }
      
      data.totalTime = data.completedTime - data.startTime;
      data.status = 'Established (ACK)';
      
      chrome.storage.session.set({ [`tab_${details.tabId}`]: data });
    }
  },
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.type === 'main_frame' && requestData[details.tabId]) {
      const data = requestData[details.tabId];
      
      data.completedTime = details.timeStamp;
      data.totalTime = data.completedTime - data.startTime;
      
      data.status = 'Failed';
      
      chrome.storage.session.set({ [`tab_${details.tabId}`]: data });
    }
  },
  { urls: ["<all_urls>"] }
);

// Cleanup memory on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  delete requestData[tabId];
  chrome.storage.session.remove(`tab_${tabId}`);
});
