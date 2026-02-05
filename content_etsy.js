// Main Content Script for Etsy
// 1. Injects the Sidebar UI
// 2. Handles Logic (Scanning, Mapping)
// 3. Executes Automation

let sidebarRoot = null;
let currentData = null; // The selected table data
let rawSheetData = null; // The complete raw sheet data (for description outside table)
const containerId = 'etsy-pro-extension-root';

// ===========================================
// ROBUST INITIALIZATION & URL WATCHER
// ===========================================

function checkAndInject() {
  // Check if we are on an Etsy listing edit/add page
  // Patterns:
  // .../your/shops/me/listings/... (Listing Manager) - Maybe not here?
  // .../listings/[ID]/edit (Edit Page) - YES
  // .../listings/create (Add Page) - YES

  // Broad check for "etsy.com" and "listing" in URL including "listing-editor"
  if (window.location.href.includes("etsy.com") &&
    (window.location.href.includes("/listing/") ||
      window.location.href.includes("listings") ||
      window.location.href.includes("listing-editor"))) {

    const existing = document.getElementById(containerId);
    if (!existing) {
      console.log("Etsy Pro: Auto-injecting sidebar...");
      injectSidebar();
    }
  }
}

// 1. Run immediately
checkAndInject();

// 2. SPA Navigation Watcher (MutationObserver on URL/Body)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    console.log("[EtsyPro] URL changed from:", lastUrl, "to:", url);

    // IMPORTANT: Get oldMode BEFORE updating lastUrl
    const oldMode = getCurrentModeFromUrl(lastUrl);
    const newMode = getCurrentModeFromUrl(url);

    // Update lastUrl AFTER getting oldMode
    lastUrl = url;

    if (oldMode !== newMode && newMode !== 'other') {
      console.log(`[EtsyPro] Mode changed: ${oldMode} → ${newMode}. Resetting observer...`);
      resetAiObserver();
    }

    checkAndInject();
  }
}).observe(document, { subtree: true, childList: true });

// Helper to extract mode from URL
function getCurrentModeFromUrl(url) {
  if (url.includes('/listing-editor/copy/')) return 'copy';
  if (url.includes('/listing-editor/edit/')) return 'edit';
  if (url.includes('/listing-editor/create')) return 'create';
  return 'other';
}

// Function to reset the AI observer completely
function resetAiObserver() {
  console.log("[EtsyPro] Resetting AI Observer state...");

  // Stop existing observer
  if (aiObserver) {
    aiObserver.disconnect();
    aiObserver = null;
  }

  // Reset all state variables
  isCleaningUp = false;
  currentPageMode = 'unknown';
  hasAutoRun = false;
  processedImages.clear();
  lastImageSrc = null;

  console.log("[EtsyPro] State cleared. Re-initializing...");

  // Restart observer
  setupAiObserver();
}

// 3. Interval Fallback (every 2s)
setInterval(checkAndInject, 2000);

// 4. Listen for background toggle (Clicking Extension Icon)
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "toggle_sidebar") {
    const existing = document.getElementById(containerId);
    if (existing) {
      // Use our expand/collapse logic if available
      const current = existing.style.transform;
      // If it looks expanded (transform 0 or empty), collapse it.
      if (current === 'translateX(0px)' || current === '') {
        if (typeof collapseSidebar === 'function') collapseSidebar();
      } else {
        if (typeof expandSidebar === 'function') expandSidebar();
      }
    } else {
      await injectSidebar();
    }
  }

});

