// app.js
const BLOGGER_API_KEY_STORAGE_KEY = 'blogger_api_key';

const blogUrlOrIdInput = document.getElementById('blogUrlOrIdInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleApiKeyVisibilityButton = document.getElementById('toggleApiKeyVisibility'); // New element
const getPostsButton = document.getElementById('getPostsButton');
const clearApiKeyButton = document.getElementById('clearApiKeyButton');
const messagesDiv = document.getElementById('messages');
const loadingSpinner = document.getElementById('loadingSpinner');
const postsList = document.getElementById('postsList');

let gapiClientReady = false; // Tracks if gapi.client.init() has successfully run
let gapiCoreLoadedPromise = null; // Promise to track when gapi.load('client') is done

// --- Utility Functions ---

function displayMessage(msg, type = 'error') {
    messagesDiv.textContent = msg;
    messagesDiv.style.color = type === 'error' ? 'red' : (type === 'success' ? 'green' : 'blue');
    if (type !== 'persistent') {
        setTimeout(() => { messagesDiv.textContent = ''; }, 5000);
    }
}

function showLoading(show) {
    loadingSpinner.style.display = show ? 'block' : 'none';
    getPostsButton.disabled = show;
    clearApiKeyButton.disabled = show;
    blogUrlOrIdInput.disabled = show;
    apiKeyInput.disabled = show;
    toggleApiKeyVisibilityButton.disabled = show; // Disable toggle button too
    if (show) {
        messagesDiv.textContent = 'Fetching posts...';
        messagesDiv.style.color = 'blue';
    } else {
        messagesDiv.textContent = '';
    }
}

function saveApiKey(key) {
    localStorage.setItem(BLOGGER_API_KEY_STORAGE_KEY, key);
}

function getSavedApiKey() {
    return localStorage.getItem(BLOGGER_API_KEY_STORAGE_KEY);
}

function clearSavedApiKey() {
    localStorage.removeItem(BLOGGER_API_KEY_STORAGE_KEY);
}

// --- GAPI Core Loading (from index.html onload) ---

// This function is called by the 'onload' attribute of the Google API script tag in index.html
window.onGapiLoaded = function() {
    console.log('Google API client script loaded. Now loading the core client module...');
    gapiCoreLoadedPromise = new Promise(resolve => {
        gapi.load('client', resolve);
    });

    gapiCoreLoadedPromise.then(() => {
        console.log('gapi.client core module loaded.');
        const savedKey = getSavedApiKey();
        if (savedKey) {
            apiKeyInput.value = savedKey; // Populate input
            initGapiClient(savedKey); // Try to init with saved key
        } else {
            displayMessage('Please enter your Google API Key and Blog URL/ID to begin.', 'info');
            getPostsButton.disabled = false; // Enable button so user can enter key and click
        }
    }).catch(error => {
        console.error('Error loading gapi.client core module:', error);
        displayMessage('Critical Error: Failed to load Google API client core.', 'error');
        getPostsButton.disabled = true;
    });
};

// --- GAPI Client Initialization (requires API Key) ---

async function initGapiClient(apiKeyToUse) {
    if (gapiClientReady && gapi.client.apiKey === apiKeyToUse) {
        console.log('gapi.client already initialized with this key.');
        return;
    }

    if (!apiKeyToUse) {
        console.log('initGapiClient called with empty API Key, cannot initialize.');
        gapiClientReady = false;
        displayMessage('API Key is missing for initialization.', 'error');
        getPostsButton.disabled = true;
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
        getPostsButton.disabled = false;
    } catch (error) {
        gapiClientReady = false;
        console.error('Error initializing gapi.client:', error);
        const errorMessage = error.details || (error.result && error.result.error && error.result.error.message) || error.message || JSON.stringify(error);
        displayMessage(`Failed to initialize API client. Error: ${errorMessage}`);
        getPostsButton.disabled = true;
    }
}

// --- API Calls ---

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
             throw new Error("Blog ID not found for the provided URL. Please check the URL.");
        }
        return response.result.id;
    } catch (error) {
        // Catch specific API errors for better messages
        if (error.result && error.result.error && error.result.error.code === 404) {
            throw new Error("Blog not found. Please verify the URL/ID and API key restrictions.");
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
            // No items means no posts, not necessarily an error, but good to handle
            return posts; // Return existing posts, which might be empty
        }

        posts = posts.concat(response.result.items || []);

        if (response.result.nextPageToken) {
            return listAllPosts(blogId, apiKey, posts, response.result.nextPageToken);
        } else {
            return posts;
        }
    } catch (error) {
        // Catch specific API errors for better messages
        if (error.result && error.result.error && error.result.error.code === 404) {
            throw new Error("Blog not found or invalid ID. Please verify the Blog ID and API key restrictions.");
        }
        if (error.result && error.result.error && error.result.error.code === 400) {
            throw new Error("Invalid request or malformed Blog ID. Please check the ID.");
        }
        throw new Error(`Failed to list posts: ${error.details || error.message || JSON.stringify(error)}`);
    }
}

