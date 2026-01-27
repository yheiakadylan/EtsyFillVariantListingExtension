// Listen for requests from Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scan_sheet") {
        const data = scrapeSheetTable();
        // If successful, return data
        if (data && data.length > 0) {
            sendResponse({ status: "success", data: data });
        } else {
            sendResponse({ status: "error", message: "No data found" });
        }
    }
    return true; // Keep channel open
});

function scrapeSheetTable() {
    // 1. Try finding the Waffle Grid (The main data canvas/table in Sheets)
    // Note: Sheets renders visible rows. If you scroll down, rows are unloaded.
    // For small lists, this works. For large lists, API is better.
    // However, user said "Scan Table".

    // We try to find the container that holds the cell text.
    const container = document.querySelector('.waffle-grid-table');
    if (container) {
        return parseTable(container);
    }

    // 2. Fallback: Generic Table
    const table = document.querySelector('table');
    if (table) {
        return parseTable(table);
    }

    return null;
}

function parseTable(tableElement) {
    const rows = Array.from(tableElement.getElementsByTagName('tr'));
    const results = [];

    let isHeaderFound = false;

    for (const row of rows) {
        // Collect cell texts
        const cells = Array.from(row.querySelectorAll('td, th')).map(c => c.innerText.trim());

        // Filter empty rows (rows with all empty cells)
        if (cells.every(c => c === "")) continue;

        results.push(cells);
    }

    return results.length > 0 ? results : null;
}