// --- Elements ---
const viewSource = document.getElementById('view-source');
const viewMapping = document.getElementById('view-mapping');
const statusArea = document.getElementById('status-area');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// --- State ---
let currentScriptUrl = "";
let currentData = null; // Array of arrays or objects
let sheetList = []; // For filtering

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
    // Check local storage
    const storage = await chrome.storage.local.get(['scriptUrl']);

    if (storage.scriptUrl) {
        document.getElementById('script-url').value = storage.scriptUrl;
        currentScriptUrl = storage.scriptUrl;
        // Auto-fetch sheets if url exists? Maybe no, let user click connect.
        // Or if we want persistent session:
        // fetchSheetList(storage.scriptUrl);
    }

    // Modal Events
    document.getElementById('link-help').onclick = () => {
        document.getElementById('modal-help').style.display = 'block';
        document.getElementById('gs-code').value = GOOGLE_SCRIPT_TEMPLATE;
    };
    document.getElementById('close-help').onclick = () => document.getElementById('modal-help').style.display = 'none';
    document.getElementById('btn-copy-code').onclick = () => {
        navigator.clipboard.writeText(GOOGLE_SCRIPT_TEMPLATE);
        showStatus('Code copied to clipboard!', 'success');
    };
});

// --- Tabs ---
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const target = tab.dataset.tab;
        tabContents.forEach(c => c.classList.add('hidden'));
        document.getElementById(`tab-${target}`).classList.remove('hidden');
    });
});

// --- Helper: Status ---
function showStatus(msg, type = 'error') {
    statusArea.textContent = msg;
    statusArea.className = `status-msg ${type}`;
    setTimeout(() => {
        statusArea.textContent = '';
        statusArea.className = 'status-msg';
    }, 4000);
}

// ==========================================
// ACTION: SCAN (DIRECT)
// ==========================================
document.getElementById('btn-scan').onclick = async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.url.includes("docs.google.com/spreadsheets")) {
            showStatus("Please open a Google Sheet tab first.");
            return;
        }

        chrome.tabs.sendMessage(tab.id, { action: "scan_sheet" }, (response) => {
            if (chrome.runtime.lastError) {
                showStatus("Error: Refresh the Google Sheet page and try again.");
                return;
            }

            if (response && response.status === "success" && response.data) {
                processData(response.data, "Active Table Scan");
                showStatus("Scanned successfully!", "success");
            } else {
                showStatus("Failed to scan. Is the table empty?");
            }
        });
    } catch (e) {
        showStatus("Error: " + e.message);
    }
};

// ==========================================
// ACTION: API FLOW
// ==========================================

// 1. Connect
document.getElementById('btn-connect').onclick = async () => {
    const url = document.getElementById('script-url').value.trim();
    if (!url) return showStatus("Enter Script URL");

    currentScriptUrl = url;
    chrome.storage.local.set({ scriptUrl: url });

    const btn = document.getElementById('btn-connect');
    btn.innerHTML = "Connecting...";
    btn.disabled = true;

    try {
        await fetchSheetList(url); // This will switch view on success
    } catch (e) {
        showStatus(e.message);
    } finally {
        btn.innerHTML = "Connect Sheet";
        btn.disabled = false;
    }
};

// 2. Reconnect (Back)
document.getElementById('btn-reconnect').onclick = () => {
    document.getElementById('api-step-connect').classList.remove('hidden');
    document.getElementById('api-step-select').classList.add('hidden');
};

// 3. Search Filter
document.getElementById('search-sheets').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = sheetList.filter(s => s.toLowerCase().includes(term));
    renderSheetList(filtered);
});

async function fetchSheetList(url) {
    // Call Script with action=getSheets
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
    renderSheetList(sheets);

    // Switch UI
    document.getElementById('api-step-connect').classList.add('hidden');
    document.getElementById('api-step-select').classList.remove('hidden');
}

