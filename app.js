// app.js
const BLOGGER_API_KEY_STORAGE_KEY = 'blogger_api_key';

const blogUrlOrIdInput = document.getElementById('blogUrlOrIdInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleApiKeyVisibilityButton = document.getElementById('toggleApiKeyVisibility');
const getPostsButton = document.getElementById('getPostsButton');
const clearApiKeyButton = document.getElementById('clearApiKeyButton');
const messagesDiv = document.getElementById('messages');
const loadingSpinner = document.getElementById('loadingSpinner');
const postsList = document.getElementById('postsList');

let gapiClientReady = false;
let gapiCoreLoadedPromise = null;

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
    toggleApiKeyVisibilityButton.disabled = show;
    if (show) {
        messagesDiv.textContent = 'Fetching posts...';
        messagesDiv.style.color = 'blue';
    } else {
        // --- IMPROVEMENT: Only clear the loading message, not actual error/success messages ---
        if (messagesDiv.textContent === 'Fetching posts...') {
            messagesDiv.textContent = '';
        }
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
            initGapiClient(savedKey);
        } else {
            displayMessage('Please enter your Google API Key and Blog URL or ID to begin.', 'info');
            getPostsButton.disabled = false;
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
             throw new Error("Blog ID not found for the provided URL. Please check the URL carefully."); // More specific message
        }
        return response.result.id;
    } catch (error) {
        if (error.result && error.result.error && error.result.error.code === 404) {
            throw new Error("Blog not found for this URL. Please verify the URL and your API key restrictions."); // More specific message
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
            return posts; // Return existing posts, which might be empty
        }

        posts = posts.concat(response.result.items || []);

        if (response.result.nextPageToken) {
            return listAllPosts(blogId, apiKey, posts, response.result.nextPageToken);
        } else {
            return posts;
        }
    } catch (error) {
        if (error.result && error.result.error && error.result.error.code === 404) {
            throw new Error("Blog not found for this ID. Please verify the Blog ID and API key restrictions."); // More specific message
        }
        if (error.result && error.result.error && error.result.error.code === 400) {
            throw new Error("Invalid Blog ID or malformed request. Please check the ID."); // More specific message
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


getPostsButton.addEventListener('click', async () => {
    let blogUrlOrId = blogUrlOrIdInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    postsList.innerHTML = '';
    messagesDiv.textContent = ''; // Clear existing messages at the start of a new request

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
        if (!gapiCoreLoadedPromise) {
            throw new Error("Google API client core script not yet loaded. Please wait.");
        }
        await gapiCoreLoadedPromise;

        await initGapiClient(apiKey);
        if (!gapiClientReady) {
             throw new Error("API Client could not be initialized with the provided key. Check console for details.");
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
            postsList.innerHTML = '<li>No posts found for this blog, or the provided Blog ID/URL is invalid or has no posts.</li>'; // More explicit message
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
    apiKeyInput.type = 'password';
    toggleApiKeyVisibilityButton.textContent = 'Show Key';
    gapiClientReady = false;
    displayMessage('API Key cleared from local storage. Please re-enter to use.', 'info');
    getPostsButton.disabled = true;
});

// --- Initial DOM Load Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const savedKey = getSavedApiKey();
    if (savedKey) {
        apiKeyInput.value = savedKey;
    } else {
        // Only show this initial message if no key is saved
        displayMessage('Please enter your Google API Key and Blog URL or ID to begin.', 'info');
    }
    getPostsButton.disabled = true; // Initially disable until gapi is ready and/or key is entered
    apiKeyInput.type = 'password';
    toggleApiKeyVisibilityButton.textContent = 'Show Key';
});