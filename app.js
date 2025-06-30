// app.js
const BLOGGER_API_KEY_STORAGE_KEY = 'blogger_api_key';
const BLOGGER_API_KEY_REMEMBER_FLAG = 'blogger_api_key_remember';

const blogUrlOrIdInput = document.getElementById('blogUrlOrIdInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleApiKeyVisibilityButton = document.getElementById('toggleApiKeyVisibility');
const rememberApiKeyCheckbox = document.getElementById('rememberApiKeyCheckbox');
const initializeApiClientButton = document.getElementById('initializeApiClientButton'); // NEW
const getPostsButton = document.getElementById('getPostsButton');
const clearApiKeyButton = document.getElementById('clearApiKeyButton');
const messagesDiv = document.getElementById('messages');
const loadingSpinner = document.getElementById('loadingSpinner');
const postsList = document.getElementById('postsList');

let gapiClientReady = false;
let gapiCoreLoadedPromise = null;
let currentApiKeyInClient = ''; // NEW: To track the key GAPI is initialized with

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
    const isCurrentApiKeyInClient = apiKeyInput.value.trim() === currentApiKeyInClient && gapiClientReady; // NEW check

    console.log(`[updateButtonStates] API Empty: ${isApiKeyEmpty}, Blog Empty: ${isBlogInputEmpty}, GAPI Ready: ${gapiClientReady}, Key Matches Client: ${isCurrentApiKeyInClient}`);

    // Clear API Key button disabled if API key field is empty
    clearApiKeyButton.disabled = isApiKeyEmpty;

    // Get All Posts button disabled if blog input or API key input is empty OR GAPI client is not ready
    getPostsButton.disabled = isBlogInputEmpty || isApiKeyEmpty || !gapiClientReady || !isCurrentApiKeyInClient;

    // NEW: Initialize API Client button
    // It should be enabled only if API key field is NOT empty AND
    // GAPI is NOT currently ready with THIS key.
    initializeApiClientButton.disabled = isApiKeyEmpty || (gapiClientReady && isCurrentApiKeyInClient);


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
    initializeApiClientButton.disabled = show; // Disable new button during loading
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

// clearSavedApiKey no longer clears apiKeyInput.value, only local storage
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
            // 1) If at app startup time we are using a remembered key then gapi client initialization can be done right away.
            initGapiClient(savedKey); // Initialize GAPI with saved key immediately
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

// --- GAPI Client Initialization ---
async function initGapiClient(apiKeyToUse) {
    if (!apiKeyToUse) {
        console.log('initGapiClient called with empty API Key, cannot initialize.');
        gapiClientReady = false;
        currentApiKeyInClient = ''; // Reset
        displayMessage('API Key is missing for initialization.', 'error');
        updateButtonStates();
        return;
    }

    // If GAPI is already initialized with THIS specific key, do nothing.
    if (gapiClientReady && currentApiKeyInClient === apiKeyToUse) {
        console.log('gapi.client already initialized with this key.');
        displayMessage('API Client already initialized with this key.', 'info');
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
        currentApiKeyInClient = apiKeyToUse; // Store the key that successfully initialized GAPI
        console.log('gapi.client initialized SUCCESSFULLY.');
        displayMessage('Google API Client ready. You can now Get All Posts.', 'success');
        updateButtonStates();
    } catch (error) {
        gapiClientReady = false;
        currentApiKeyInClient = ''; // Clear on failure
        console.error('Error initializing gapi.client:', error);
        const errorMessage = error.details || (error.result && error.result.error && error.result.error.message) || error.message || JSON.stringify(error);
        displayMessage(`Failed to initialize API client. Error: ${errorMessage}. Please check your key and restrictions.`, 'error');
        updateButtonStates();
    }
}

// --- API Calls (no changes) ---
async function getBlogIdFromUrl(blogUrl, apiKey) {
    // This check is duplicated with updateButtonStates, but good as a fail-safe
    if (!gapiClientReady || apiKey !== currentApiKeyInClient) {
        throw new Error("Google API Client is not initialized or API Key has changed. Please initialize client first.");
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
    // This check is duplicated with updateButtonStates, but good as a fail-safe
    if (!gapiClientReady || apiKey !== currentApiKeyInClient) {
        throw new Error("Google API Client is not initialized or API Key has changed. Please initialize client first.");
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

// --- MODIFIED: apiKeyInput listener to reset GAPI state on change ---
apiKeyInput.addEventListener('input', async () => {
    // Reset GAPI client readiness if the user starts typing and the key changes
    if (gapiClientReady && apiKeyInput.value.trim() !== currentApiKeyInClient) {
        gapiClientReady = false;
        currentApiKeyInClient = '';
        displayMessage('API Key changed. Please click "Initialize API Client" to re-initialize.', 'info');
    }
    updateButtonStates(); // Always update button states
});


blogUrlOrIdInput.addEventListener('input', updateButtonStates);

rememberApiKeyCheckbox.addEventListener('change', () => {
    const apiKey = apiKeyInput.value.trim();
    if (rememberApiKeyCheckbox.checked) {
        if (apiKey.length > 0) {
            saveApiKey(apiKey);
            displayMessage('API Key saved to local storage.', 'success');
        } else {
            rememberApiKeyCheckbox.checked = false;
            displayMessage('Please enter an API Key before checking "Remember API Key".', 'error');
        }
    } else {
        clearSavedApiKey(); // Clear key from local storage (but not the input field)
        displayMessage('API Key removed from local storage.', 'info');
    }
});

// --- NEW: Initialize API Client Button Listener ---
initializeApiClientButton.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey.length === 0) {
        displayMessage('Please enter an API Key before initializing.', 'error');
        return;
    }
    if (!gapiCoreLoadedPromise) {
        displayMessage('Google API client script not yet loaded. Please wait.', 'error');
        return;
    }

    displayMessage('Initializing API client...', 'info');
    await gapiCoreLoadedPromise; // Ensure core GAPI is loaded first
    await initGapiClient(apiKey);
});


getPostsButton.addEventListener('click', async () => {
    console.log('[Get All Posts] button clicked. Current gapiClientReady:', gapiClientReady);

    let blogUrlOrId = blogUrlOrIdInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    postsList.innerHTML = '';
    messagesDiv.textContent = '';

    // Verify GAPI client is ready AND the key in the input matches the initialized key
    if (!gapiClientReady || apiKey !== currentApiKeyInClient) {
        displayMessage('Please initialize the Google API Client with your API Key first.', 'error');
        updateButtonStates();
        return;
    }

    if (!blogUrlOrId || !apiKey) { // Should be covered by disabled state, but good as a fallback
        displayMessage('Please ensure both Blog URL/ID and Google API Key are entered.', 'error');
        updateButtonStates();
        return;
    }

    showLoading(true);
    try {
        // No need to call initGapiClient here, it's checked above and done by init button

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
    // Clear from local storage and uncheck checkbox
    clearSavedApiKey();
    // Clear the visual input field here (only when "Clear API Key" button is clicked)
    apiKeyInput.value = '';
    apiKeyInput.type = 'password';
    toggleApiKeyVisibilityButton.textContent = 'Show Key';
    gapiClientReady = false; // Reset client status
    currentApiKeyInClient = ''; // Clear the currently initialized key
    displayMessage('API Key cleared from local storage and input field. Please re-enter to use.', 'info');
    updateButtonStates();
});

// --- Initial DOM Load Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const savedKey = getSavedApiKey();
    if (savedKey) {
        apiKeyInput.value = savedKey;
        // GAPI init will be triggered by onGapiLoaded's call to initGapiClient with savedKey
    } else {
        displayMessage('Please enter your Google API Key and Blog URL or ID to begin.', 'info');
    }
    apiKeyInput.type = 'password';
    toggleApiKeyVisibilityButton.textContent = 'Show Key';

    updateButtonStates(); // Call this immediately on load to set initial button and checkbox states
});