// app.js
const BLOGGER_API_KEY_STORAGE_KEY = 'blogger_api_key';
const BLOGGER_API_KEY_REMEMBER_FLAG = 'blogger_api_key_remember';

const blogUrlOrIdInput = document.getElementById('blogUrlOrIdInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleApiKeyVisibilityButton = document.getElementById('toggleApiKeyVisibility');
const rememberApiKeyCheckbox = document.getElementById('rememberApiKeyCheckbox');
const getPostsButton = document.getElementById('getPostsButton');
const clearApiKeyButton = document.getElementById('clearApiKeyButton');
const messagesDiv = document.getElementById('messages');
const loadingSpinner = document.getElementById('loadingSpinner');
const postsList = document.getElementById('postsList');

let gapiClientReady = false;
let gapiCoreLoadedPromise = null;
let initGapiTimeout = null; // New variable for debounce timeout

// --- Utility Functions ---

function displayMessage(msg, type = 'error') {
    messagesDiv.textContent = msg;
    messagesDiv.style.color = type === 'error' ? 'red' : (type === 'success' ? 'green' : 'blue');
    if (type !== 'persistent') {
        setTimeout(() => { messagesDiv.textContent = ''; }, 5000);
    }
}

function updateButtonStates() {
    const isApiKeyEmpty = apiKeyInput.value.trim().length === 0;
    const isBlogInputEmpty = blogUrlOrIdInput.value.trim().length === 0;

    console.log(`[updateButtonStates] API Empty: ${isApiKeyEmpty}, Blog Empty: ${isBlogInputEmpty}, GAPI Ready: ${gapiClientReady}`);

    clearApiKeyButton.disabled = isApiKeyEmpty;
    getPostsButton.disabled = isBlogInputEmpty || isApiKeyEmpty || !gapiClientReady;

    // Disable Remember API Key checkbox if API key field is empty
    rememberApiKeyCheckbox.disabled = isApiKeyEmpty;
    // If the checkbox becomes disabled (because API key is empty), ensure it's unchecked
    if (isApiKeyEmpty) {
        rememberApiKeyCheckbox.checked = false;
        // Also ensure it's cleared from storage immediately if the input becomes empty
        localStorage.removeItem(BLOGGER_API_KEY_STORAGE_KEY);
        localStorage.removeItem(BLOGGER_API_KEY_REMEMBER_FLAG);
    }
}

function showLoading(show) {
    loadingSpinner.style.display = show ? 'block' : 'none';
    getPostsButton.disabled = show;
    clearApiKeyButton.disabled = show;
    blogUrlOrIdInput.disabled = show;
    apiKeyInput.disabled = show;
    toggleApiKeyVisibilityButton.disabled = show;
    rememberApiKeyCheckbox.disabled = show;

    if (show) {
        messagesDiv.textContent = 'Fetching posts...';
        messagesDiv.style.color = 'blue';
    } else {
        if (messagesDiv.textContent === 'Fetching posts...') {
            messagesDiv.textContent = '';
        }
        updateButtonStates();
    }
}

// saveApiKey is now only called by the checkbox listener
function saveApiKey(key) {
    localStorage.setItem(BLOGGER_API_KEY_STORAGE_KEY, key);
    localStorage.setItem(BLOGGER_API_KEY_REMEMBER_FLAG, 'true');
    updateButtonStates();
}

function getSavedApiKey() {
    const rememberState = localStorage.getItem(BLOGGER_API_KEY_REMEMBER_FLAG);
    if (rememberState === 'true') {
        rememberApiKeyCheckbox.checked = true;
        return localStorage.getItem(BLOGGER_API_KEY_STORAGE_KEY);
    } else {
        rememberApiKeyCheckbox.checked = false;
        return null;
    }
}

// --- MODIFIED: clearSavedApiKey no longer clears apiKeyInput.value ---
function clearSavedApiKey() {
    localStorage.removeItem(BLOGGER_API_KEY_STORAGE_KEY);
    localStorage.removeItem(BLOGGER_API_KEY_REMEMBER_FLAG);
    rememberApiKeyCheckbox.checked = false;
    // We explicitly DO NOT clear apiKeyInput.value here
    updateButtonStates();
}

// --- GAPI Core Loading (from index.html onload) ---

window.onGapiLoaded = function() {
    console.log('Google API client script loaded. Now loading the core client module...');
    gapiCoreLoadedPromise = new Promise(resolve => {
        gapi.load('client', resolve);
    });

    gapiCoreLoadedPromise.then(() => {
        console.log('gapi.client core module loaded.');
        const savedKey = getSavedApiKey();
        if (savedKey) {
            apiKeyInput.value = savedKey;
            // Attempt init GAPI with saved key immediately
            initGapiClient(savedKey);
        } else {
            displayMessage('Please enter your Google API Key and Blog URL or ID to begin.', 'info');
            updateButtonStates();
        }
    }).catch(error => {
        console.error('Error loading gapi.client core module:', error);
        displayMessage('Critical Error: Failed to load Google API client core.', 'error');
        updateButtonStates();
    });
};

// --- GAPI Client Initialization (no changes) ---
async function initGapiClient(apiKeyToUse) {
    if (gapiClientReady && gapi.client.apiKey === apiKeyToUse) {
        console.log('gapi.client already initialized with this key.');
        return;
    }

    if (!apiKeyToUse) {
        console.log('initGapiClient called with empty API Key, cannot initialize.');
        gapiClientReady = false;
        displayMessage('API Key is missing for initialization.', 'error');
        updateButtonStates();
        return;
    }

    try {
        console.log('Attempting to initialize gapi.client with provided key...');
        await gapi.client.init({
            apiKey: apiKeyToUse,
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/blogger/v3/rest"],
        });
        gapiClientReady = true;
        console.log('gapi.client initialized SUCCESSFULLY.');
        displayMessage('Google API Client ready.', 'success');
        updateButtonStates();
    } catch (error) {
        gapiClientReady = false;
        console.error('Error initializing gapi.client:', error);
        const errorMessage = error.details || (error.result && error.result.error && error.result.error.message) || error.message || JSON.stringify(error);
        displayMessage(`Failed to initialize API client. Error: ${errorMessage}`);
        updateButtonStates();
    }
}

// --- API Calls (no changes) ---
async function getBlogIdFromUrl(blogUrl, apiKey) {
    if (!gapiClientReady) {
        throw new Error("Google API Client is not initialized. Please ensure API Key is entered.");
    }
    try {
        const response = await gapi.client.blogger.blogs.getByUrl({
            url: blogUrl,
            key: apiKey
        });
        if (!response.result || !response.result.id) {
             throw new Error("Blog ID not found for the provided URL. Please check the URL carefully.");
        }
        return response.result.id;
    } catch (error) {
        if (error.result && error.result.error && error.result.error.code === 404) {
            throw new Error("Blog not found for this URL. Please verify the URL and your API key restrictions.");
        }
        throw new Error(`Failed to get Blog ID from URL: ${error.details || error.message || JSON.stringify(error)}`);
    }
}

async function listAllPosts(blogId, apiKey, posts = [], pageToken = undefined) {
    if (!gapiClientReady) {
        throw new Error("Google API Client is not initialized. Please ensure API Key is entered.");
    }
    try {
        const response = await gapi.client.blogger.posts.list({
            blogId: blogId,
            maxResults: 500,
            pageToken: pageToken,
            fetchBodies: false,
            key: apiKey
        });

        if (!response.result || !response.result.items) {
            return posts;
        }

        posts = posts.concat(response.result.items || []);

        if (response.result.nextPageToken) {
            return listAllPosts(blogId, apiKey, posts, response.result.nextPageToken);
        } else {
            return posts;
        }
    } catch (error) {
        if (error.result && error.result.error && error.result.error.code === 404) {
            throw new Error("Blog not found for this ID. Please verify the Blog ID and API key restrictions.");
        }
        if (error.result && error.result.error && error.result.error.code === 400) {
            throw new Error("Invalid Blog ID or malformed request. Please check the ID.");
        }
        throw new Error(`Failed to list posts: ${error.details || error.message || JSON.stringify(error)}`);
    }
}

// --- Event Handlers ---

toggleApiKeyVisibilityButton.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleApiKeyVisibilityButton.textContent = 'Hide Key';
    } else {
        apiKeyInput.type = 'password';
        toggleApiKeyVisibilityButton.textContent = 'Show Key';
    }
});

