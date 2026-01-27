// Background Script to coordinate tabs

// Toggle Sidebar on Click
chrome.action.onClicked.addListener((tab) => {
    if (tab.url && tab.url.includes("etsy.com")) {
        chrome.tabs.sendMessage(tab.id, { action: "toggle_sidebar" });
    } else {
        console.warn("Not on Etsy.");
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // 1. RELAY: Etsy Content Script wants to Scan Sheets
    if (request.action === "request_scan") {
        findAndScanSheet(sendResponse);
        return true; // Async
    }

    // 2. RELAY: Etsy Content Script wants to Apply (Actually it applies itself now, so not needed?)
    // In the new architecture, the logic is IN the content script, so it applies directly.

    // 3. FETCH RATES: Get currency data (Using Wise Public API which is friendlier to CORS)
    if (request.action === "fetch_exchange_rates") {
        const target = request.target || "EUR";
        // Use the official public API, requiring Authorization usually, BUT:
        // Try the cached/public endpoint: https://api.wise.com/v1/rates?source=USD&target=...
        // Note: Wise API usually requires an API key, but let's try this endpoint or fallback to exchangerate-api

        const url = `https://api.wise.com/v1/rates?source=USD&target=${target}`;

        fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
                // 'Authorization': 'Bearer ...' // If we had one
            }
        })
            .then(res => {
                if (!res.ok) throw new Error(`Wise API Error: ${res.status}`);
                return res.json();
            })
            .then(data => {
                // Wise Public API returns array: [{ source: 'USD', target: 'NZD', rate: 1.63... }]
                if (Array.isArray(data) && data.length > 0) {
                    sendResponse({ status: 'success', rate: data[0].rate, source: 'Wise' });
                } else {
                    throw new Error("Wise Empty Data");
                }
            })
            .catch(err => {
                console.log("Wise Failed, falling back to open.er-api");
                // FALLBACK: Use open.er-api.com which has 6 decimals precision
                fetch(`https://open.er-api.com/v6/latest/USD`)
                    .then(r => r.json())
                    .then(d => {
                        const r = d.rates[target];
                        sendResponse({ status: 'success', rate: r, source: 'OpenAPI (Fallback)' });
                    })
                    .catch(e => sendResponse({ status: 'error', message: e.toString() }));
            });
        return true;
    }

    // 4. GEMINI AI GENERATION
    if (request.action === "generate_listing_info") {
        generateGeminiContent(request)
            .then(data => sendResponse({ status: 'success', data }))
            .catch(err => sendResponse({ status: 'error', message: err.toString() }));
        return true; // Async
    }
});

async function generateGeminiContent({ imageUrl, base64Data, mimeType, model, apiKey, prompt }) {
    // 1. Prepare Image Data
    let finalBase64 = base64Data;
    let finalMime = mimeType || "image/jpeg";

    if (!finalBase64 && imageUrl) {
        // Fetch image data if not provided directly
        try {
            const imgRes = await fetch(imageUrl);
            const blob = await imgRes.blob();
            finalMime = blob.type;
            const fullBase64 = await blobToBase64(blob);
            finalBase64 = fullBase64.split(',')[1];
        } catch (e) {
            throw new Error("Failed to download image from Etsy: " + e.message);
        }
    }

    if (!finalBase64) {
        throw new Error("No image data available");
    }

    // 2. Call Gemini API
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [
                { text: prompt + "\n\nReturn the result as JSON with strict format: { \"title\": \"...\", \"tags\": [\"tag1\", \"tag2\"] }" },
                {
                    inline_data: {
                        mime_type: finalMime,
                        data: finalBase64
                    }
                }
            ]
        }],
        generationConfig: {
            response_mime_type: "application/json"
        }
    };

    const apiRes = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!apiRes.ok) {
        const errText = await apiRes.text();
        throw new Error(`Gemini API Error ${apiRes.status}: ${errText}`);
    }

    const json = await apiRes.json();

    // 3. Parse Response
    try {
        const text = json.candidates[0].content.parts[0].text;
        // Clean markdown code blocks if any (usually handled by response_mime_type=json but just in case)
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        throw new Error("Failed to parse Gemini JSON: " + e.message);
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function findAndScanSheet(sendResponse) {
    try {
        // Find Google Sheet Tab
        const tabs = await chrome.tabs.query({});
        const sheetTab = tabs.find(t => t.url && t.url.includes("docs.google.com/spreadsheets"));

        if (!sheetTab) {
            sendResponse({ status: 'error', message: 'No Google Sheet tab found open.' });
            return;
        }

        // Send Scan command to Sheet Tab
        chrome.tabs.sendMessage(sheetTab.id, { action: "scan_sheet" }, (response) => {
            if (chrome.runtime.lastError) {
                // Maybe content script not loaded there?
                sendResponse({ status: 'error', message: 'Could not connect to Sheet. Try reloading the Sheet tab.' });
            } else {
                sendResponse(response); // Forward the data back to Etsy
            }
        });

    } catch (e) {
        sendResponse({ status: 'error', message: e.message });
    }
}
