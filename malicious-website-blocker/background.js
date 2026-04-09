// background.js

// Initialize default state on extension installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["blockedDomains", "isProtectionOn", "blockedCount"], (data) => {
    const initialState = {};
    if (!data.blockedDomains) {
      initialState.blockedDomains = ["example.com"]; // Default example
    }
    if (data.isProtectionOn === undefined) {
      initialState.isProtectionOn = true;
    }
    if (data.blockedCount === undefined) {
      initialState.blockedCount = 0;
    }
    
    if (Object.keys(initialState).length > 0) {
      chrome.storage.sync.set(initialState);
    } else {
      updateRules(); // Sync rules if already installed
    }
  });
});

// Update dynamic blocking rules when storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.blockedDomains || changes.isProtectionOn) {
      updateRules();
    }
  }
});

// The core function utilizing declarativeNetRequest API to dynamically modify network rules
async function updateRules() {
  const data = await chrome.storage.sync.get(["blockedDomains", "isProtectionOn"]);
  const domains = data.blockedDomains || [];
  const protectionOn = data.isProtectionOn ?? true;

  // Retrieve current active rules to clear them out before setting new ones
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingRuleIds = existingRules.map(rule => rule.id);

  if (!protectionOn || domains.length === 0) {
    // Clear all rules if protection is OFF or list is empty
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds
    });
    return;
  }

  // Generate new rules based on the blocklist
  const newRules = domains.map((domain, index) => {
    // Generate the URL for our custom warning page, passing the blocked domain as a parameter
    const extensionUrl = chrome.runtime.getURL("blocked.html") + "?domain=" + encodeURIComponent(domain);
    
    return {
      id: index + 1, // Rule IDs must be integers >= 1
      priority: 1,
      action: {
        type: "redirect",
        redirect: { url: extensionUrl }
      },
      condition: {
        urlFilter: `||${domain}^`, // Matches domain and its subdomains
        resourceTypes: ["main_frame"] // Only intercept primary page navigations
      }
    };
  });

  // Apply the new rules
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingRuleIds,
    addRules: newRules
  });
  
  console.log("Mini Firewall Rules Updated: ", newRules);
}

// Initial rule sync on worker startup
updateRules();