// ===========================================
// BUNNY MASCOT WITH CHAT BUBBLE
// ===========================================
async function injectBunnyMascot() {
  const mascotId = 'etsy-bunny-mascot-container';

  // Don't inject twice
  if (document.getElementById(mascotId)) return;

  // Create container
  const mascotContainer = document.createElement('div');
  mascotContainer.id = mascotId;

  // Container styles
  Object.assign(mascotContainer.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '2147483648', // ABOVE sidebar popup
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    pointerEvents: 'none', // Don't block clicks
    transition: 'opacity 0.3s ease'
  });

  // Chat bubble
  const chatBubble = document.createElement('div');
  chatBubble.className = 'bunny-chat-bubble';
  chatBubble.style.cssText = `
    background: linear-gradient(135deg, #ffe7e7 0%, #fff0f0 100%);
    border: 2px solid #ffadaf;
    border-radius: 20px 20px 20px 2px;
    padding: 12px 16px;
    box-shadow: 0 4px 12px rgba(255, 173, 175, 0.3);
    font-family: 'Outfit', -apple-system, sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #881337;
    max-width: 200px;
    position: relative;
    opacity: 0;
    transform: translateY(10px) scale(0.9);
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  `;

  // Chat bubble tail (little triangle)
  const bubbleTail = document.createElement('div');
  bubbleTail.style.cssText = `
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 8px solid #ffadaf;
  `;
  chatBubble.appendChild(bubbleTail);

  // Bunny GIF (direct, no wrapper)
  const bunnyImg = document.createElement('img');
  const bunnyUrl = chrome.runtime.getURL('Bunny.gif');
  bunnyImg.src = bunnyUrl;
  bunnyImg.alt = 'Bunny Mascot';
  bunnyImg.style.cssText = `
    width: 100px;
    height: 100px;
    object-fit: contain;
    user-select: none;
    cursor: pointer;
    pointer-events: auto;
    filter: drop-shadow(0 4px 12px rgba(255, 173, 175, 0.3));
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    animation: bunnyFloat 3s ease-in-out infinite;
  `;

  // Assemble
  mascotContainer.appendChild(chatBubble);
  mascotContainer.appendChild(bunnyImg);

  // Inject CSS animations
  const animStyle = document.createElement('style');
  animStyle.textContent = `
    @keyframes bunnyFloat {
      0%, 100% {
        transform: translateY(0px);
      }
      50% {
        transform: translateY(-10px);
      }
    }
    
    @keyframes bunnyBounce {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.15);
      }
    }
    
    @keyframes bubblePop {
      0% {
        opacity: 0;
        transform: translateY(10px) scale(0.8);
      }
      50% {
        transform: translateY(-5px) scale(1.05);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    
    @keyframes bubbleFade {
      0% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      100% {
        opacity: 0;
        transform: translateY(-10px) scale(0.9);
      }
    }
  `;
  document.head.appendChild(animStyle);

  // Add to body
  document.body.appendChild(mascotContainer);

  // ===========================================
  // REMOTE MESSAGES CONFIG
  // ===========================================

  // 🔗 Remote config URL - Replace with your GitHub raw URL
  const REMOTE_CONFIG_URL = 'https://raw.githubusercontent.com/yheiakadylan/EtsyFillVariantListingExtension/main/bunny-messages.json';

  // Default fallback messages
  const DEFAULT_MESSAGES = [
    "dừng lại tí, quay qua nhìn anh neee",
    "dễ thương dữ dạ sao anh chịu nổi",
    "mệt hăm, bé thỏ thay mặt anh xoa đầu bé nha",
    "bỏ tay xuống, đứng dậy ra ngoài sạc pin",
    "anh iu bé nhìu nhaaaaaaa",
  ];

  let messages = DEFAULT_MESSAGES;
  let currentMessageIndex = -1;

  // Fetch messages from GitHub (once per page load)
  async function fetchRemoteMessages() {
    try {
      console.log('[BunnyMascot] 🔄 Fetching from GitHub...');
      const response = await fetch(REMOTE_CONFIG_URL, { cache: 'no-cache' });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const config = await response.json();

      if (config.messages && Array.isArray(config.messages) && config.messages.length > 0) {
        messages = config.messages;
        console.log(`[BunnyMascot] ✅ ${messages.length} messages loaded`);
      } else {
        throw new Error('Invalid format');
      }
    } catch (error) {
      console.warn('[BunnyMascot] ⚠️ Fetch failed, using defaults:', error.message);
      messages = DEFAULT_MESSAGES;
    }
  }
  // Just call it once - no cache logic needed
  await fetchRemoteMessages();

  // Function to show new message
  function showNewMessage() {
    // Pick random message (different from current)
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * messages.length);
    } while (newIndex === currentMessageIndex && messages.length > 1);

    currentMessageIndex = newIndex;

    // Fade out
    chatBubble.style.animation = 'bubbleFade 0.3s ease-out forwards';

    setTimeout(() => {
      // Change text
      chatBubble.textContent = messages[currentMessageIndex];
      chatBubble.appendChild(bubbleTail); // Re-add tail

      // Fade in with bounce
      chatBubble.style.animation = 'bubblePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
    }, 300);
  }

  // Initial message
  setTimeout(() => {
    showNewMessage();
  }, 500);

  // Change message every 5 seconds
  setInterval(showNewMessage, 5000);

  // Hover effect on bunny
  bunnyImg.addEventListener('mouseenter', () => {
    bunnyImg.style.transform = 'scale(1.15) rotate(5deg)';
    bunnyImg.style.animation = 'bunnyBounce 0.5s ease-in-out';
  });

  bunnyImg.addEventListener('mouseleave', () => {
    bunnyImg.style.transform = 'scale(1) rotate(0deg)';
    bunnyImg.style.animation = 'bunnyFloat 3s ease-in-out infinite';
  });

  // ===========================================
  // DRAG & DROP LOGIC
  // ===========================================
  let hasMoved = false;

  bunnyImg.addEventListener('mousedown', (e) => {
    e.preventDefault(); // Prevent ghost image drag
    hasMoved = false;

    const startX = e.clientX;
    const startY = e.clientY;

    // Get current position (could be right/bottom based or left/top based)
    const rect = mascotContainer.getBoundingClientRect();

    // Switch to explicit left/top positioning to make movement easy
    mascotContainer.style.bottom = 'auto';
    mascotContainer.style.right = 'auto';
    mascotContainer.style.left = rect.left + 'px';
    mascotContainer.style.top = rect.top + 'px';

    bunnyImg.style.cursor = 'grabbing';

    const onMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      // Threshold to detect drag vs click
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;

      mascotContainer.style.left = (rect.left + dx) + 'px';
      mascotContainer.style.top = (rect.top + dy) + 'px';
    };

    const onMouseUp = () => {
      bunnyImg.style.cursor = 'pointer';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  // Click to trigger cute animation (only if not dragged)
  bunnyImg.addEventListener('click', (e) => {
    if (hasMoved) {
      e.stopPropagation();
      return;
    }

    bunnyImg.style.animation = 'bunnyBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
    showNewMessage();
    setTimeout(() => {
      bunnyImg.style.animation = 'bunnyFloat 3s ease-in-out infinite';
    }, 600);
  });

  console.log('[EtsyPro] 🐰 Bunny mascot activated!');
}

// Inject mascot on load
setTimeout(injectBunnyMascot, 1000);



// ===========================================
// CSS PROTECTION LAYER
// Prevents Etsy UI elements from resizing when extension pushes body
// ===========================================
function injectLayoutProtection() {
  const protectionId = 'etsy-extension-layout-protection';

  // Don't inject twice
  if (document.getElementById(protectionId)) return;

  // Create protection style element
  const protectionStyle = document.createElement('style');
  protectionStyle.id = protectionId;

  // Critical CSS rules to lock widths and prevent layout shift
  protectionStyle.textContent = `
    /* Extension Layout Protection - Prevents btn-group and other elements from resizing */
    
    /* Lock btn-group dimensions */
    .btn-group {
      width: max-content !important;
      min-width: fit-content !important;
      flex-shrink: 0 !important;
    }
    
    /* Lock individual button widths inside btn-group */
    .btn-group .btn-group-item {
      flex-shrink: 0 !important;
      width: auto !important;
      min-width: fit-content !important;
    }
    
    /* Preserve main content width */
    .listing-editor-main,
    .listing-editor-wrapper,
    [class*="listing-editor"] {
      transition: none !important;
    }
    
    /* Lock table layouts */
    table.variations-table,
    .variations-table-wrapper {
      width: auto !important;
      table-layout: fixed !important;
    }
    
    /* Preserve form field widths */
    .form-group,
    .input-group {
      max-width: none !important;
    }
    
    /* Lock navigation elements */
    .pagination,
    .page-nav {
      flex-shrink: 0 !important;
    }
    
    /* Prevent header from shifting */
    header,
    .header-wrapper,
    [role="banner"] {
      transition: none !important;
    }
  `;

  // Inject into head
  document.head.appendChild(protectionStyle);
  console.log('[EtsyPro] Layout protection activated');
}

// ===========================================
// ENHANCED COLLAPSE/EXPAND WITH PROTECTION
// ===========================================
function collapseSidebar() {
  const container = document.getElementById('etsy-pro-extension-root');
  const btn = document.getElementById('etsy-pro-toggle-btn');
  if (container) {
    container.style.transform = 'translateX(100%)';
    chrome.storage.local.set({ sidebarCollapsed: true });
    // Restore Body
    document.body.style.marginRight = '0px';
  }
  if (btn) {
    btn.style.right = '0';
    btn.innerHTML = '‹'; // Point left to open
    btn.style.borderRadius = '24px 0 0 24px';
  }
}

function expandSidebar() {
  const container = document.getElementById('etsy-pro-extension-root');
  const btn = document.getElementById('etsy-pro-toggle-btn');
  if (container) {
    container.style.transform = 'translateX(0px)';
    chrome.storage.local.set({ sidebarCollapsed: false });
    // Push Body
    document.body.style.transition = 'margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    document.body.style.marginRight = '400px';
  }
  if (btn) {
    btn.style.right = '400px';
    btn.innerHTML = '›'; // Point right to close
    btn.style.borderRadius = '24px 0 0 24px';
  }
}

async function injectSidebar() {
  if (document.getElementById(containerId)) return;

  // CRITICAL: Inject layout protection FIRST before sidebar
  injectLayoutProtection();

  // 1. Fetch HTML
  const htmlUrl = chrome.runtime.getURL('popup.html');
  const response = await fetch(htmlUrl);
  const htmlText = await response.text();

  // 2. Create Container
  // ETSY-LIKE UI THEME (DARK MODE VARIANT)
  const container = document.createElement('div');
  container.id = 'etsy-pro-extension-root';
  Object.assign(container.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    width: '400px',
    height: '100vh',
    zIndex: '2147483647',
    boxShadow: '-5px 0 30px rgba(0,0,0,0.2)', /* Softer shadow */
    background: '#ffe7e7', /* Light Pink Base */
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    fontFamily: '"Graphik Webfont", -apple-system, BlinkMacSystemFont, "Outfit", "Roboto", "Droid Sans", "Segoe UI", "Helvetica", Arial, sans-serif'
  });

  // 3. Shadow DOM (to isolate styles)
  const shadow = container.attachShadow({ mode: 'open' });
  sidebarRoot = shadow;

  // 4. Inject Styles (CUSTOM DARK THEME)
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
    
    * { box-sizing: border-box; }
    
    .extension-wrapper { 
      margin: 0; 
      padding: 0; 
      font-family: 'Outfit', sans-serif; 
      color: #334155; 
      background: #ffe7e7; 
      min-height: 100vh;
    }
    
    /* SCROLLBAR */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #ffe0e0; }
    ::-webkit-scrollbar-thumb { background: #ffd2d3; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #ffadaf; }

    /* HEADER */
    .header {
        background: linear-gradient(135deg, #ffadaf 0%, #fbbaba 100%);
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 4px 20px rgba(251, 186, 186, 0.4);
    }
    
    @keyframes bounce {
        0% { transform: scale(1, 1) translateY(0); }
        10% { transform: scale(1.1, 0.9) translateY(0); }
        30% { transform: scale(0.9, 1.1) translateY(-6px); }
        50% { transform: scale(1.05, 0.95) translateY(0); }
        57% { transform: scale(1, 1) translateY(-2px); }
        64% { transform: scale(1, 1) translateY(0); }
        100% { transform: scale(1, 1) translateY(0); }
    }

    .logo { 
        font-weight: 700; 
        font-size: 18px; 
        letter-spacing: 0.5px; 
        color: #881337; 
        display: flex; 
        align-items: center; 
        gap: 8px; 
        animation: bounce 2s cubic-bezier(0.28, 0.84, 0.42, 1) infinite;
    }
    .badge {
        background: rgba(255, 255, 255, 0.5);
        color: #881337;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        font-weight: 600;
    }

    /* CONTAINER */
    .container { 
        padding: 24px 20px; 
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    /* CARDS */
    .card {
        background: #ffe0e0;
        border: 2px solid #fff; /* White border */
        border-radius: 24px; /* Bubbly */
        padding: 16px;
        transition: all 0.3s ease;
        box-shadow: 0 4px 0 rgba(251, 186, 186, 0.4); /* Chunky shadow */
    }
    .card:hover {
        border-color: #ffadaf;
        transform: translateY(-2px);
        box-shadow: 0 6px 0 rgba(251, 186, 186, 0.6);
    }

    /* TABS */
    .tabs {
        display: flex;
        background: #ffe0e0;
        padding: 4px;
        border-radius: 16px; /* Rounder tabs */
        margin-bottom: 12px;
        border: 2px solid #ffd2d3;
    }
    .tab {
        flex: 1;
        text-align: center;
        padding: 8px;
        font-size: 13px;
        font-weight: 500;
        color: #94a3b8;
        cursor: pointer;
        border-radius: 12px;
        transition: 0.2s;
    }
    .tab:hover { color: #64748b; }
    .tab.active {
        background: #ffffff;
        color: #ffadaf;
        font-weight: 700;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    /* TYPOGRAPHY */
    .label {
        display: block;
        font-size: 13px;
        font-weight: 700;
        color: #881337;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    p { font-size: 13px; line-height: 1.5; color: #64748b; margin: 0 0 12px 0; }

    /* INPUTS */
    .input-field, input[type="text"], input[type="password"], select, textarea {
        width: 100%;
        background: #ffffff;
        border: 2px solid #ffd2d3;
        color: #334155;
        padding: 12px 16px;
        border-radius: 20px; /* Bubbly Input */
        font-family: inherit;
        font-size: 14px;
        transition: 0.2s;
        outline: none;
    }
    input::placeholder { color: #cbd5e1; }
    .input-field:focus, textarea:focus, select:focus {
        outline: none;
        border-color: #ffadaf;
        box-shadow: 0 0 0 4px rgba(255, 173, 175, 0.3);
    }
    
    /* Jelly Animation */
    @keyframes jelly {
        0%, 100% { transform: scale(1, 1); }
        25% { transform: scale(0.9, 1.1); }
        50% { transform: scale(1.1, 0.9); }
        75% { transform: scale(0.95, 1.05); }
    }

    /* Buttons */
    .btn {
        width: 100%;
        padding: 12px 20px;
        border: none;
        border-radius: 50px; /* Pill Shape */
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
        position: relative;
        overflow: hidden;
    }
    .btn:hover {
        animation: jelly 0.5s;
    }
    .btn-primary {
        background: linear-gradient(135deg, #ffadaf 0%, #fbbaba 100%);
        color: #881337;
        border: 2px solid #fff;
        box-shadow: 0 4px 0 #fca5a5; /* Chunky pink shadow */
    }
    .btn-primary:active {
        transform: translateY(2px);
        box-shadow: 0 2px 0 #fca5a5;
    }
    .btn-secondary {
        background: #ffffff;
        color: #64748b;
        border: 2px solid #ffd2d3;
        box-shadow: 0 4px 0 #ffd2d3; /* Chunky shadow */
    }
    .btn-secondary:hover {
        background: #fff5f5;
        border-color: #ffadaf;
        color: #881337;
    }
    .btn-secondary:active {
        transform: translateY(2px);
        box-shadow: 0 2px 0 #ffd2d3;
    }
    
    /* STATUS */
    .hidden { display: none !important; }
    .status-msg { margin-bottom: 16px; padding: 12px; border-radius: 8px; font-size: 13px; display: none; }
    .status-msg.success { color: #16a34a; }
    .status-msg.error { color: #dc2626; }
    
    /* SEARCH LIST */
    #sheet-list button {
        text-align: left;
        background: #ffffff;
        border: 1px solid #ffd2d3;
        padding: 8px 12px;
        border-radius: 6px;
        transition: 0.2s;
        color: #334155;
    }
    #sheet-list button:hover {
        border-color: #ffadaf;
        background: #fff5f5;
    }

    /* MODAL */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255,255,255,0.8);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
    }
    .modal-content {
        background: #ffe0e0;
        width: 90%;
        max-width: 340px;
        padding: 24px;
        border-radius: 12px;
        position: relative;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        animation: slideUp 0.3s ease;
        border: 1px solid #ffd2d3;
        color: #334155;
    }
    @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    .modal-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 24px;
        height: 24px;
        color: #881337;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: #ffd2d3;
        font-size: 14px;
        font-weight: bold;
        transition: 0.2s;
    }
    .modal-close:hover {
        background: #ffadaf;
        color: #fff;
    }
    #gs-code {
        width: 100%;
        height: 120px;
        margin-top: 12px;
        font-family: monospace;
        font-size: 11px;
        background: #ffffff;
        border: 1px solid #ffd2d3;
        color: #334155;
        border-radius: 6px;
        resize: vertical;
        padding: 8px;
    }
    
    /* MARQUEE FOOTER */
    .marquee-container {
        width: 100%;
        overflow: hidden;
        background: #ffadaf;
        padding: 6px 0;
        position: absolute;
        bottom: 0;
        left: 0;
        z-index: 10;
        border-top: 1px solid #fbbaba;
    }
    .marquee-text {
        white-space: nowrap;
        animation: marquee 15s linear infinite;
        font-size: 11px;
        font-weight: 700;
        color: #881337;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: inline-block;
        padding-left: 100%; 
    }
    @keyframes marquee {
        0% { transform: translate(0, 0); }
        100% { transform: translate(-100%, 0); }
    }
    
    /* SPINNER */
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .spinner {
        border: 2px solid rgba(136, 19, 55, 0.3);
        border-top: 2px solid #881337;
        border-radius: 50%;
        width: 14px;
        height: 14px;
        animation: spin 1s linear infinite;
        display: inline-block;
        margin-right: 8px;
    }
  `;
  shadow.appendChild(style);

  // 5. Inject HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const scripts = doc.querySelectorAll('script');
  scripts.forEach(s => s.remove());

  const bodyContent = doc.body.innerHTML;
  const wrapper = document.createElement('div');
  wrapper.className = 'extension-wrapper';
  wrapper.innerHTML = bodyContent;
  wrapper.style.height = '100%';
  wrapper.style.overflowY = 'auto'; // scrolling

  shadow.appendChild(wrapper);

  // 6. Add Toggle Button (Updated Style)
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'etsy-pro-toggle-btn';
  Object.assign(toggleBtn.style, {
    position: 'fixed',
    top: '50%',
    right: '400px', // Matches sidebar width
    transform: 'translateY(-50%)',
    zIndex: '2147483646',
    background: '#ffadaf', // Pink
    border: 'none',
    borderRadius: '24px 0 0 24px', // Nice rounded pill half
    padding: '0',
    width: '32px',
    height: '64px',
    cursor: 'pointer',
    boxShadow: '-2px 0 10px rgba(0,0,0,0.1)',
    transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    color: '#881337',
    fontSize: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  });
  toggleBtn.innerHTML = '›'; // Clean arrow

  // 7. Inject to Body
  document.body.appendChild(container);
  document.body.appendChild(toggleBtn);

  // 8. Auto-Show Logic & Toggle Binding
  chrome.storage.local.get(['sidebarCollapsed'], (result) => {
    if (result.sidebarCollapsed) {
      collapseSidebar();
    } else {
      expandSidebar();
    }
  });

  toggleBtn.onclick = () => {
    const container = document.getElementById('etsy-pro-extension-root');
    const currentTransform = container.style.transform;

    if (currentTransform === 'translateX(0px)' || currentTransform === '') {
      collapseSidebar();
    } else {
      expandSidebar();
    }
  };

  // 9. Bind Events (Re-implementation of popup.js logic)
  bindSidebarEvents(shadow);

  // 10. Check Storage
  const storage = await chrome.storage.local.get(['cachedData']);
  if (storage.cachedData) {
    processData(storage.cachedData, 'Restored Session');
  }
}



// ===========================================
// EVENT BINDING
// ===========================================
// ===========================================
// EVENT BINDING
// ===========================================
// EVENT BINDING
// ===========================================
let currentScriptUrl = "";
let sheetList = [];
let globalSheetListStore = []; // Added for navigation support

function bindSidebarEvents(root) {
  // View Switching
  const tabs = root.querySelectorAll('.tab');
  const tabContents = root.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      tabContents.forEach(c => c.classList.add('hidden'));
      root.getElementById(`tab-${target}`).classList.remove('hidden');

      // Safety: Ensure connect step is visible if we go to API tab
      if (target === 'api') {
        const connectStep = root.getElementById('api-step-connect');
        if (connectStep) connectStep.classList.remove('hidden');
      }
    });
  });

  // Scan Button
  const btnScan = root.getElementById('btn-scan');
  if (btnScan) {
    btnScan.onclick = async () => {
      const originalText = btnScan.innerHTML;
      btnScan.disabled = true;
      btnScan.innerHTML = '<span class="spinner"></span> Scanning...';
      showStatus('Scanning Google Sheets...', 'normal');

      chrome.runtime.sendMessage({ action: "request_scan" }, (response) => {
        btnScan.disabled = false;
        btnScan.innerHTML = originalText;

        if (response && response.status === "success" && response.data) {
          processData(response.data, "Active Table");
          showStatus("Scanned Successfully!", "success");
        } else {
          const msg = response ? response.message : "Timeout/Error";
          showStatus("Scan Failed: " + msg, "error");
        }
      });
    };
  }

  // --- API / SCRIPT EVENTS ---

  // 1. Connect
  // 1. Connect
  const btnConnect = root.getElementById('btn-connect');
  if (btnConnect) {
    btnConnect.onclick = async () => {
      const url = root.getElementById('script-url').value.trim();
      if (!url) return showStatus("Enter Script URL", "error");

      currentScriptUrl = url;
      chrome.storage.local.set({ scriptUrl: url });

      const originalText = btnConnect.innerHTML;
      btnConnect.innerHTML = '<span class="spinner"></span> Connecting...';
      btnConnect.disabled = true;

      try {
        await fetchSheetList(url);
        // Switch to scan tab on success
        root.querySelector('.tab[data-tab="scan"]').click();
        showStatus("Connected! Select a sheet.", "success");
      } catch (e) {
        showStatus(e.message, "error");
      } finally {
        btnConnect.innerHTML = originalText;
        btnConnect.disabled = false;
      }
    };
  }

  // 2. Navigation Helpers (Refresh & GoTo)
  const btnRefresh = root.getElementById('refresh-sheets');
  if (btnRefresh) {
    btnRefresh.onclick = async () => {
      if (!currentScriptUrl) return showStatus("Script not connected", "error");
      btnRefresh.style.opacity = '0.5';
      try {
        await fetchSheetList(currentScriptUrl);
        showStatus("Refreshed list.", "success");
      } catch (e) { showStatus(e.message, "error"); }
      btnRefresh.style.opacity = '1';
    };
  }

  const btnGotoApi = root.getElementById('btn-goto-api');
  if (btnGotoApi) {
    btnGotoApi.onclick = () => {
      root.querySelector('.tab[data-tab="api"]').click();
    };
  }

  // 3. Search Filter
  const searchInput = root.getElementById('search-sheets');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = sheetList.filter(s => s.toLowerCase().includes(term));
      renderSheetList(filtered);
    });
  }

  // Help Modal
  const linkHelp = root.getElementById('link-help');
  if (linkHelp) {
    linkHelp.onclick = () => {
      const modal = root.getElementById('modal-help');
      modal.classList.remove('hidden');
      modal.style.display = 'flex'; // Force flex

      // Inject Template Code
      root.getElementById('gs-code').value = `function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;
  if (action === 'getSheets') {
    return ContentService.createTextOutput(JSON.stringify(ss.getSheets().map(s => s.getName()))).setMimeType(ContentService.MimeType.JSON);
  }
  const sheet = e.parameter.sheetName ? ss.getSheetByName(e.parameter.sheetName) : ss.getSheets()[0];
  const data = sheet ? sheet.getDataRange().getValues() : [];
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}`;
    };
  }
  const closeHelp = root.getElementById('close-help');
  if (closeHelp) closeHelp.onclick = () => {
    const modal = root.getElementById('modal-help');
    modal.classList.add('hidden');
    modal.style.display = 'none';
  };


  // Apply Button
  const btnApply = root.getElementById('btn-apply');
  if (btnApply) {
    btnApply.onclick = () => runApplyLogic(false);
  }

  // Update Price Only Button
  const btnUpdatePrice = root.getElementById('btn-update-price');
  if (btnUpdatePrice) {
    btnUpdatePrice.onclick = () => runApplyLogic(true);
  }

  // Back Button
  const btnBack = root.getElementById('btn-back');
  if (btnBack) {
    btnBack.onclick = () => {
      root.getElementById('view-mapping').classList.add('hidden');
      root.getElementById('view-source').classList.remove('hidden');
    };
  }

  // AI Config Events
  const btnSaveAi = root.getElementById('btn-save-ai');
  if (btnSaveAi) {
    btnSaveAi.onclick = () => {
      const key = root.getElementById('ai-api-key').value.trim();
      const model = root.getElementById('ai-model').value;
      const prompt = root.getElementById('ai-prompt').value;
      const auto = root.getElementById('ai-auto-trigger').checked;

      if (!key) return showStatus("API Key is required", "error");

      chrome.storage.local.set({
        geminiApiKey: key,
        geminiModel: model,
        geminiPrompt: prompt,
        geminiAutoTrigger: auto
      }, () => {
        showStatus('AI Settings Saved!', 'success');
        // Visual feedback on button
        const originalText = btnSaveAi.innerText;
        btnSaveAi.innerText = "Saved!";
        btnSaveAi.disabled = true;
        setTimeout(() => {
          btnSaveAi.innerText = originalText;
          btnSaveAi.disabled = false;
        }, 1500);
      });
    };
  }

  // Format Text Helpers
  setupFormatSizeHelper(root);

  // Load AI Settings
  chrome.storage.local.get(['geminiApiKey', 'geminiModel', 'geminiPrompt', 'geminiAutoTrigger', 'aiSettings'], (res) => {
    const s = res.aiSettings || {};
    if (root.getElementById('ai-api-key')) root.getElementById('ai-api-key').value = res.geminiApiKey || s.apiKey || '';
    if (root.getElementById('ai-model')) root.getElementById('ai-model').value = res.geminiModel || s.model || 'gemini-3-flash-preview';
    if (root.getElementById('ai-prompt')) root.getElementById('ai-prompt').value = res.geminiPrompt || s.prompt || '';
    if (root.getElementById('ai-auto-trigger')) root.getElementById('ai-auto-trigger').checked = (res.geminiAutoTrigger !== undefined) ? res.geminiAutoTrigger : (s.auto !== false);
  });

  // AI Toggle Visibility
  const toggleEye = root.getElementById('toggle-ai-key');
  if (toggleEye) {
    toggleEye.onclick = () => {
      const input = root.getElementById('ai-api-key');
      if (input.type === 'password') {
        input.type = 'text';
        toggleEye.style.opacity = '1';
      } else {
        input.type = 'password';
        toggleEye.style.opacity = '0.5';
      }
    };
  }

  // Load saved URL or Default
  const defaultUrl = "https://script.google.com/macros/s/AKfycbwfPJi85P3mHAaUf1rI0GxAO4TEHvjkFFKK1qnGfQLNjDjqkylQfq4wVfmF1lei9yB4lw/exec";
  chrome.storage.local.get(['scriptUrl'], (res) => {
    const url = res.scriptUrl || defaultUrl;
    if (root.getElementById('script-url')) {
      root.getElementById('script-url').value = url;
    }
    if (res.scriptUrl) {
      currentScriptUrl = res.scriptUrl;
      sidebarRoot.getElementById('not-connected-msg').classList.add('hidden');
    } else {
      sidebarRoot.getElementById('not-connected-msg').classList.remove('hidden');
    }
  });

} // End bindSidebarEvents

function setupFormatSizeHelper(root) {
  const col1Select = root.getElementById('select-variant-1');
  if (col1Select) {
    col1Select.addEventListener('change', () => {
      // auto logic if needed
    });
  }
}

function formatSizeString(val) {
  if (!val) return "";
  let s = String(val).trim();
  if (!s) return "";
  const upperCases = ['s', 'm', 'l', 'xl', 'xxl', '2xl', '3xl', '4xl', '5xl', 'xs', 'xxs', '3xl', '4xl', '5xl'];
  if (upperCases.includes(s.toLowerCase())) return s.toUpperCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Helper: Convert column index to letter (0->A, 1->B, 25->Z, 26->AA, etc.)
function columnIndexToLetter(index) {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

// --- API Helpers ---
async function fetchSheetList(url) {
  const res = await fetch(`${url}?action=getSheets`);
  const text = await res.text();
  let sheets = [];
  try {
    sheets = JSON.parse(text);
  } catch (e) {
    if (text.includes("<!DOCTYPE")) throw new Error("Invalid URL. Deploy as Web App.");
    throw new Error("Invalid response from script.");
  }

  if (!Array.isArray(sheets)) throw new Error("Script did not return a list.");

  sheetList = sheets;
  globalSheetListStore = sheets; // Store globally for back navigation
  renderSheetList(sheets);

  // Success state: Ensure main view shows list
  const notConnectedMsg = sidebarRoot.getElementById('not-connected-msg');
  if (notConnectedMsg) notConnectedMsg.classList.add('hidden');

  // Ensure Search is Visible
  const searchBar = sidebarRoot.getElementById('search-sheets');
  if (searchBar) searchBar.classList.remove('hidden');
}

function renderSheetList(list) {
  const container = sidebarRoot.getElementById('sheet-list');
  container.innerHTML = '';

  // Disconnect button removed (Redundant)

  if (list.length === 0) {
    container.innerHTML += '<div style="font-size:12px; color:#64748b; text-align:center;">No sheets found</div>';
    return;
  }

  list.forEach(name => {
    const btn = document.createElement('div');
    // Updated Modern High-Contrast Style
    Object.assign(btn.style, {
      padding: '12px',
      background: '#1e293b',
      color: '#f8fafc',
      border: '1px solid #475569',
      borderRadius: '8px',
      fontSize: '13px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      marginBottom: '6px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    });

    // Add arrow icon for affordance
    btn.innerHTML = `<span>${name}</span><span style="color:#64748b;">›</span>`;

    btn.onclick = (e) => fetchSheetData(name, e.currentTarget);
    btn.onmouseover = () => {
      btn.style.background = '#334155';
      btn.style.borderColor = '#f97316';
    };
    btn.onmouseout = () => {
      btn.style.background = '#1e293b';
      btn.style.borderColor = '#475569';
    };

    container.appendChild(btn);
  });
}

async function fetchSheetData(sheetName, btnEl) {
  let originalContent = "";
  if (btnEl) {
    originalContent = btnEl.innerHTML;
    btnEl.disabled = true;
    btnEl.innerHTML = `<span class="spinner"></span> <span style="flex:1; text-align:left">Loading...</span>`;
    btnEl.style.opacity = "0.7";
    // Ensure the original arrow is not lost if we just use Loading..., but let's keep it simple
  }
  showStatus(`Fetching ${sheetName}...`, 'normal');

  try {
    const fetchUrl = `${currentScriptUrl}?sheetName=${encodeURIComponent(sheetName)}`;
    const res = await fetch(fetchUrl);
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      processData(data, sheetName);
    } else {
      showStatus("Sheet is empty.", "error");
    }
  } catch (e) {
    showStatus("Error fetching data" + e.message, "error");
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = originalContent;
      btnEl.style.opacity = "1";
    }
  }
}

// ===========================================
// DATA LOGIC
// ===========================================
function processData(data, sourceName) {
  // Store RAW data (entire sheet) before table selection
  rawSheetData = data;

  currentData = data;
  // Detect tables
  const tables = detectTables(data);

  if (tables.length > 1) {
    showTableSelection(tables, sourceName);
  } else if (tables.length === 1) {
    useTable(tables[0], sourceName);
  } else {
    showStatus("No table found in data.", "error");
  }
}

// Advanced Table Detection (2D Split)
function detectTables(rawData) {
  if (!rawData || rawData.length === 0) return [];

  const isEmpty = (val) => !val || String(val).trim() === "";
  const isRowEmpty = (row) => !row || row.every(isEmpty);

  // 1. Determine Data Dimensions
  let maxWidth = 0;
  rawData.forEach(r => { if (r && r.length > maxWidth) maxWidth = r.length; });

  // 2. Identify Non-Empty Columns
  const validCols = [];
  for (let c = 0; c < maxWidth; c++) {
    let hasData = false;
    for (let r = 0; r < rawData.length; r++) {
      if (rawData[r] && !isEmpty(rawData[r][c])) {
        hasData = true;
        break;
      }
    }
    if (hasData) validCols.push(c);
  }

  // 3. Group into Vertical Strips (Column ranges)
  const strips = [];
  if (validCols.length > 0) {
    let currentStrip = [validCols[0]];
    for (let i = 1; i < validCols.length; i++) {
      // If columns are adjacent (or close? assume adjacent for now)
      if (validCols[i] === validCols[i - 1] + 1) {
        currentStrip.push(validCols[i]);
      } else {
        // Gap detected -> New Strip
        strips.push(currentStrip);
        currentStrip = [validCols[i]];
      }
    }
    strips.push(currentStrip);
  }

  const tables = [];

  // 4. Process Each Strip
  strips.forEach((strip, stripIdx) => {
    // Extract sub-data for this strip
    // Map original row index to data
    const stripData = rawData.map((row, idx) => ({
      d: strip.map(c => (row && row[c] !== undefined) ? row[c] : ""),
      idx: idx
    }));

    // 5. Vertical Scanning (Row Split)
    let currentBlock = [];
    let startRow = 0;

    const processBlock = (block, start) => {
      // Trim empty rows from start/end
      // Since we passed isRowEmpty logic during scanning, block might be mostly valid.
      // But 'stripData' includes ALL rows, empty or not?
      // No, we iterate stripData.

      if (block.length < 2) return; // Ignore single lines

      // Header is block[0]
      const headers = block[0].d;
      // Generate Name
      const keys = headers.filter(h => !isEmpty(h)).slice(0, 3).join(", ");

      tables.push({
        id: `strip${stripIdx}_row${start}`,
        name: keys ? keys : `Table (Row ${start + 1})`,
        // Convert back to simple array of arrays
        data: block.map(b => b.d),
        originalRow: start + 1
      });
    };

    stripData.forEach((item) => {
      const rowEmpty = item.d.every(isEmpty);

      if (rowEmpty) {
        if (currentBlock.length > 0) {
          processBlock(currentBlock, startRow);
          currentBlock = [];
        }
      } else {
        if (currentBlock.length === 0) startRow = item.idx;
        currentBlock.push(item);
      }
    });
    // Final block
    if (currentBlock.length > 0) {
      processBlock(currentBlock, startRow);
    }
  });

  return tables;
}


function showTableSelection(tables, sourceName) {
  const list = sidebarRoot.getElementById('sheet-list');
  // We are in tab-scan.

  // Clean up UI
  if (sidebarRoot.getElementById('search-sheets')) {
    sidebarRoot.getElementById('search-sheets').classList.add('hidden');
  }

  list.innerHTML = '';

  // Add "Back" header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #334155;';
  header.innerHTML = `<span style="font-size:12px; font-weight:bold; color:#f1641e;">Select Table in ${sourceName}</span>
                      <span id="btn-back-sheets" style="font-size:11px; color:#cbd5e1; cursor:pointer; text-decoration:underline;">Back</span>`;
  list.appendChild(header);

  // Use event delegation for back button after appending
  setTimeout(() => {
    const backBtn = list.querySelector('#btn-back-sheets');
    if (backBtn) backBtn.onclick = () => {
      // Restore sheet list
      if (sidebarRoot.getElementById('search-sheets')) {
        sidebarRoot.getElementById('search-sheets').classList.remove('hidden');
      }
      renderSheetList(globalSheetListStore || []);
    };
  }, 0);


  if (tables.length === 0) {
    list.innerHTML += '<div style="padding:20px; text-align:center; color:#94a3b8;">No data tables found.</div>';
    return;
  }

  tables.forEach(tbl => {
    const btn = document.createElement('div');
    // High contrast styles
    Object.assign(btn.style, {
      padding: '12px',
      background: '#1e293b', // Darker background
      border: '1px solid #475569', // Visible border
      borderRadius: '8px',
      marginBottom: '8px',
      cursor: 'pointer',
      transition: 'background 0.2s'
    });

    // Hover effect
    btn.onmouseover = () => btn.style.background = '#334155';
    btn.onmouseout = () => btn.style.background = '#1e293b';

    btn.innerHTML = `<div style="font-weight:600; font-size:14px; color:#f8fafc; margin-bottom:2px;">${tbl.name}</div>
                     <div style="font-size:11px; color:#cbd5e1;">${tbl.data.length - 1} items</div>`;
    btn.onclick = () => useTable(tbl, sourceName);
    list.appendChild(btn);
  });
}


function useTable(tableObj, sourceName) {
  currentData = tableObj.data;
  chrome.storage.local.set({ cachedData: currentData });

  const nameEl = sidebarRoot.getElementById('data-source-name');
  nameEl.textContent = `${sourceName} > ${tableObj.name}`;

  // Remove "Change Sheet" button if it exists (cleanup)
  const existingSwitch = sidebarRoot.getElementById('btn-switch-sheet');
  if (existingSwitch) existingSwitch.remove();


  populateMapping(currentData);

  sidebarRoot.getElementById('view-source').classList.add('hidden');
  sidebarRoot.getElementById('view-mapping').classList.remove('hidden');
}


function populateMapping(data) {
  const headers = data[0];
  const v1 = sidebarRoot.getElementById('select-variant-1');
  const v2 = sidebarRoot.getElementById('select-variant-2');
  const p = sidebarRoot.getElementById('select-price');
  const desc = sidebarRoot.getElementById('select-description');

  const opts = '<option value="">-- Select --</option>' +
    headers.map((h, i) => `<option value="${i}">${h || 'Col ' + i}</option>`).join('');

  v1.innerHTML = opts;
  v2.innerHTML = opts;
  p.innerHTML = opts;


  // Auto-detect and populate description cells
  const descSelect = sidebarRoot.getElementById('select-description');
  if (descSelect && rawSheetData) {
    // Find all cells with text longer than 100 characters (likely descriptions)
    const descriptionCandidates = [];

    // Get the table boundaries to exclude cells within the selected table
    // Note: currentData is the table data, we need to find where it is in rawSheetData
    // For simplicity, exclude table rows by checking if content matches

    // Scan entire raw sheet
    for (let rowIdx = 0; rowIdx < rawSheetData.length; rowIdx++) {
      const row = rawSheetData[rowIdx];
      if (!row) continue;

      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        const cellValue = row[colIdx];
        if (!cellValue) continue;

        const text = String(cellValue).trim();

        // Check if this looks like a description (>100 chars)
        if (text.length >= 100) {
          // Convert indices to cell address (e.g., row 10, col 7 -> H11)
          const colLetter = columnIndexToLetter(colIdx);
          const rowNum = rowIdx + 1; // 1-indexed
          const cellAddress = colLetter + rowNum;

          const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;

          descriptionCandidates.push({
            address: cellAddress,
            row: rowNum,
            col: colIdx,
            text: text,
            preview: preview
          });
        }
      }
    }

    // Populate dropdown
    if (descriptionCandidates.length > 0) {
      descSelect.innerHTML = '<option value="">-- Select Description --</option>' +
        descriptionCandidates.map(candidate =>
          `<option value="${candidate.address}" data-text="${encodeURIComponent(candidate.text)}">
            ${candidate.address}: ${candidate.preview}
          </option>`
        ).join('');
    } else {
      descSelect.innerHTML = '<option value="">-- No descriptions found --</option>';
    }

    // Add preview on change
    descSelect.onchange = () => {
      const selectedValue = descSelect.value;
      const preview = sidebarRoot.getElementById('description-preview');

      if (!preview) return;

      if (!selectedValue) {
        preview.textContent = '';
        return;
      }

      // Get the full text from the selected option
      const selectedOption = descSelect.options[descSelect.selectedIndex];
      const encodedText = selectedOption.getAttribute('data-text');

      if (encodedText) {
        const fullText = decodeURIComponent(encodedText);
        const previewText = fullText.length > 100 ? fullText.substring(0, 100) + '...' : fullText;
        preview.textContent = `Preview: "${previewText}"`;
        preview.style.color = '#22c55e';
      }
    };
  }

  // Custom Discount Toggle Logic
  const distSel = sidebarRoot.getElementById('select-discount');
  const custInput = sidebarRoot.getElementById('input-custom-discount');
  if (distSel && custInput) {
    distSel.onchange = () => {
      if (distSel.value === 'custom') custInput.classList.remove('hidden');
      else custInput.classList.add('hidden');
    };
  }
}

// ===========================================
// APPLY LOGIC (Automation)
// ===========================================
// ===========================================
// APPLY LOGIC (Automation)
// ===========================================
async function runApplyLogic(isUpdateOnly = false) {
  const v1Idx = sidebarRoot.getElementById('select-variant-1').value;
  const v2Idx = sidebarRoot.getElementById('select-variant-2').value;
  const pIdx = sidebarRoot.getElementById('select-price').value;

  // Pricing Logic (Same as before)
  const distSel = sidebarRoot.getElementById('select-discount');
  const custInput = sidebarRoot.getElementById('input-custom-discount');
  const currSel = sidebarRoot.getElementById('select-currency-to');

  let discount = 0;
  if (distSel && distSel.value === 'custom') {
    if (custInput && custInput.value) discount = parseFloat(custInput.value) / 100;
  } else if (distSel) {
    discount = parseFloat(distSel.value);
  }

  let targetCurrency = 'USD';
  let exchangeRate = 1;

  if (currSel) {
    targetCurrency = currSel.value;
    console.log(`[EtsyPro] Selected Currency: ${targetCurrency}`);
  } else {
    console.warn("[EtsyPro] Currency selector not found!");
  }

  // Check for Manual Rate Override
  const rateInput = sidebarRoot.getElementById('input-custom-rate');
  if (rateInput && rateInput.value) {
    const manualRate = parseFloat(rateInput.value);
    if (!isNaN(manualRate) && manualRate > 0) {
      exchangeRate = manualRate;
      console.log(`[EtsyPro] Using Manual Rate: ${exchangeRate}`);
      showStatus(`Using Custom Rate: ${exchangeRate}`, "success");
    }
  }

  // Check Extra Amount
  const extraInput = sidebarRoot.getElementById('input-extra-amount');
  let extraAmount = 0;
  if (extraInput && extraInput.value) {
    extraAmount = parseFloat(extraInput.value);
    if (isNaN(extraAmount)) extraAmount = 0;
    console.log(`[EtsyPro] Extra Amount to Add: ${extraAmount}`);
  }
  // Only fetch if NO manual rate provided
  else if (targetCurrency !== 'USD') {
    showStatus(`Fetching ${targetCurrency} Rate (Wise)...`, 'pending');
    try {
      const res = await chrome.runtime.sendMessage({
        action: "fetch_exchange_rates",
        target: targetCurrency
      });

      if (res && res.status === 'success' && res.rate) {
        exchangeRate = res.rate;
        const source = res.source || 'API';
        console.log(`[EtsyPro] Rate Success (${source}). USD -> ${targetCurrency}: ${exchangeRate}`);
        showStatus(`Rate: ${exchangeRate} (${source}). Applying...`, "success");
      } else {
        showStatus("Rate Fetch Failed. Check Console.", "error");
        console.error("[EtsyPro] Wise API Error response:", res);
      }
    } catch (e) {
      console.error("[EtsyPro] Fetch Exception:", e);
      showStatus("Network Error. check permissions.", "error");
    }
  }

  // Check Rounding Setting
  const roundSel = sidebarRoot.getElementById('select-rounding');
  let roundingMode = 'none';
  if (roundSel) roundingMode = roundSel.value;

  if (v1Idx === "") {
    // Simple Price Mode (No Variants)
    if (pIdx !== "") {
      console.log("Simple Price Mode detected.");
      const rawPrice = currentData[1][pIdx]; // Row 1 (Index 1) is first data row

      // Calculate Price
      let finalPrice = 0;
      try {
        let val = parseFloat(String(rawPrice).replace(/[^0-9.]/g, ''));
        if (!isNaN(val)) {
          let converted = val * exchangeRate;
          if (extraAmount) converted += extraAmount;
          if (discount > 0 && discount < 1) converted = converted / (1 - discount);

          // Rounding
          if (roundingMode === '99') converted = Math.floor(converted) + 0.99;
          else if (roundingMode === '95') converted = Math.floor(converted) + 0.95;
          else if (roundingMode === '00') converted = Math.round(converted);

          finalPrice = converted.toFixed(2);
        }
      } catch (e) { console.error("Price math error", e); } // Fallback 0

      if (finalPrice) {
        const simpleInput = document.getElementById('listing-price-input') || document.querySelector('input[name="variations.configuration.price"]');
        if (simpleInput) {
          simulateTyping(simpleInput, finalPrice);
          showStatus(`Simple Price Filled: ${finalPrice}`, "success");
        } else {
          showStatus("Price Input Not Found on Page", "error");
        }
      } else {
        showStatus("Invalid Price in Sheet", "error");
      }

      // Fill description if selected (for non-variant products)
      await fillDescriptionIfSelected();
      return;
    }

    showStatus("Select Variant 1 or Price Column", "error");
    return;
  }

  console.log("[EtsyPro] Final Params:", {
    discount: discount,
    markup: (discount > 0 ? (1 / (1 - discount)).toFixed(2) + "x" : "None"),
    currency: targetCurrency,
    rate: exchangeRate,
    extra: extraAmount,
    rounding: roundingMode,
    mode: isUpdateOnly ? "UPDATE_PRICE_ONLY" : "FULL_AUTOMATION"
  });

  // Store indices globally for price filling
  window.etsyProMappingIndices = {
    v1Idx: parseInt(v1Idx),
    v2Idx: v2Idx ? parseInt(v2Idx) : null,
    pIdx: parseInt(pIdx),
    pricing: {
      discount: discount,
      rate: exchangeRate,
      extra: extraAmount,
      currency: targetCurrency,
      rounding: roundingMode,
      enabled: (discount > 0 || exchangeRate !== 1 || roundingMode !== 'none' || extraAmount !== 0)
    }
  };

  // ===============================================
  // 1. DATA PRE-PROCESSING (Fill Down Merged Cells)
  // ===============================================
  for (let i = 2; i < currentData.length; i++) {
    const prevRow = currentData[i - 1];
    const currentRow = currentData[i];
    const v1Val = currentRow[v1Idx];
    if (!v1Val || v1Val.toString().trim() === "") {
      currentRow[v1Idx] = prevRow[v1Idx];
    }
  }

  // IF UPDATE ONLY: Skip variation creation, just fill prices
  if (isUpdateOnly) {
    showStatus("Updating Prices Only...", "normal");
    try {
      await fillPricesInTable([]);
      showStatus("Prices Updated!", "success");
    } catch (e) {
      console.error("Update Price Error", e);
      showStatus("Error updating prices", "error");
    }
    return;
  }

  // Prepare Data Structure (Normal Flow)
  const variations = [];
  const v1Head = currentData[0][v1Idx];

  // Format Size Heuristic
  const isSizeV1 = String(v1Head).toLowerCase().includes('size');
  const v1Options = [...new Set(currentData.slice(1).map(r => {
    let val = r[v1Idx];
    if (isSizeV1 && typeof formatSizeString === 'function') val = formatSizeString(val);
    return val;
  }).filter(x => x))]; // Unique, non-empty

  variations.push({
    header: v1Head,
    options: v1Options
  });

  if (v2Idx) {
    const v2Head = currentData[0][v2Idx];
    const isSizeV2 = String(v2Head).toLowerCase().includes('size');
    const v2Options = [...new Set(currentData.slice(1).map(r => {
      let val = r[v2Idx];
      if (isSizeV2 && typeof formatSizeString === 'function') val = formatSizeString(val);
      return val;
    }).filter(x => x))];

    variations.push({
      header: v2Head,
      options: v2Options
    });
  }

  showStatus("Running Automation...", "success");
  await runEtsyAutomation(variations);
  showStatus("Done!", "success");
}

function showStatus(msg, type) {
  const el = sidebarRoot.getElementById('status-area');
  el.textContent = msg;
  el.className = `status-msg ${type}`;
  if (type !== 'error') setTimeout(() => el.textContent = '', 3000);
}

// ===========================================
// AUTOMATION IMPL
// ===========================================
async function runEtsyAutomation(variations) {
  console.log("Starting Etsy Automation...", variations);

  for (let i = 0; i < variations.length; i++) {
    const variation = variations[i];
    console.log(`Processing Variant ${i + 1}: ${variation.header}`);

    // 1. Click "Add variations" (or "Add a variation" for 2nd+)
    const btns = Array.from(document.querySelectorAll('button'));

    let addBtn;
    if (i === 0) {
      // First time: "Add variations"
      addBtn = btns.find(b => b.textContent.includes("Add variations"));
    } else {
      // Second time: "Add a variation"
      addBtn = btns.find(b => b.textContent.includes("Add a variation"));
    }

    if (addBtn) {
      addBtn.click();
      await sleep(500); // Reduced from 1500
    } else {
      console.warn(`Button to add variation ${i + 1} not found. Assuming modal might be open.`);
    }

    // 2. Click "Create your own"
    const createOwnBtn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.includes("Create your own"));
    if (createOwnBtn) {
      createOwnBtn.click();
      await sleep(500); // Reduced from 1500
    }

    // 3. Fill "Name"
    const nameInput = document.getElementById('le-unstructured-variation-name-input');
    if (nameInput) {
      simulateTyping(nameInput, variation.header || `Variation ${i + 1}`);
      await sleep(200); // Reduced from 500
    }

    // 4. Fill Options
    for (const opt of variation.options) {
      const optionInput = document.getElementById('le-unstructured-variation-option-input');
      if (!optionInput) break;

      simulateTyping(optionInput, opt);
      await sleep(100); // Reduced from 400

      // 5. Click "Add"
      // User HTML: Input and Button are siblings in the same container.
      // <div ...> <input ...> <button ...>Add</button> </div>
      let btnAddOpt = null;
      if (optionInput.parentElement) {
        btnAddOpt = optionInput.parentElement.querySelector('button');
      }

      // Fallback if structure changes: find by text globally (be careful)
      if (!btnAddOpt) {
        const allBtns = Array.from(document.querySelectorAll('button.wt-btn--transparent'));
        btnAddOpt = allBtns.find(b => b.textContent.trim() === "Add" && !b.disabled);
      }

      if (btnAddOpt) {
        btnAddOpt.click();
        await sleep(100); // Reduced from 400
      } else {
        // Second Fallback: Enter key
        optionInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        await sleep(100);
      }
    }

    // 6. Click "Done" (only the visible modal's Done button)
    // Strategy: Find the modal that's currently visible (not behind others)
    // Look for the overlay that contains our variation input
    await sleep(200); // Small wait to ensure all options are processed

    const modalOverlays = Array.from(document.querySelectorAll('.wt-overlay__modal, [role="dialog"]'));
    let btnDone = null;

    // Find the modal that contains our variation name input (the active one)
    const activeModal = modalOverlays.find(modal => {
      return modal.querySelector('#le-unstructured-variation-name-input') !== null;
    });

    if (activeModal) {
      // Find Done button ONLY within this specific modal
      const doneBtns = Array.from(activeModal.querySelectorAll('button.wt-btn--filled'));
      btnDone = doneBtns.find(b => b.textContent.trim() === "Done");
    }

    // Fallback: if we can't find it specifically, try the footer area
    if (!btnDone) {
      const footers = Array.from(document.querySelectorAll('.wt-overlay__footer__action'));
      for (const footer of footers) {
        const btn = footer.querySelector('button.wt-btn--filled');
        if (btn && btn.textContent.trim() === "Done") {
          btnDone = btn;
          break;
        }
      }
    }

    if (btnDone) {
      btnDone.click();
      await sleep(1000); // Reduced from 2000
    } else {
      console.warn("Done button not found");
    }
  }

  // ===================================================
  // STEP 2: ENABLE "PRICES VARY" AND APPLY
  // ===================================================
  console.log("Step 2: Enabling 'Prices vary' toggle...");
  await sleep(500); // Reduced from 2000

  // Find the "Prices vary" toggle
  // Look for text "Prices vary" and find the associated checkbox
  const labels = Array.from(document.querySelectorAll('label'));
  const pricesVaryLabel = labels.find(l => l.textContent.includes("Prices vary"));

  if (pricesVaryLabel) {
    // Get the associated checkbox
    const checkboxId = pricesVaryLabel.getAttribute('for');
    const checkbox = document.getElementById(checkboxId);

    if (checkbox && !checkbox.checked) {
      console.log("Clicking 'Prices vary' checkbox...");
      checkbox.click();
      console.log("Toggled 'Prices vary' ON");

      // Wait LONGER for Etsy to validate and enable the Apply button
      console.log("Waiting 1s for validation...");
      await sleep(1000); // Reduced from 3000
    } else {
      console.log("'Prices vary' already ON or checkbox not found");
    }
  } else {
    console.warn("Could not find 'Prices vary' label");
  }

  // Click "Apply" button
  // Be ultra-specific: Only in .wt-overlay__footer__action, with class wt-btn--filled, text "Apply"
  let applyBtn = null;

  // Find the specific footer container first
  const actionFooter = document.querySelector('.wt-overlay__footer__action');
  console.log("Found action footer?", !!actionFooter);

  if (actionFooter) {
    const btn = actionFooter.querySelector('button.wt-btn--filled');
    if (btn && btn.textContent.trim() === "Apply") {
      applyBtn = btn;
      console.log("Found Apply button (ultra-specific)");
      console.log("Button disabled?", btn.disabled);
      console.log("Button aria-disabled?", btn.getAttribute('aria-disabled'));
    }
  }

  // Fallback: Search all overlay footers
  if (!applyBtn) {
    console.log("Trying fallback search...");
    const allFooters = Array.from(document.querySelectorAll('.wt-overlay__footer'));
    console.log(`Found ${allFooters.length} overlay footers`);

    for (const footer of allFooters) {
      const actionArea = footer.querySelector('.wt-overlay__footer__action');
      if (actionArea) {
        const btn = actionArea.querySelector('button');
        if (btn && btn.textContent.trim() === "Apply") {
          applyBtn = btn;
          console.log("Found Apply via fallback");
          break;
        }
      }
    }
  }

  // ===================================================
  // STEP 3: CLICK APPLY TO GENERATE TABLE
  // ===================================================
  console.log("Step 3: Clicking Apply to generate table...");

  let applyClicked = false;
  let attempts = 0;

  while (!applyClicked && attempts < 5) {
    attempts++;
    console.log(`Apply Attempt ${attempts}...`);

    // Strategy using headers from user's DOM snapshot: 
    // Look for the modal with title "Manage variations"
    const headers = Array.from(document.querySelectorAll('.wt-text-title-larger'));
    const manageHeader = headers.find(h => h.textContent.trim() === "Manage variations");

    let targetApplyBtn = null;

    if (manageHeader) {
      // Traverse up to find the modal container
      const modal = manageHeader.closest('.wt-overlay__modal');
      if (modal) {
        const footer = modal.querySelector('.wt-overlay__footer__action');
        if (footer) {
          const btn = footer.querySelector('button.wt-btn--filled');
          if (btn && btn.textContent.trim() === "Apply") {
            targetApplyBtn = btn;
          }
        }
      }
    }

    // Fallback if header specific search fails
    if (!targetApplyBtn) {
      const footers = Array.from(document.querySelectorAll('.wt-overlay__footer__action'));
      for (const footer of footers) {
        const btn = footer.querySelector('button.wt-btn--filled');
        if (btn && btn.textContent.trim() === "Apply" && btn.offsetParent !== null) { // Visible check
          targetApplyBtn = btn;
          break;
        }
      }
    }

    if (targetApplyBtn) {
      console.log("Found Apply button!", targetApplyBtn);

      // Ensure enabled
      targetApplyBtn.disabled = false;
      targetApplyBtn.removeAttribute('aria-disabled');

      targetApplyBtn.scrollIntoView({ block: 'center' });
      await sleep(200);
      targetApplyBtn.click();
      applyClicked = true;
      console.log("Apply Clicked Successfully.");

    } else {
      console.warn("Apply button not found yet, waiting...");
      await sleep(1000); // Wait for modal/button
    }
  }

  if (!applyClicked) {
    console.error("Failed to click Apply after multiple attempts.");
    return;
  }

  await sleep(4000); // Long wait for table generation after apply

  // ===================================================
  // STEP 3: FILL PRICES IN THE TABLE
  // ===================================================
  console.log("Step 3: Filling prices...");

  // We need the Price column index and the original data with all 3 columns
  // The variations array only has the header and options
  // We need to access currentData (the full table data)

  // Wait for the function to be called with the price data
  // Actually, we need to restructure - the price data should be passed in

  // For now, let's assume we can access currentData globally
  // And we have the column indices

  await fillPricesInTable(variations);

  // ===================================================
  // STEP 4: FILL DESCRIPTION (IF SELECTED)
  // ===================================================
  await fillDescriptionIfSelected();
}

// Helper function to fill prices
async function fillPricesInTable(variations) {
  // Get all price input fields
  const priceInputs = Array.from(document.querySelectorAll('input[data-testid="price-input"]'));

  if (priceInputs.length === 0) {
    console.warn("No price inputs found");
    return;
  }

  console.log(`Found ${priceInputs.length} price input fields`);

  // Get the table rows
  const tableRows = Array.from(document.querySelectorAll('.wt-table__body .wt-table__row'));

  // For each row, extract the variant values and find matching price
  // For each row, extract the variant values and find matching price
  for (let i = 0; i < tableRows.length; i++) {
    const row = tableRows[i];

    // Find the price input specifically WITHIN this row
    const priceInput = row.querySelector('input[data-testid="price-input"]');
    if (!priceInput) {
      console.warn(`Row ${i}: No price input found.`);
      continue;
    }

    // Extract variant values from the row
    // The row structure has: checkbox | variant1 | variant2 | price | ... | visible
    const cells = Array.from(row.querySelectorAll('th, td'));

    // Find cells with variant values (not inputs, not checkboxes)
    const variantCells = cells.filter(c => {
      // Find text-only cells that are not labels/inputs
      return c.textContent.trim() &&
        !c.querySelector('input') &&
        !c.querySelector('.wt-checkbox') &&
        !c.querySelector('button') &&
        c.className.includes('wt-no-wrap');
    });

    let variant1Value = null;
    let variant2Value = null;

    if (variantCells.length >= 1) variant1Value = variantCells[0].textContent.trim();
    if (variantCells.length >= 2) variant2Value = variantCells[1].textContent.trim();

    // Find visible visibility switch (if it exists)
    // Looking for a checkbox inside a wt-switch wrapper in the LAST cell usually
    const visibilitySwitch = row.querySelector('input[type="checkbox"].wt-switch');

    console.log(`Processing Row ${i}: V1="${variant1Value}", V2="${variant2Value}"`);

    // Find the matching row in currentData
    let price = findPriceForVariants(variant1Value, variant2Value);

    // APPLY PRICING MATH (If enabled)
    if (price && window.etsyProMappingIndices && window.etsyProMappingIndices.pricing && window.etsyProMappingIndices.pricing.enabled) {
      try {
        // 1. Parse raw price (handle currency symbols if present in sheet e.g. "$10.00")
        // We treat comma as dot if local format requires, but usually spreadsheets are fairly standard.
        // Let's safe-parse: keep only digits and dots.
        let rawStr = String(price).replace(/[^0-9.]/g, '');
        let val = parseFloat(rawStr);

        if (!isNaN(val)) {
          const { rate, discount, extra } = window.etsyProMappingIndices.pricing;

          // 2. Convert
          let converted = val * rate;

          // 2.5 Add Extra (add/subtract fixed amount)
          if (extra) converted += extra;

          // 3. Markup
          if (discount > 0 && discount < 1) {
            converted = converted / (1 - discount);
          }

          // 4. Rounding Logic
          const { rounding } = window.etsyProMappingIndices.pricing || { rounding: 'none' };

          if (rounding === '99') {
            converted = Math.floor(converted) + 0.99;
          } else if (rounding === '95') {
            converted = Math.floor(converted) + 0.95;
          } else if (rounding === '00') {
            converted = Math.round(converted);
          }

          price = converted.toFixed(2);
        }
      } catch (e) {
        console.error("Pricing Math Error:", e);
      }
    }

    // Check if price is valid (not null, not empty string)
    // Note: If price is 0, we treat it as valid. If "", invalid.
    const hasPrice = (price !== null && price !== undefined && price.toString().trim() !== "");

    if (hasPrice) {
      if (priceInput) {
        console.log(`  -> Found Price: ${price} - Filling...`);
        simulateTyping(priceInput, price.toString());
        await sleep(50);
      }

      // Ensure Enabled
      if (visibilitySwitch && !visibilitySwitch.checked) {
        console.log("  -> Re-enabling row");
        visibilitySwitch.click();
      }

    } else {
      console.warn(`  -> Price NOT found/empty for ${variant1Value} | ${variant2Value}. Disabling row.`);

      // Disable Row
      if (visibilitySwitch) {
        if (visibilitySwitch.checked) {
          visibilitySwitch.click(); // Toggle OFF
          console.log("  -> Toggled Visibility OFF");
        } else {
          console.log("  -> Already OFF");
        }
      } else {
        console.warn("  -> Visibility switch not found!");
      }
    }
  }

  console.log("Prices filled!");
}

function findPriceForVariants(v1, v2) {
  if (!currentData) return null;

  if (!window.etsyProMappingIndices) {
    console.warn("Mapping indices not found");
    return null;
  }

  const { v1Idx, v2Idx, pIdx } = window.etsyProMappingIndices;

  // Normalize helper
  // Removing extra spaces and case sensitivity issues
  const normalize = (val) => String(val || "").toLowerCase().replace(/\s+/g, '').trim();

  const targetV1 = normalize(v1);
  const targetV2 = v2 ? normalize(v2) : null;

  const rows = currentData.slice(1);

  for (const row of rows) {
    const rowV1 = normalize(row[v1Idx]);

    let match = false;

    if (v2Idx !== null) {
      const rowV2 = normalize(row[v2Idx]);
      match = (rowV1 === targetV1) && (rowV2 === targetV2);
    } else {
      match = (rowV1 === targetV1);
    }

    if (match) {
      return row[pIdx];
    }
  }

  return null;
}

async function fillDescriptionIfSelected() {
  console.log("[EtsyPro] Checking for description to fill...");

  // Get the selected cell address from dropdown
  const descSelect = sidebarRoot?.getElementById('select-description');
  if (!descSelect || !descSelect.value || descSelect.value === '') {
    console.log("[EtsyPro] No description selected, skipping.");
    return;
  }

  const cellAddress = descSelect.value.trim().toUpperCase();
  console.log("[EtsyPro] Description cell address:", cellAddress);

  // Get the text directly from the selected option's data attribute
  const selectedOption = descSelect.options[descSelect.selectedIndex];
  const encodedText = selectedOption.getAttribute('data-text');

  if (!encodedText) {
    console.warn("[EtsyPro] No text data found in selected option");
    showToast("Description data not found", "error");
    return;
  }

  const descriptionText = decodeURIComponent(encodedText);
  console.log("[EtsyPro] Found description text:", descriptionText.substring(0, 50) + "...");

  // Find and fill the description textarea
  const descTextarea = document.getElementById('listing-description-textarea');
  if (descTextarea) {
    descTextarea.focus();
    descTextarea.value = descriptionText;
    descTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    descTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    descTextarea.blur();

    console.log("[EtsyPro] ✅ Description filled successfully!");
    showToast("Description filled!", "success");
  } else {
    console.warn("[EtsyPro] Description textarea not found");
    showToast("Description field not found", "error");
  }
}

function simulateTyping(element, value) {
  element.focus();
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.blur();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ===========================================
// AI / GEMINI AUTOMATION
// ===========================================
let processedImages = new Set();
let aiObserver = null;
let lastImageSrc = null;
let hasAutoRun = false; // Track if we've already auto-generated once

// Add styles for progress bar
const progressBarStyles = document.createElement('style');
progressBarStyles.textContent = `
  #etsy-pro-progress-bar {
    position: fixed;
    top: 0;
    left: 0;
    height: 6px; /* Thickened from 4px to 6px */
    background: #f1641e; /* Solid Etsy Orange for cleaner look */
    box-shadow: 0 2px 4px rgba(241, 100, 30, 0.4); /* Glow effect */
    /* Removed strobe animation for "eye safety" */
    transition: width 0.4s ease-out;
    z-index: 9999999999;
    width: 0%;
  }
    transition: width 0.3s ease;
  }
  @keyframes gradientMove {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }
`;
document.head.appendChild(progressBarStyles);

// Flag to coordinate cleanup and AI
let isCleaningUp = false;
let currentPageMode = 'unknown'; // 'create', 'copy', 'edit'

function setupAiObserver() {
  if (aiObserver) return; // Already running

  console.log("[EtsyPro] Starting AI Image Observer...");
  console.log("[EtsyPro] Current URL:", window.location.href);

  // Detect page type using Etsy's actual URL patterns
  const url = window.location.href;
  const isCopyPage = url.includes('/listing-editor/copy/');
  const isEditPage = url.includes('/listing-editor/edit/');
  const isCreatePage = url.includes('/listing-editor/create');

  // Set global mode
  if (isCopyPage) currentPageMode = 'copy';
  else if (isEditPage) currentPageMode = 'edit';
  else if (isCreatePage) currentPageMode = 'create';

  // If Edit page, attempt to grab the first existing listing image as a fallback
  if (isEditPage) {
    currentPageMode = 'edit';
    console.log("[EtsyPro] Chế độ Edit: Đang tìm ảnh có sẵn...");

    // Wait briefly for Etsy to render images, then capture the first one
    setTimeout(() => {
      try {
        const existingImg = document.querySelector('[data-clg-id="WtUploadArea"] img');
        if (existingImg && existingImg.src) {
          lastImageSrc = existingImg.src;
          console.log("[EtsyPro] Đã tìm thấy ảnh gốc:", lastImageSrc.substring(0, 50));
        }
      } catch (e) {
        console.warn('[EtsyPro] Fallback image scan failed:', e);
      }
    }, 2000);
  }

  const needsCleanup = isCopyPage; // Only Copy needs cleanup, NOT Edit

  console.log("[EtsyPro] Page Mode:", {
    mode: currentPageMode,
    copy: isCopyPage,
    edit: isEditPage,
    create: isCreatePage,
    needsCleanup: needsCleanup
  });

  // 1. CLEANUP ROUTINE (Only for Copy pages)
  const performCleanup = async () => {
    if (!needsCleanup) {
      console.log(`[EtsyPro] ✅ ${currentPageMode.toUpperCase()} mode - Skipping cleanup.`);
      isCleaningUp = false;
      return;
    }

    console.log("[EtsyPro] 🔄 COPY mode - Starting cleanup...");
    isCleaningUp = true;

    // Wait for page to fully load
    await new Promise(r => setTimeout(r, 1500));

    try {
      const mediaItems = Array.from(document.querySelectorAll('[data-clg-id="WtUploadArea"] .le-media-grid__item, [data-clg-id="WtUploadArea"] > div > div > div[role="button"]'));

      console.log(`[EtsyPro] Found ${mediaItems.length} media items to check`);
      let deletedCount = 0;

      for (const item of mediaItems) {
        const img = item.querySelector('img');
        const video = item.querySelector('video');

        // Skip if video or no image
        if (video || !img) {
          console.log("[EtsyPro] Skipping (video or no img)");
          continue;
        }

        // Find delete button using multiple methods
        const buttons = Array.from(item.querySelectorAll('button'));

        const deleteBtn = buttons.find(btn => {
          if (btn.getAttribute('data-testid') === 'image-delete-button') return true;
          const svgPath = btn.querySelector('path[d^="M15 4H9V2h6"]');
          if (svgPath) return true;
          const ariaLabel = btn.getAttribute('aria-label');
          if (ariaLabel && ariaLabel.toLowerCase().includes('delete')) return true;
          if (btn.classList.contains('wt-text-brick') && btn.querySelector('svg')) return true;
          return false;
        });

        if (deleteBtn) {
          console.log(`[EtsyPro] ✂️ Deleting image: ${img.src.substring(0, 50)}...`);
          deleteBtn.click();
          deletedCount++;
          await new Promise(r => setTimeout(r, 150));
        } else {
          console.warn("[EtsyPro] ⚠️ Could not find delete button");
        }
      }

      if (deletedCount > 0) {
        showToast(`🗑️ Cleared ${deletedCount} old images`, "success");
        console.log(`[EtsyPro] ✅ Successfully deleted ${deletedCount} images`);
      } else {
        console.warn("[EtsyPro] ⚠️ No images deleted");
      }
    } catch (e) {
      console.error("[EtsyPro] ❌ Cleanup error:", e);
    } finally {
      setTimeout(() => {
        isCleaningUp = false;
        console.log("[EtsyPro] ✅ Cleanup complete. Listening for new uploads...");
      }, 1000);
    }
  };

  performCleanup();

  // Observer on body to catch dynamic uploads
  const targetNode = document.body;
  const config = { childList: true, subtree: true };

  aiObserver = new MutationObserver((mutationsList) => {
    // If cleaning, ignore all mutations
    if (isCleaningUp) return;

    // Only perform automatic image-scanning when NOT in Edit mode.
    // This prevents the AI from auto-running on Edit pages while
    // still allowing manual Regen buttons to be available.
    if (currentPageMode !== 'edit') {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              // Check for images inside WtUploadArea
              if (node.tagName === 'IMG' && node.closest('[data-clg-id="WtUploadArea"]')) {
                if (!isCleaningUp) {
                  console.log(`[EtsyPro] 📸 New image detected in ${currentPageMode.toUpperCase()} mode!`);
                  // Pass mode to handleNewImage
                  setTimeout(() => handleNewImage(node, false, currentPageMode), 800);
                }
              } else {
                // Deep check
                if (node.querySelectorAll) {
                  const imgs = node.querySelectorAll('[data-clg-id="WtUploadArea"] img');
                  if (imgs.length > 0) {
                    console.log(`[EtsyPro] 📸 ${imgs.length} images detected (${currentPageMode})`);
                  }
                  imgs.forEach(img => {
                    if (!isCleaningUp) setTimeout(() => handleNewImage(img, false, currentPageMode), 800);
                  });
                }
              }
            }
          });
        }
      }
    }

    // Always inject the manual Regen buttons regardless of mode
    injectIndependentRegenButtons();
  });

  aiObserver.observe(targetNode, config);

  // Run once on setup so buttons appear immediately on Edit pages
  injectIndependentRegenButtons();
  console.log("[EtsyPro] Manual Regen buttons enabled for Edit mode.");
}

// Call this from checkAndInject
setupAiObserver();

// Handle New Image (Auto or Manual Regen)
// mode: 'create' | 'copy' | 'edit' | 'all' (for manual regen)
async function handleNewImage(imgNode, isRegenerate = false, mode = 'all') {
  let src = "";
  if (isRegenerate) {
    src = imgNode.src;
  } else {
    src = imgNode.src;
    // Basic filters for new images
    if (!src || src.includes("placeholder") || processedImages.has(src)) return;
    if (src.includes("data:image/gif")) return;
    if (imgNode.classList && !imgNode.classList.contains('wt-object-fit-contain')) return;

    await new Promise(r => setTimeout(r, 500));
    if (processedImages.has(imgNode.src)) return;
    processedImages.add(imgNode.src);
  }

  lastImageSrc = src;

  // Only Auto-Run ONCE per session/page load
  if (!isRegenerate && hasAutoRun) {
    console.log("[EtsyPro] Auto-run already done. Skipping subsequent image.");
    return;
  }

  console.log("[EtsyPro] Processing Image:", src, "Mode:", mode);

  // Determine what to generate based on mode
  // For manual regen, 'mode' contains 'title', 'tags', or 'all'
  let targetGeneration = mode;

  if (!isRegenerate) {
    if (mode === 'create') {
      targetGeneration = 'all';
      console.log("[EtsyPro] CREATE mode: Will generate TITLE + TAGS");
    } else if (mode === 'copy') {
      targetGeneration = 'all';
      console.log("[EtsyPro] COPY mode: Will generate TITLE + TAGS");
    } else {
      console.log("[EtsyPro] Unknown mode, defaulting to 'all'");
      targetGeneration = 'all';
    }
  }

  // Check Settings
  const storage = await chrome.storage.local.get(['geminiApiKey', 'geminiModel', 'geminiPrompt', 'geminiAutoTrigger', 'aiSettings']);

  // Backwards compatibility
  const apiKey = storage.geminiApiKey || storage.aiSettings?.apiKey;
  const model = storage.geminiModel || storage.aiSettings?.model || 'gemini-3-flash-preview';
  const prompt = storage.geminiPrompt || storage.aiSettings?.prompt;
  const auto = (storage.geminiAutoTrigger !== undefined) ? storage.geminiAutoTrigger : (storage.aiSettings?.auto !== false);

  if (!isRegenerate && (!apiKey || !auto)) {
    if (!apiKey) console.log("[EtsyPro] AI Key missing.");
    return;
  }

  if (!isRegenerate) {
    hasAutoRun = true; // Mark as done
    const genText = targetGeneration === 'title' ? 'Title' : 'Title + Tags';
    showToast(`Auto-Generating ${genText}...`, "info");
  } else {
    showToast(`Regenerating ${targetGeneration === 'all' ? 'Info' : targetGeneration}...`, "info");
  }

  showProgressBar();

  let payload = {
    action: "generate_listing_info",
    model: model,
    apiKey: apiKey,
    prompt: prompt
  };

  // Handle Blob URLs vs Remote URLs
  if (src.startsWith('blob:')) {
    try {
      const blobRes = await fetch(src);
      const blob = await blobRes.blob();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      payload.base64Data = base64.split(',')[1];
      payload.mimeType = blob.type;
    } catch (e) {
      console.error("Blob fetch failed", e);
      showToast("Error reading image data", "error");
      hideProgressBar();
      return;
    }
  } else {
    // For remote URLs (etsystatic.com), convert to base64 in content script
    // This bypasses CORS issues by using the img element already loaded in DOM
    try {
      // Create a canvas to extract image data
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Determine which image to use - ONLY from DOM
      let imgToUse = null;

      // 1. Check if imgNode is an actual HTMLImageElement
      if (imgNode instanceof HTMLImageElement && imgNode.complete && imgNode.naturalWidth > 0) {
        imgToUse = imgNode;
        console.log("[EtsyPro] Using original DOM img element");
      } else {
        // 2. Search DOM for matching image
        console.log("[EtsyPro] Searching DOM for image...");

        // Strategy: Extract Image ID from URL to find ANY version of it (thumbnail, full, etc.)
        // Etsy URLs usually look like: .../12345678/il_fullxfull.12345678_abcd.jpg
        // We look for the numeric ID "12345678"
        const idMatch = src.match(/\/(\d+)\//) || src.match(/il_[a-z0-9]+\.(\d+)_/);
        const imageId = idMatch ? idMatch[1] : null;

        const allImgs = Array.from(document.querySelectorAll('img'));

        // A. Try Exact Match
        imgToUse = allImgs.find(img => img.src === src && img.complete && img.naturalWidth > 0);

        // B. Try Match by ID (Robust)
        if (!imgToUse && imageId) {
          console.log(`[EtsyPro] Searching by Image ID: ${imageId}`);
          imgToUse = allImgs.find(img =>
            img.src.includes(imageId) && img.complete && img.naturalWidth > 0
          );
        }

        // C. Try Base URL Match
        if (!imgToUse) {
          const srcBase = src.split('?')[0];
          imgToUse = allImgs.find(img => {
            return img.src.split('?')[0] === srcBase && img.complete && img.naturalWidth > 0;
          });
        }

        if (imgToUse) {
          console.log(`[EtsyPro] Found matching img in DOM: ${imgToUse.src.substring(0, 50)}...`);
        }

        // D. FALLBACK: Grab the FIRST listing image found (for Manual Regen)
        if (!imgToUse && isRegenerate) {
          console.log("[EtsyPro] Target image not found. Fallback: Finding ANY primary listing image...");

          // Try to find images in the sortable list (main listing photos)
          // Etsy class often involves 'sortable-item' or inside the upload area
          const candidateImgs = allImgs.filter(img => {
            // Filter out small icons/avatars, keep decent sized images only
            return img.complete && img.naturalWidth > 200 &&
              (img.closest('[data-clg-id="WtUploadArea"]') || img.closest('.wt-grid__item-xs-12'));
          });

          if (candidateImgs.length > 0) {
            imgToUse = candidateImgs[0];
            console.log(`[EtsyPro] Fallback: Used first available image: ${imgToUse.src.substring(0, 50)}...`);
            showToast("Using primary image for regen...", "info");
          }
        }
      }

      if (!imgToUse) {
        throw new Error(`Could not find ANY valid image for AI. Please upload an image first.`);
      }

      canvas.width = imgToUse.naturalWidth || imgToUse.width;
      canvas.height = imgToUse.naturalHeight || imgToUse.height;

      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error("Image has no dimensions");
      }

      ctx.drawImage(imgToUse, 0, 0);

      // Get base64
      const base64 = canvas.toDataURL('image/jpeg', 0.9);
      payload.base64Data = base64.split(',')[1];
      payload.mimeType = 'image/jpeg';

      console.log("[EtsyPro] Converted remote image to base64 successfully");
    } catch (e) {
      console.warn("[EtsyPro] Canvas conversion failed, sending URL to background:", e);
      // Fallback: send URL to background (may still have CORS issue)
      payload.imageUrl = src;
    }
  }

  // Call Background
  chrome.runtime.sendMessage(payload, (response) => {
    hideProgressBar();

    if (chrome.runtime.lastError) {
      showToast("Extension Error: " + chrome.runtime.lastError.message, "error");
      return;
    }

    if (response && response.status === 'success') {
      fillListingInfo(response.data, targetGeneration);
    } else {
      const msg = response ? response.message : "Unknown Error";
      showToast("AI Error: " + msg, "error");
      console.error("AI Error:", response);
    }
  });
}

async function fillListingInfo(data, target = 'all') {
  if (!data) return;

  console.log(`[EtsyPro] fillListingInfo called with target: '${target}'`);

  // 1. Fill Title (Skip if target is 'tags')
  if (target !== 'tags' && (target === 'all' || target === 'title') && data.title) {
    console.log("[EtsyPro] Updating TITLE...");
    const titleInput = document.getElementById('listing-title-input');
    if (titleInput) {
      titleInput.focus();
      titleInput.value = data.title;
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
      titleInput.blur();
      showToast("Title Updated", "success");
    }
  } else {
    console.log("[EtsyPro] Skipping Title Update");
  }

  // 2. Fill Tags (Skip if target is 'title')
  if (target !== 'title' && (target === 'all' || target === 'tags') && data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
    console.log("[EtsyPro] Updating TAGS...");
    const tagInput = document.getElementById('listing-tags-input');
    const addBtn = document.getElementById('listing-tags-button');

    if (tagInput && addBtn) {
      showToast("Clearing old tags...", "info");
      await clearExistingTags();

      // Join all tags with comma
      const tagsString = data.tags.join(',');

      tagInput.focus();
      tagInput.value = tagsString;

      // Standard Event Dispatch
      tagInput.dispatchEvent(new Event('input', { bubbles: true }));
      tagInput.dispatchEvent(new Event('change', { bubbles: true }));

      // Small delay to let Etsy validate the input
      setTimeout(() => {
        addBtn.click();
        showToast("Tags Updated!", "success");
      }, 500);
    }
  }

  // Ensure buttons are present
  injectIndependentRegenButtons();
}

// ----------------------------------------------------
// HELPER: Clear Existing Tags (Iterative Force)
// ----------------------------------------------------
async function clearExistingTags() {
  console.log("[EtsyPro] Clearing tags...");
  // Locate the tag container
  const fieldSet = document.getElementById('field-tags');
  let searchRoot = fieldSet;
  if (!searchRoot) {
    const input = document.getElementById('listing-tags-input');
    if (input) searchRoot = input.closest('fieldset') || input.closest('form') || document.body;
  }
  if (!searchRoot) return;

  // Robust Retry loop to ensure all are deleted
  // We keep trying until no "Delete tag" buttons are found
  let maxRetries = 20; // 20 attempts (approx 2 seconds max)
  while (maxRetries > 0) {
    const deleteBtns = Array.from(searchRoot.querySelectorAll('button[aria-label^="Delete tag"]'));

    if (deleteBtns.length === 0) {
      console.log("[EtsyPro] Tags cleared.");
      break; // All gone
    }

    console.log(`[EtsyPro] Deleting ${deleteBtns.length} tags instantly...`);

    // Fire all clicks immediately without waiting
    deleteBtns.forEach(btn => btn.click());

    // Short wait for UI update
    await new Promise(r => setTimeout(r, 100));
    maxRetries--;
  }

  // Extra safety wait
  await new Promise(r => setTimeout(r, 50));
}


// ----------------------------------------------------
// UI: Inject Independent Regen Buttons (Large with Icons)
// ----------------------------------------------------
function injectIndependentRegenButtons() {
  // 1. Title Button
  const titleInput = document.getElementById('listing-title-input');
  if (titleInput && !document.getElementById('ai-regen-title')) {
    // Find label
    const titleContainer = titleInput.closest('#field-title') || titleInput.closest('.wt-grid__item-xs-12');
    const label = titleContainer ? titleContainer.querySelector('label') : null;

    if (label) {
      const btn = document.createElement('button');
      btn.id = 'ai-regen-title';
      btn.type = 'button';
      btn.className = "wt-btn wt-btn--secondary wt-btn--small"; // Use Etsy classes + our style
      btn.innerHTML = '<span class="wt-icon--smaller-xs etsy-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg></span> Regen Title';
      Object.assign(btn.style, {
        marginLeft: '12px',
        background: '#ef4444', // Etsy Black
        borderColor: '#222',
        color: '#fff',
        fontSize: '13px',
        fontWeight: 'bold',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        borderRadius: '24px',
        cursor: 'pointer',
        transition: 'background 0.2s'
      });

      btn.onmouseenter = () => btn.style.background = '#000';
      btn.onmouseleave = () => btn.style.background = '#222';

      btn.onclick = () => {
        if (!lastImageSrc) {
          const fallbackImg = document.querySelector('[data-clg-id="WtUploadArea"] img');
          if (fallbackImg && fallbackImg.src) lastImageSrc = fallbackImg.src;
        }

        if (!lastImageSrc) return showToast("Không tìm thấy ảnh nào trong danh sách. Hãy đợi ảnh tải xong hoặc thử click lại.", "error");
        handleNewImage({ src: lastImageSrc }, true, 'title');
      };

      // Append inside label or right after
      // Label usually has popover inside, so append to label content
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.appendChild(btn);

      // 1b. Regen All (Top Shortcut)
      if (!document.getElementById('ai-regen-all-top')) {
        const btnAll = btn.cloneNode(true); // Base on title button
        btnAll.id = 'ai-regen-all-top';
        btnAll.innerHTML = '<span class="wt-icon--smaller-xs etsy-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg></span> Regen All';

        // Override specific styles
        Object.assign(btnAll.style, {
          background: '#22c55e',
          borderColor: '#16a34a',
          marginLeft: '8px'
        });

        btnAll.onmouseenter = () => btnAll.style.background = '#16a34a';
        btnAll.onmouseleave = () => btnAll.style.background = '#22c55e';

        btnAll.onclick = () => {
          if (!lastImageSrc) {
            const fallbackImg = document.querySelector('[data-clg-id="WtUploadArea"] img');
            if (fallbackImg && fallbackImg.src) lastImageSrc = fallbackImg.src;
          }
          if (!lastImageSrc) return showToast("Không tìm thấy ảnh nào trong danh sách. Hãy đợi ảnh tải xong hoặc thử click lại.", "error");
          handleNewImage({ src: lastImageSrc }, true, 'all');
        };

        label.appendChild(btnAll);
      }
    }
  }

  // 2. Tags Button
  const tagInput = document.getElementById('listing-tags-input');
  if (tagInput && !document.getElementById('ai-regen-tags')) {
    const fieldSet = document.getElementById('field-tags');
    const legend = fieldSet ? fieldSet.querySelector('legend') : document.querySelector('#field-tags legend');

    if (legend) {
      const btn = document.createElement('button');
      btn.id = 'ai-regen-tags';
      btn.type = 'button';
      btn.className = "wt-btn wt-btn--secondary wt-btn--small";
      btn.innerHTML = '<span class="wt-icon--smaller-xs etsy-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg></span> Regen Tags';
      Object.assign(btn.style, {
        marginLeft: '12px',
        background: '#ef4444', // 
        borderColor: '#222',
        color: '#fff',
        fontSize: '13px',
        fontWeight: 'bold',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        borderRadius: '24px',
        cursor: 'pointer',
        transition: 'background 0.2s'
      });

      btn.onmouseenter = () => btn.style.background = '#000';
      btn.onmouseleave = () => btn.style.background = '#222';

      btn.onclick = () => {
        if (!lastImageSrc) {
          const fallbackImg = document.querySelector('[data-clg-id="WtUploadArea"] img');
          if (fallbackImg && fallbackImg.src) lastImageSrc = fallbackImg.src;
        }
        if (!lastImageSrc) return showToast("Không tìm thấy ảnh nào trong danh sách. Hãy đợi ảnh tải xong hoặc thử click lại.", "error");
        handleNewImage({ src: lastImageSrc }, true, 'tags');
      };

      legend.style.display = 'flex';
      legend.style.alignItems = 'center';
      legend.appendChild(btn);

      // Add a dedicated Clear Tags button next to Regen Tags
      if (!document.getElementById('ai-clear-tags')) {
        const btnClear = document.createElement('button');
        btnClear.id = 'ai-clear-tags';
        btnClear.type = 'button';
        btnClear.className = "wt-btn wt-btn--secondary wt-btn--small";
        btnClear.innerText = 'Xóa Tags';
        Object.assign(btnClear.style, {
          marginLeft: '8px',
          background: '#f97316',
          borderColor: '#b45309',
          color: '#fff',
          fontSize: '13px',
          fontWeight: '700',
          padding: '8px 12px',
          borderRadius: '20px',
          cursor: 'pointer'
        });

        btnClear.onmouseenter = () => btnClear.style.background = '#c2410c';
        btnClear.onmouseleave = () => btnClear.style.background = '#f97316';

        btnClear.onclick = async () => {
          const ok = confirm('Xác nhận xóa tất cả tags cho listing này?');
          if (!ok) return;
          try {
            btnClear.disabled = true;
            const original = btnClear.innerText;
            btnClear.innerText = 'Đang xóa...';
            await clearExistingTags();
            showToast('Đã xóa tất cả tags', 'success');
            btnClear.innerText = original;
          } catch (e) {
            console.error('[EtsyPro] Clear tags failed:', e);
            showToast('Xóa tags thất bại', 'error');
          } finally {
            btnClear.disabled = false;
          }
        };

        legend.appendChild(btnClear);
      }
    }
  }

  // 3. Regen All Button (placed after Tags)
  if (tagInput && !document.getElementById('ai-regen-all')) {
    const fieldSet = document.getElementById('field-tags');
    const legend = fieldSet ? fieldSet.querySelector('legend') : document.querySelector('#field-tags legend');

    if (legend) {
      const btn = document.createElement('button');
      btn.id = 'ai-regen-all';
      btn.type = 'button';
      btn.className = "wt-btn wt-btn--secondary wt-btn--small";
      btn.innerHTML = '<span class="wt-icon--smaller-xs etsy-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg></span> Regen All';
      Object.assign(btn.style, {
        marginLeft: '12px',
        background: '#22c55e', // Green color for "all" action
        borderColor: '#16a34a',
        color: '#fff',
        fontSize: '13px',
        fontWeight: 'bold',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        borderRadius: '24px',
        cursor: 'pointer',
        transition: 'background 0.2s'
      });

      btn.onmouseenter = () => btn.style.background = '#16a34a';
      btn.onmouseleave = () => btn.style.background = '#22c55e';

      btn.onclick = () => {
        if (!lastImageSrc) {
          const fallbackImg = document.querySelector('[data-clg-id="WtUploadArea"] img');
          if (fallbackImg && fallbackImg.src) lastImageSrc = fallbackImg.src;
        }
        if (!lastImageSrc) return showToast("Không tìm thấy ảnh nào trong danh sách. Hãy đợi ảnh tải xong hoặc thử click lại.", "error");
        handleNewImage({ src: lastImageSrc }, true, 'all');
      };

      legend.appendChild(btn);
    }
  }
}

// ----------------------------------------------------
// UI: Progress Bar
// ----------------------------------------------------
function showProgressBar() {
  let bar = document.getElementById('etsy-pro-progress-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'etsy-pro-progress-bar';
    document.body.appendChild(bar);
  }
  bar.style.width = '100%';
  bar.style.opacity = '1';
}

function hideProgressBar() {
  let bar = document.getElementById('etsy-pro-progress-bar');
  if (bar) {
    bar.style.opacity = '0';
    setTimeout(() => {
      bar.style.width = '0%';
    }, 300);
  }
}


// Global Toast Helper
// Global Toast Helper
function showToast(message, type = 'info') {
  let toast = document.getElementById('etsy-pro-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'etsy-pro-toast';
    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px', // Changed from bottom to top
      left: '50%',
      transform: 'translateX(-50%) translateY(-100px)', // Start above screen
      background: '#1e293b',
      color: '#fff',
      padding: '12px 24px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      zIndex: '999999999',
      fontSize: '14px',
      fontWeight: '500',
      opacity: '0',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    });
    document.body.appendChild(toast);
  }

  // Colors & Icons
  let icon = '';
  if (type === 'error') {
    toast.style.borderLeft = '4px solid #ef4444';
    icon = '⚠️';
  } else if (type === 'success') {
    toast.style.borderLeft = '4px solid #22c55e';
    icon = '✅';
  } else {
    toast.style.borderLeft = '4px solid #3b82f6';
    icon = 'ℹ️';
  }

  toast.textContent = `${icon} ${message}`;

  // Animate In (Slide Down)
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';

  // Clear previous timer
  if (toast.dataset.timer) clearTimeout(parseInt(toast.dataset.timer));

  // Animate Out (Slide Up)
  const timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-100px)';
  }, 4000); // 4 Seconds

  toast.dataset.timer = timer.toString();
}
