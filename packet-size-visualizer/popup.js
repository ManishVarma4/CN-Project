// popup.js

const CHART_MAX_POINTS = 40;
let packetChart;
let globalReqCounter = 0;
let totalBytesTransfer = 0;

// State to hold logs for filtering and Export feature
let allLogs = [];

// Domain bandwidth tracker
const domainBandwidth = {};

const DOM = {
  totalSize: document.getElementById('totalSize'),
  totalReqs: document.getElementById('totalReqs'),
  reqList: document.getElementById('reqList'),
  domainList: document.getElementById('domainList'),
  toggle: document.getElementById('trackingToggle'),
  clearBtn: document.getElementById('clearBtn'),
  exportBtn: document.getElementById('exportBtn'),
  filterSelect: document.getElementById('filterSelect'),
  ctx: document.getElementById('packetChart').getContext('2d')
};

// Initialize the Application
document.addEventListener('DOMContentLoaded', () => {
  initChart();
  
  // Load initial state and logs
  chrome.storage.local.get(['requestLogs', 'isTracking'], (data) => {
    DOM.toggle.checked = data.isTracking !== false;
    
    if (data.requestLogs) {
      allLogs = data.requestLogs;
    }

    // Process logs from oldest to newest for the chart and domain accumulators
    allLogs.forEach(log => processLogEntry(log, true));
    
    // Render list based on current filter
    renderRequestList();
    renderDomainList();
    
    if (allLogs.length > 0) {
      packetChart.update();
    }
  });

  // Listen for real-time traffic from background.js
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "NEW_REQUEST") {
      const log = message.data;
      allLogs.push(log);
      
      // Keep memory array capped
      if (allLogs.length > 100) allLogs.shift();
      
      processLogEntry(log, false);
      renderDomainList();
      
      // Instead of forcing a full re-render on high traffic, ideally we'd prepend if it matches the filter.
      // But re-rendering the list up to 50 items is fast enough for this prototype.
      renderRequestList();
      
      packetChart.update('none'); // Update without full animation for performance
    }
  });

  setupEventListeners();
});

// 6. Improve Chart (Major Upgrade): Dual visualization
function initChart() {
  packetChart = new Chart(DOM.ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Packet Size (KB)',
          data: [],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderWidth: 2,
          pointRadius: 1,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.3,
          yAxisID: 'y'
        },
        {
          label: 'Latency (ms)',
          data: [],
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          pointBackgroundColor: '#f59e0b',
          pointRadius: 2,
          pointHoverRadius: 5,
          fill: false,
          tension: 0.3,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 }, 
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { display: false },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: 'Size (KB)', color: '#94a3b8' },
          grid: { color: '#334155' },
          ticks: { color: '#94a3b8' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: { display: true, text: 'Latency (ms)', color: '#94a3b8' },
          grid: { drawOnChartArea: false }, // avoid grid line overlaps
          ticks: { color: '#94a3b8' }
        }
      },
      plugins: {
        legend: { display: true, labels: { color: '#f1f5f9' } }
      }
    }
  });
}

function processLogEntry(log, isBatchLoad) {
  globalReqCounter++;
  totalBytesTransfer += log.size;
  
  // Update Metrics Header
  DOM.totalReqs.textContent = globalReqCounter;
  DOM.totalSize.textContent = (totalBytesTransfer / (1024 * 1024)).toFixed(2) + ' MB';

  // 3. Domain-wise Bandwidth Breakdown Accumulation
  let hostname = "Unknown";
  try { hostname = new URL(log.url).hostname; } catch(e){}
  domainBandwidth[hostname] = (domainBandwidth[hostname] || 0) + log.size;

  // Format chart data
  const sizeKB = log.size / 1024;
  
  packetChart.data.labels.push(''); 
  packetChart.data.datasets[0].data.push(sizeKB);
  packetChart.data.datasets[1].data.push(log.latency);

  // Maintain sliding window limits
  if (packetChart.data.labels.length > CHART_MAX_POINTS) {
    packetChart.data.labels.shift();
    packetChart.data.datasets[0].data.shift();
    packetChart.data.datasets[1].data.shift();
  }
}