// --- MODIFIED: Debounce GAPI initialization on API key input ---
apiKeyInput.addEventListener('input', async () => {
    updateButtonStates(); // Update button states immediately

    if (initGapiTimeout) {
        clearTimeout(initGapiTimeout); // Clear previous timeout
    }

    const apiKey = apiKeyInput.value.trim();

    // Only attempt to initialize GAPI after a short pause in typing, and if key length is reasonable
    if (gapiCoreLoadedPromise && apiKey.length >= 10) { // Require at least 10 chars to avoid very short inputs
        initGapiTimeout = setTimeout(async () => {
            await gapiCoreLoadedPromise; // Ensure core client is loaded
            initGapiClient(apiKey); // No 'await' here, let it run in background
        }, 500); // Wait 500ms after last keystroke
    } else if (apiKey.length < 10 && gapiClientReady) {
        // If key becomes too short (e.g., user backspaces), reset GAPI readiness
        gapiClientReady = false;
        updateButtonStates();
    }
});

blogUrlOrIdInput.addEventListener('input', updateButtonStates);

// --- MODIFIED: Listener for Remember API Key checkbox for immediate save/clear ---
rememberApiKeyCheckbox.addEventListener('change', () => {
    const apiKey = apiKeyInput.value.trim();
    if (rememberApiKeyCheckbox.checked) {
        if (apiKey.length > 0) {
            saveApiKey(apiKey); // Save the key
            displayMessage('API Key saved to local storage.', 'success');
        } else {
            // Should be disabled, but a fallback if enabled somehow
            rememberApiKeyCheckbox.checked = false; // Uncheck it again
            displayMessage('Please enter an API Key before checking "Remember API Key".', 'error');
        }
    } else {
        clearSavedApiKey(); // Clear key from local storage (but not the input field)
        displayMessage('API Key removed from local storage.', 'info');
    }
});

