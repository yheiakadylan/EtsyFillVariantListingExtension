// ===========================================
// SIMPLE VERSION - No Cache
// Fetch once per page load, use defaults on error
// ===========================================

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
