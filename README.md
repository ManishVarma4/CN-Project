# Computer Networks Extensions Project

This repository contains a collection of three Chrome extensions built as part of a Computer Networks (CN) project. These extensions serve as educational and diagnostic tools, visualizing and interacting with network concepts within the browser.

## Extensions Included

### 1. Malicious Website Blocker (Mini Firewall)
A security extension that intercepts and blocks suspicious outgoing requests to protect your browsing.
- **Directory**: `malicious-website-blocker/`
- **Features**: 
  - Maintains a blacklist of blocked domains.
  - Utilizes Manifest V3's `declarativeNetRequest` API to efficiently and safely block network requests.
  - Provides a custom popup interface to manage blocked domains.

### 2. Real-Time Packet Size Visualizer
A browser-based network monitoring tool to visualize outgoing and incoming packet sizes in real-time.
- **Directory**: `packet-size-visualizer/`
- **Features**:
  - Intercepts requests using the `webRequest` API.
  - Analyzes headers and request information to visualize data sizes.
  - Interactive popup to view network activity live.

### 3. TCP Handshake Visualizer
Displays a simulated view of the TCP 3-way handshake process for outgoing network requests.
- **Directory**: `tcp-handshake-visualizer/`
- **Features**:
  - Demonstrates the connection establishment phases (SYN, SYN-ACK, ACK).
  - Tracks request lifecycle events using the `webRequest` API to emulate handshake timing.
  - Features an animated, dark-themed dashboard to present network states.

## Installation Instructions

To try out any of these extensions, install them locally in your browser:

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable the **Developer mode** toggle in the top right corner.
3. Click on the **Load unpacked** button at the top left.
4. Select the specific directory of the extension you wish to install (e.g., `CNProject/packet-size-visualizer`).
5. The extension will be loaded. You can access it by clicking the puzzle piece icon in the Chrome toolbar and pinning it for easy access.

## Technologies Used
- HTML5, Vanilla CSS, JavaScript
- Chrome Extension APIs (`declarativeNetRequest`, `webRequest`, `storage`, `tabs`)
- Manifest V3 Architecture