getPostsButton.addEventListener('click', async () => {
    console.log('[Get All Posts] button clicked. Current gapiClientReady:', gapiClientReady);

    let blogUrlOrId = blogUrlOrIdInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    postsList.innerHTML = '';
    messagesDiv.textContent = '';

    if (!blogUrlOrId || !apiKey) {
        displayMessage('Please ensure both Blog URL/ID and Google API Key are entered.');
        updateButtonStates();
        return;
    }

    showLoading(true);
    try {
        // Ensure GAPI client is ready before proceeding with API calls
        if (!gapiClientReady) {
            if (!gapiCoreLoadedPromise) {
                throw new Error("Google API client core script not yet loaded. Please wait.");
            }
            await gapiCoreLoadedPromise;
            await initGapiClient(apiKey);
            if (!gapiClientReady) {
                throw new Error("API Client could not be initialized with the provided key. Check console for details.");
            }
        }

        if (blogUrlOrId.length > 0 && !(blogUrlOrId.startsWith('http://') || blogUrlOrId.startsWith('https://')) && !/^\d+$/.test(blogUrlOrId)) {
            blogUrlOrId = 'https://' + blogUrlOrId;
            blogUrlOrIdInput.value = blogUrlOrId;
            displayMessage('Automatically prefixed URL with https://', 'info');
        }

        let blogId = blogUrlOrId;
        if (blogUrlOrId.startsWith('http://') || blogUrlOrId.startsWith('https://')) {
            displayMessage('Attempting to get Blog ID from URL...', 'info');
            blogId = await getBlogIdFromUrl(blogUrlOrId, apiKey);
            displayMessage(`Found Blog ID: ${blogId}`, 'success');
        }

        const allPosts = await listAllPosts(blogId, apiKey);

        if (allPosts.length === 0) {
            postsList.innerHTML = '<li>No posts found for this blog, or the provided Blog ID/URL is invalid or has no posts.</li>';
            displayMessage('No posts found for the provided Blog ID/URL.', 'info');
        } else {
            allPosts.sort((a, b) => new Date(b.published) - new Date(a.published));
            postsList.innerHTML = '';
            allPosts.forEach(post => {
                const listItem = document.createElement('li');
                listItem.className = 'post-item';
                listItem.innerHTML = `
                    <h3><a href="${post.url}" target="_blank">${post.title}</a></h3>
                    <p>Published: ${new Date(post.published).toLocaleDateString()}</p>
                `;
                postsList.appendChild(listItem);
            });
            displayMessage(`Successfully loaded ${allPosts.length} posts.`, 'success');
        }
    } catch (error) {
        displayMessage(`Error: ${error.message}`);
        console.error('API Error:', error);
    } finally {
        showLoading(false);
    }
});

clearApiKeyButton.addEventListener('click', () => {
    if (apiKeyInput.value.trim().length > 0) {
        if (!confirm('Are you sure you want to clear your Google API Key from local storage? This cannot be undone.')) {
            return;
        }
    }
    clearSavedApiKey(); // This clears from storage and unchecks checkbox
    apiKeyInput.value = ''; // Explicitly clear the visual input field here for "Clear API Key" button
    apiKeyInput.type = 'password';
    toggleApiKeyVisibilityButton.textContent = 'Show Key';
    gapiClientReady = false; // Reset client status, will be re-initialized on next click
    displayMessage('API Key cleared from local storage. Please re-enter to use.', 'info');
    updateButtonStates();
});

// --- Initial DOM Load Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const savedKey = getSavedApiKey(); // This calls getSavedApiKey which sets the checkbox state
    if (savedKey) {
        apiKeyInput.value = savedKey;
    } else {
        displayMessage('Please enter your Google API Key and Blog URL or ID to begin.', 'info');
    }
    apiKeyInput.type = 'password';
    toggleApiKeyVisibilityButton.textContent = 'Show Key';

    updateButtonStates(); // Call this immediately on load to set initial button and checkbox states
});