// --- Event Handlers ---

// Toggle API Key Visibility
toggleApiKeyVisibilityButton.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleApiKeyVisibilityButton.textContent = 'Hide Key';
    } else {
        apiKeyInput.type = 'password';
        toggleApiKeyVisibilityButton.textContent = 'Show Key';
    }
});


getPostsButton.addEventListener('click', async () => {
    let blogUrlOrId = blogUrlOrIdInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    postsList.innerHTML = '';
    messagesDiv.textContent = '';

    if (!blogUrlOrId) {
        displayMessage('Please enter a Blogger Blog URL or ID.');
        return;
    }
    if (!apiKey) {
        displayMessage('Please enter your Google API Key.');
        return;
    }

    saveApiKey(apiKey);

    showLoading(true);
    try {
        // Ensure gapi.client is initialized with the current API key
        if (!gapiCoreLoadedPromise) {
            throw new Error("Google API client core script not yet loaded. Please wait.");
        }
        await gapiCoreLoadedPromise; // Wait for the core gapi.client to be loaded

        await initGapiClient(apiKey); // Initialize client with the current API key
        if (!gapiClientReady) {
             throw new Error("API Client could not be initialized with the provided key. Check console for details.");
        }

        // --- Improvement 2: Auto-prefix HTTPS ---
        if (blogUrlOrId.length > 0 && !(blogUrlOrId.startsWith('http://') || blogUrlOrId.startsWith('https://')) && !/^\d+$/.test(blogUrlOrId)) {
            // Only prefix if it looks like a domain and not just an ID
            blogUrlOrId = 'https://' + blogUrlOrId;
            blogUrlOrIdInput.value = blogUrlOrId; // Update input field
            displayMessage('Automatically prefixed URL with https://', 'info');
        }


        let blogId = blogUrlOrId;
        if (blogUrlOrId.startsWith('http://') || blogUrlOrId.startsWith('https://')) {
            displayMessage('Attempting to get Blog ID from URL...', 'info');
            blogId = await getBlogIdFromUrl(blogUrlOrId, apiKey); // getBlogIdFromUrl now throws if not found
            displayMessage(`Found Blog ID: ${blogId}`, 'success');
        }

        const allPosts = await listAllPosts(blogId, apiKey);

        // --- Improvement 3: Blog ID not found / No posts message ---
        if (allPosts.length === 0) {
            postsList.innerHTML = '<li>No posts found for this blog, or invalid Blog ID/URL. Please check.</li>';
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
    clearSavedApiKey();
    apiKeyInput.value = '';
    apiKeyInput.type = 'password'; // Reset to masked view
    toggleApiKeyVisibilityButton.textContent = 'Show Key'; // Reset button text
    gapiClientReady = false;
    displayMessage('API Key cleared from local storage. Please re-enter to use.', 'info');
    getPostsButton.disabled = true;
});

// --- Initial DOM Load Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const savedKey = getSavedApiKey();
    if (savedKey) {
        apiKeyInput.value = savedKey;
        // The onGapiLoaded function (called by script's onload) will then
        // automatically try to initialize gapi.client with this saved key.
    } else {
        displayMessage('Please enter your Google API Key and Blog URL/ID.', 'info');
        // No saved key, disable button until user enters one and it's init
        getPostsButton.disabled = true;
    }
    // Set default state for API key input
    apiKeyInput.type = 'password';
    toggleApiKeyVisibilityButton.textContent = 'Show Key';
});