function renderSheetList(list) {
    const container = document.getElementById('sheet-list');
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = '<div style="font-size:12px; color:#64748b; text-align:center;">No sheets found</div>';
        return;
    }

    list.forEach(name => {
        const btn = document.createElement('div');
        btn.className = 'sheet-item'; // We need to add css for this
        btn.innerText = name;
        btn.onclick = () => fetchSheetData(name);

        // Inline style for now, or move to css
        btn.style.padding = '10px';
        btn.style.background = '#334155';
        btn.style.borderRadius = '6px';
        btn.style.fontSize = '13px';
        btn.style.cursor = 'pointer';
        btn.style.transition = '0.2s';
        btn.onmouseover = () => btn.style.background = '#475569';
        btn.onmouseout = () => btn.style.background = '#334155';

        container.appendChild(btn);
    });
}

async function fetchSheetData(sheetName) {
    // Show loading?
    showStatus(`Fetching ${sheetName}...`, 'success'); // using success for blue/green color?

    try {
        const fetchUrl = `${currentScriptUrl}?sheetName=${encodeURIComponent(sheetName)}`;
        const res = await fetch(fetchUrl);
        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
            processData(data, sheetName);
        } else {
            showStatus("Sheet is empty.");
        }
    } catch (e) {
        showStatus("Error fetching data" + e.message);
    }
}


// ==========================================
// MAPPING & APPLY
// ==========================================

document.getElementById('btn-use-existing').onclick = () => {
    // Legacy support or if we cached
};

document.getElementById('btn-back').onclick = () => {
    viewMapping.classList.add('hidden');
    viewSource.classList.remove('hidden');
};

document.getElementById('btn-apply').onclick = async () => {
    const v1Idx = document.getElementById('select-variant-1').value;
    const v2Idx = document.getElementById('select-variant-2').value;
    const pIdx = document.getElementById('select-price').value;

    if (v1Idx === "" || pIdx === "") return showStatus("Select at least Variant 1 and Price!");

    // Get Headers for Title
    const v1Head = currentData[0][v1Idx];
    const v2Head = v2Idx ? currentData[0][v2Idx] : "";
    const variantTitle = v2Head ? `${v1Head} - ${v2Head}` : v1Head;

    const rows = currentData.slice(1);
    const payload = rows.map(r => {
        let name = r[v1Idx] || "";
        if (v2Idx && r[v2Idx]) {
            name += " - " + r[v2Idx];
        }
        return {
            name: name,
            price: r[pIdx] || ""
        };
    }).filter(x => x.name);

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.url.includes("etsy.com")) {
            showStatus("Please open the Etsy Listing page.");
            return;
        }

        chrome.tabs.sendMessage(tab.id, {
            action: "apply_to_etsy",
            data: payload,
            variantTitle: variantTitle
        }, (response) => {
            if (chrome.runtime.lastError) {
                showStatus("Refresh Etsy page and try again.");
            } else {
                showStatus("Automation started!", "success");
            }
        });
    } catch (e) {
        showStatus(e.message);
    }
};

// ==========================================
// LOGIC
// ==========================================

function processData(data, sourceName) {
    currentData = data;

    // 1. Detect Tables (Contiguous blocks of data)
    const tables = detectTables(data);

    if (tables.length === 0) {
        showStatus("No structured data found.");
        return;
    }

    if (tables.length > 1) {
        // Ask user to pick a table
        showTableSelection(tables, sourceName);
    } else {
        // Only one table, go straight to mapping
        useTable(tables[0], sourceName);
    }
}

function detectTables(rawData) {
    const tables = [];
    let currentBlock = [];
    let startRowIndex = 0;

    // Helper: Check if row is "empty" (no meaningful data)
    const isRowEmpty = (row) => !row || row.every(cell => cell === "" || cell === null);

    // Helper: Validate block (must have header + at least 1 data row)
    const validateBlock = (block, startIdx) => {
        // Heuristic: A table should be at least 2x2 or 1x? with meaningful header
        if (block.length < 2) return null;

        // Trim headers (remove empty leading/trailing columns)
        // Find first non-empty col index
        let minCol = 9999;
        let maxCol = -1;

        block.forEach(r => {
            r.forEach((c, i) => {
                if (c !== "" && c !== null) {
                    if (i < minCol) minCol = i;
                    if (i > maxCol) maxCol = i;
                }
            });
        });

        if (maxCol === -1) return null; // All empty

        // Extract the sub-rectangle
        const cleanBlock = block.map(r => r.slice(minCol, maxCol + 1));

        // Header is the first row of cleanBlock
        const headers = cleanBlock[0];

        // Name the table by its first few headers
        const keys = headers.filter(h => h).slice(0, 3).join(", ");

        return {
            id: `tbl_${startIdx}`,
            name: keys ? `Table: ${keys}` : `Table starting Row ${startIdx + 1}`,
            data: cleanBlock,
            originalRow: startIdx + 1
        };
    };

    rawData.forEach((row, i) => {
        if (isRowEmpty(row)) {
            // End of a block
            if (currentBlock.length > 0) {
                const tbl = validateBlock(currentBlock, startRowIndex);
                if (tbl) tables.push(tbl);
                currentBlock = [];
            }
        } else {
            // Start of a block
            if (currentBlock.length === 0) startRowIndex = i;
            currentBlock.push(row);
        }
    });

    // Final block
    if (currentBlock.length > 0) {
        const tbl = validateBlock(currentBlock, startRowIndex);
        if (tbl) tables.push(tbl);
    }

    return tables;
}