// Render the Top Domains UI
function renderDomainList() {
  DOM.domainList.innerHTML = '';
  
  // Sort domains by total size descending
  const sortedDomains = Object.entries(domainBandwidth)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // top 5
    
  sortedDomains.forEach(([domain, bytes]) => {
    let displaySize = `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes > 1024 * 1024) displaySize = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    
    const div = document.createElement('div');
    div.className = 'domain-item';
    div.innerHTML = `
      <span class="domain-name" title="${domain}">${domain.length > 35 ? domain.substring(0,35)+'...' : domain}</span>
      <span class="domain-size">${displaySize}</span>
    `;
    DOM.domainList.appendChild(div);
  });
}

// Apply Filters and Re-Render List
function renderRequestList() {
  DOM.reqList.innerHTML = '';
  
  const filterVal = DOM.filterSelect.value;
  
  let filteredLogs = [...allLogs];
  if (filterVal === 'large') {
    filteredLogs = filteredLogs.filter(L => L.size > 1024 * 1024);
  } else if (filterVal === 'slow') {
    filteredLogs = filteredLogs.filter(L => L.latency > 1000);
  }
  
  // Show newest on top, max 50 items
  filteredLogs.reverse().slice(0, 50).forEach(log => {
    appendLogToDOMList(log);
  });
}

function appendLogToDOMList(log) {
  // 5. Highlight Large / Slow Packets
  const isLarge = log.size > 1024 * 1024; // > 1MB
  const isSlow = log.latency > 1000;      // > 1s
  
  let rowClass = 'req-item';
  if (isLarge) rowClass += ' large-packet';
  else if (isSlow) rowClass += ' slow-packet';
  
  // 10. Upload vs Download Indicator (⬇ GET, ⬆ POST)
  let methodClass = 'method-other';
  let indicator = '⟷';
  if (log.method === 'GET') { methodClass = 'method-get'; indicator = '⬇'; }
  if (log.method === 'POST') { methodClass = 'method-post'; indicator = '⬆'; }

  // Size formatting
  let displaySize = `${(log.size / 1024).toFixed(1)} KB`;
  if (isLarge) displaySize = `${(log.size / (1024 * 1024)).toFixed(2)} MB`;
  else if (log.size === 0) displaySize = '0 B';

  // Domain & Protocol Extraction
  let urlDisplay = log.url;
  let protocolDisplay = 'HTTP';
  let isHttps = false;
  try { 
    const u = new URL(log.url);
    urlDisplay = u.hostname; 
    isHttps = u.protocol === 'https:';
    protocolDisplay = isHttps ? 'HTTPS' : 'HTTP';
  } catch(e){}

  const div = document.createElement('div');
  div.className = rowClass;

  div.innerHTML = `
    <span class="method-direction ${methodClass}">${indicator} ${log.method}</span>
    <div class="req-details">
      <div class="req-url-line">
        <span class="protocol-badge ${isHttps ? 'https' : 'http'}">[${protocolDisplay}]</span> 
        <span class="req-url" title="${log.url}">${urlDisplay}</span>
      </div>
      <div class="req-sub">
        <span class="latency-val ${isSlow ? 'slow' : ''}">${log.latency} ms</span>
        <span class="divider">|</span>
        <span class="ttfb-val">TTFB: ${log.ttfb} ms</span>
      </div>
    </div>
    <span class="req-size">${displaySize}</span>
  `;

  DOM.reqList.appendChild(div);
}

function setupEventListeners() {
  DOM.toggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ isTracking: e.target.checked });
  });

  DOM.filterSelect.addEventListener('change', () => {
    renderRequestList();
  });

  DOM.clearBtn.addEventListener('click', () => {
    chrome.storage.local.set({ requestLogs: [] }, () => {
      // Reset local state completely
      globalReqCounter = 0;
      totalBytesTransfer = 0;
      allLogs = [];
      for (const prop of Object.getOwnPropertyNames(domainBandwidth)) {
        delete domainBandwidth[prop];
      }
      
      DOM.totalSize.textContent = '0.00 MB';
      DOM.totalReqs.textContent = '0';
      DOM.reqList.innerHTML = '';
      DOM.domainList.innerHTML = '';
      
      packetChart.data.labels = [];
      packetChart.data.datasets[0].data = [];
      packetChart.data.datasets[1].data = [];
      packetChart.update();
    });
  });

  // 8. Export Data Feature
  DOM.exportBtn.addEventListener('click', exportToCSV);
}

function exportToCSV() {
  if (allLogs.length === 0) {
    alert("No data available to export.");
    return;
  }
  
  // Define headers
  const headers = ["Timestamp", "Method", "URL", "Size (Bytes)", "Latency (ms)", "TTFB (ms)", "Status Code"];
  
  // Format log properties into CSV rows
  const csvRows = allLogs.map(log => {
      const date = new Date(log.timestamp).toISOString();
      // quote the URL to prevent issues with commas 
      return `"${date}","${log.method}","${log.url}",${log.size},${log.latency},${log.ttfb},${log.statusCode}`;
  });
  
  // Join all together
  const csvContent = [headers.join(','), ...csvRows].join('\n');
  
  // Create Blob and trigger download artificially
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `packet_logs_${new Date().getTime()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
