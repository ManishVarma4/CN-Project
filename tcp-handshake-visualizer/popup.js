document.addEventListener('DOMContentLoaded', init);

async function init() {
  const replayBtn = document.getElementById('replay-btn');
  replayBtn.addEventListener('click', replayAnimation);

  await loadRequestData();
}

let currentData = null;

async function loadRequestData() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) return;
    
    const tabId = tabs[0].id;
    const key = `tab_${tabId}`;
    
    const result = await chrome.storage.session.get(key);
    const data = result[key];
    
    if (data) {
      currentData = data;
      updateUI(data);
      playAnimation(data);
    } else {
      setEmptyState();
    }
  } catch (error) {
    console.error("Error loading data", error);
    setEmptyState();
  }
}

function setEmptyState() {
  document.getElementById('domain-display').textContent = 'No Main Request Captured';
  updateBadge('Waiting...', 'warning');
}

function formatTime(ms) {
  if (ms === null || ms === undefined) return '-- ms';
  return `${Math.round(ms)} ms`;
}

function updateUI(data) {
  try {
    const urlObj = new URL(data.url);
    document.getElementById('domain-display').textContent = urlObj.hostname;
    document.getElementById('domain-display').title = data.url;
    
    // Detect Protocol and set TLS Indicator layer
    const isHttps = urlObj.protocol === 'https:';
    document.getElementById('detail-protocol').textContent = isHttps ? 'HTTPS' : 'HTTP';
    
    const flowIndicator = document.getElementById('connection-flow');
    if (isHttps) {
      flowIndicator.textContent = "Connection Flow: TCP → TLS → HTTP";
    } else {
      flowIndicator.textContent = "Connection Flow: TCP → HTTP";
    }
    
    // Status Text configuration
    const statusEl = document.getElementById('detail-status');
    statusEl.textContent = data.status;
    
    if (data.status === 'Established (ACK)') {
      statusEl.className = 'detail-value text-success';
    } else if (data.status === 'Failed') {
      statusEl.className = 'detail-value text-danger';
      statusEl.textContent = 'Connection Failed';
    } else {
      statusEl.className = 'detail-value text-accent';
    }
    
    // Phase Timings
    document.getElementById('timing-syn').textContent = formatTime(data.synTime);
    document.getElementById('timing-syn-ack').textContent = formatTime(data.synAckTime);
    document.getElementById('timing-ack').textContent = formatTime(data.ackTime);
    
    // TTFB and Total Latency display
    const detailTtfb = document.getElementById('detail-ttfb');
    if (data.headersTime && data.startTime) {
      detailTtfb.parentElement.classList.remove('hidden');
      detailTtfb.textContent = formatTime(data.headersTime - data.startTime);
    }
    
    if (data.totalTime !== null) {
      document.getElementById('detail-total').textContent = formatTime(data.totalTime);
    }
    
  } catch(e) {
    console.error("Failed to parse URL", e);
  }
}

function updateBadge(text, type) {
  const badge = document.getElementById('status-badge');
  badge.textContent = text;
  badge.className = `badge ${type}`;
}

async function playAnimation(data) {
  const channel = document.querySelector('.channel');
  const line = document.querySelector('.connection-line');
  
  const synPacket = document.querySelector('.syn-packet');
  const synAckPacket = document.querySelector('.syn-ack-packet');
  const ackPacket = document.querySelector('.ack-packet');
  
  // Reset phases
  channel.className = 'channel';
  line.classList.remove('active', 'failed');
  
  // Calculate dynamic animation speeds (min 200ms so it's visible, max 2000ms so it doesn't freeze forever)
  const synDur = Math.max(200, Math.min(data.synTime || 500, 2000));
  const synAckDur = Math.max(200, Math.min(data.synAckTime || 500, 2000));
  const ackDur = Math.max(200, Math.min(data.ackTime || 500, 2000));

  // Apply real-time durations using inline CSS styles
  synPacket.style.animationDuration = `${synDur}ms`;
  synAckPacket.style.animationDuration = `${synAckDur}ms`;
  ackPacket.style.animationDuration = `${ackDur}ms`;

  updateBadge('Connecting', 'warning');
  
  // 1. SYN Phase (Client initiates connection)
  await sleep(100);
  channel.classList.add('animating-syn');
  
  // Wait for SYN animation to finish dynamically based on its configured duration
  await sleep(synDur);
  
  if (data.status === 'Failed') {
    handleFailure(channel, line);
    return; // Stop animation if failed
  }
  
  // 2. SYN-ACK Phase (Server acknowledges request)
  if (data.headersTime || data.completedTime) {
    channel.classList.remove('animating-syn');
    channel.classList.add('animating-syn-ack');
    
    await sleep(synAckDur);
    
    if (data.status === 'Failed') {
      handleFailure(channel, line);
      return; 
    }
    
    // 3. ACK Phase (Connection established)
    if (data.completedTime) {
      channel.classList.remove('animating-syn-ack');
      channel.classList.add('animating-ack');
      
      await sleep(ackDur);
      
      channel.classList.remove('animating-ack');
      
      // Establish Connection Glow
      line.classList.add('active'); 
      updateBadge('Established', 'success');
      return;
    }
  }
  
  // Fallback if not completed and not failed gracefully
  if (!data.completedTime && !data.headersTime) {
    updateBadge('Waiting for Server', 'warning');
  }
}

function handleFailure(channel, line) {
  channel.className = 'channel'; // stop all animations
  line.classList.add('failed');
  updateBadge('Failed', 'danger');
}

function replayAnimation() {
  if (currentData) {
    // Re-trigger the animation visually
    playAnimation(currentData);
  }
}

// Utility: sleep for ms
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