// ==========================================
// UI: TABLE SELECTION
// ==========================================

function showTableSelection(tables, sourceName) {
    // Re-use api-step-select container
    const container = document.getElementById('api-step-select');
    const list = document.getElementById('sheet-list');

    // Update headers to look like "Select Table"
    document.getElementById('api-step-connect').classList.add('hidden');
    container.classList.remove('hidden');

    const label = container.querySelector('.label span');
    if (label) label.textContent = `Found ${tables.length} Tables in "${sourceName}"`;

    // Hide search
    document.getElementById('search-sheets').classList.add('hidden');

    list.innerHTML = '';

    tables.forEach(tbl => {
        const btn = document.createElement('div');
        btn.className = 'sheet-item';

        // Preview Headers
        const headerPreview = tbl.data[0].slice(0, 4).join(" | ");
        const rowCount = tbl.data.length - 1;

        btn.innerHTML = `
            <div style="font-weight:600; font-size:13px; color:#fff;">${tbl.name}</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:4px;">${rowCount} items • Headers: ${headerPreview}</div>
        `;

        btn.style.padding = '12px';
        btn.style.background = '#334155';
        btn.style.borderRadius = '8px';
        btn.style.marginBottom = '8px';
        btn.style.cursor = 'pointer';
        btn.style.border = '1px solid transparent';

        btn.onclick = () => {
            // Revert UI changes for next time?
            label.textContent = "Select Tab";
            document.getElementById('search-sheets').classList.remove('hidden');
            useTable(tbl, sourceName);
        };

        btn.onmouseover = () => btn.style.borderColor = '#f97316';
        btn.onmouseout = () => btn.style.borderColor = 'transparent';

        list.appendChild(btn);
    });
}

function useTable(tableObj, sourceName) {
    currentData = tableObj.data;

    const nameEl = document.getElementById('data-source-name');
    nameEl.textContent = `Source: ${sourceName} > ${tableObj.name}`;

    populateMapping(currentData);

    viewSource.classList.add('hidden');
    viewMapping.classList.remove('hidden');
}

function populateMapping(data) {
    const headers = data[0];
    const v1 = document.getElementById('select-variant-1');
    const v2 = document.getElementById('select-variant-2');
    const p = document.getElementById('select-price');

    v1.innerHTML = '<option value="">-- Select --</option>';
    v2.innerHTML = '<option value="">-- None --</option>';
    p.innerHTML = '<option value="">-- Select --</option>';

    headers.forEach((h, i) => {
        const label = h ? h : `Column ${i + 1}`;
        const opt = `<option value="${i}">${label}</option>`;
        v1.innerHTML += opt;
        v2.innerHTML += opt;
        p.innerHTML += opt;
    });
}

// --- Constants ---
const GOOGLE_SCRIPT_TEMPLATE = `
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;

  // Action: Get list of sheet names
  if (action === 'getSheets') {
    const sheets = ss.getSheets().map(s => s.getName());
    return ContentService.createTextOutput(JSON.stringify(sheets)).setMimeType(ContentService.MimeType.JSON);
  }

  // Action: Get specific sheet data
  const sheetName = e.parameter.sheetName;
  let sheet;
  if(sheetName) {
    sheet = ss.getSheetByName(sheetName);
  } else {
    sheet = ss.getSheets()[0];
  }
  
  if(!sheet) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  
  const data = sheet.getDataRange().getValues();
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
`.trim();