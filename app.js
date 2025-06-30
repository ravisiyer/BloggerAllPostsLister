// app.js
const BLOGGER_API_KEY_STORAGE_KEY = 'blogger_api_key';

const blogUrlOrIdInput = document.getElementById('blogUrlOrIdInput');
const apiKeyInput = document.getElementById('apiKeyInput');
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
    messagesDiv.style.color = type === 'error' ? 'red' : 'green';
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
    // Create a promise that resolves when gapi.load('client') is complete
    gapiCoreLoadedPromise = new Promise(resolve => {
        gapi.load('client', resolve);
    });

    gapiCoreLoadedPromise.then(() => {
        console.log('gapi.client core module loaded.');
        // After core client is loaded, attempt to initialize if a key is present
        const savedKey = getSavedApiKey();
        if (savedKey) {
            apiKeyInput.value = savedKey; // Ensure input is populated first
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
        return; // Already initialized with the same key
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
        getPostsButton.disabled = false; // Ensure button is enabled on success
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
        return response.result.id;
    } catch (error) {
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

        posts = posts.concat(response.result.items || []);

        if (response.result.nextPageToken) {
            return listAllPosts(blogId, apiKey, posts, response.result.nextPageToken);
        } else {
            return posts;
        }
    } catch (error) {
        throw new Error(`Failed to list posts: ${error.details || error.message || JSON.stringify(error)}`);
    }
}

// --- Event Handlers ---

getPostsButton.addEventListener('click', async () => {
    const blogUrlOrId = blogUrlOrIdInput.value.trim();
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

    saveApiKey(apiKey); // Save the entered API key

    showLoading(true);
    try {
        // Ensure gapi.client is initialized with the current API key
        if (!gapiCoreLoadedPromise) {
            throw new Error("Google API client core script not yet loaded. Please wait.");
        }
        await gapiCoreLoadedPromise; // Wait for the core gapi.client to be loaded

        // Now, initialize the client using the API key from the input field
        await initGapiClient(apiKey);
        if (!gapiClientReady) {
             throw new Error("API Client could not be initialized with the provided key.");
        }

        let blogId = blogUrlOrId;
        if (blogUrlOrId.startsWith('http://') || blogUrlOrId.startsWith('https://')) {
            displayMessage('Attempting to get Blog ID from URL...', 'info');
            blogId = await getBlogIdFromUrl(blogUrlOrId, apiKey);
            displayMessage(`Found Blog ID: ${blogId}`, 'success');
        }

        const allPosts = await listAllPosts(blogId, apiKey);

        if (allPosts.length === 0) {
            postsList.innerHTML = '<li>No posts found for this blog.</li>';
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
    gapiClientReady = false; // Reset client status
    displayMessage('API Key cleared from local storage. Please re-enter to use.', 'info');
    getPostsButton.disabled = true; // Disable until new key is entered/client re-initialized
});

// --- Initial DOM Load Logic ---
document.addEventListener('DOMContentLoaded', () => {
    // We explicitly call onGapiLoaded from index.html's script tag,
    // which handles the initial API client loading and attempts init if key is present.
    // So, no need for complex logic here, just set initial state.
    getPostsButton.disabled = true; // Initially disable until gapi is ready and/or key is entered
});