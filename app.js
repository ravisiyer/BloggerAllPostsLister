// app.js
const BLOGGER_API_KEY_STORAGE_KEY = 'blogger_api_key';
const BLOGGER_API_KEY_REMEMBER_FLAG = 'blogger_api_key_remember';

const blogUrlOrIdInput = document.getElementById('blogUrlOrIdInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleApiKeyVisibilityButton = document.getElementById('toggleApiKeyVisibility');
const rememberApiKeyCheckbox = document.getElementById('rememberApiKeyCheckbox');
const initializeApiClientButton = document.getElementById('initializeApiClientButton');
const getPostsButton = document.getElementById('getPostsButton');
const clearApiKeyButton = document.getElementById('clearApiKeyButton');
const messagesDiv = document.getElementById('messages');
const loadingSpinner = document.getElementById('loadingSpinner');
const postsList = document.getElementById('postsList');
const totalPostsCountDiv = document.getElementById('totalPostsCount'); // NEW

let gapiClientReady = false;
let gapiCoreLoadedPromise = null;
let currentApiKeyInClient = '';

// --- Utility Functions ---

function displayMessage(msg, type = 'error') {
    messagesDiv.textContent = msg;
    messagesDiv.style.color = type === 'error' ? 'red' : (type === 'success' ? 'green' : 'blue');

    if (messagesDiv.dataset.timeoutId) {
        clearTimeout(parseInt(messagesDiv.dataset.timeoutId));
        delete messagesDiv.dataset.timeoutId;
    }

    if (type === 'error') {
        // Error messages persist until a new action
    } else if (type === 'info' || type === 'success') {
        const timeoutId = setTimeout(() => {
            messagesDiv.textContent = '';
        }, 8000); // Show for 8 seconds
        messagesDiv.dataset.timeoutId = timeoutId;
    }
}

function updateButtonStates() {
    const isApiKeyEmpty = apiKeyInput.value.trim().length === 0;
    const isBlogInputEmpty = blogUrlOrIdInput.value.trim().length === 0;
    const isCurrentApiKeyInClient = apiKeyInput.value.trim() === currentApiKeyInClient && gapiClientReady;

    console.log(`[updateButtonStates] API Empty: ${isApiKeyEmpty}, Blog Empty: ${isBlogInputEmpty}, GAPI Ready: ${gapiClientReady}, Key Matches Client: ${isCurrentApiKeyInClient}`);

    clearApiKeyButton.disabled = isApiKeyEmpty;
    getPostsButton.disabled = isBlogInputEmpty || isApiKeyEmpty || !gapiClientReady || !isCurrentApiKeyInClient;
    initializeApiClientButton.disabled = isApiKeyEmpty || (gapiClientReady && isCurrentApiKeyInClient);

    rememberApiKeyCheckbox.disabled = isApiKeyEmpty;
    if (isApiKeyEmpty) {
        rememberApiKeyCheckbox.checked = false;
        localStorage.removeItem(BLOGGER_API_KEY_STORAGE_KEY);
        localStorage.removeItem(BLOGGER_API_KEY_REMEMBER_FLAG);
    }
}

function showLoading(show) {
    loadingSpinner.style.display = show ? 'block' : 'none';
    getPostsButton.disabled = show;
    clearApiKeyButton.disabled = show;
    initializeApiClientButton.disabled = show;
    blogUrlOrIdInput.disabled = show;
    apiKeyInput.disabled = show;
    toggleApiKeyVisibilityButton.disabled = show;
    rememberApiKeyCheckbox.disabled = show;

    if (show) {
        messagesDiv.textContent = 'Fetching posts...';
        messagesDiv.style.color = 'blue';
        if (messagesDiv.dataset.timeoutId) {
            clearTimeout(parseInt(messagesDiv.dataset.timeoutId));
            delete messagesDiv.dataset.timeoutId;
        }
        // Clear previous posts and count when loading new ones
        postsList.innerHTML = '';
        totalPostsCountDiv.textContent = '';
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

function clearSavedApiKey() {
    localStorage.removeItem(BLOGGER_API_KEY_STORAGE_KEY);
    localStorage.removeItem(BLOGGER_API_KEY_REMEMBER_FLAG);
    rememberApiKeyCheckbox.checked = false;
    updateButtonStates();
}

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
            updateButtonStates();
        }
    }).catch(error => {
        console.error('Error loading gapi.client core module:', error);
        displayMessage('Critical Error: Failed to load Google API client core.', 'error');
        updateButtonStates();
    });
};

async function initGapiClient(apiKeyToUse) {
    if (!apiKeyToUse) {
        console.log('initGapiClient called with empty API Key, cannot initialize.');
        gapiClientReady = false;
        currentApiKeyInClient = '';
        displayMessage('API Key is missing for initialization.', 'error');
        updateButtonStates();
        return;
    }

    if (gapiClientReady && currentApiKeyInClient === apiKeyToUse) {
        console.log('gapi.client already initialized with this key.');
        displayMessage('API Client already initialized with this key.', 'info');
        updateButtonStates();
        return;
    }

    try {
        console.log('Attempting to initialize gapi.client with provided key...');
        messagesDiv.textContent = '';
        if (messagesDiv.dataset.timeoutId) {
            clearTimeout(parseInt(messagesDiv.dataset.timeoutId));
            delete messagesDiv.dataset.timeoutId;
        }

        await gapi.client.init({
            apiKey: apiKeyToUse,
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/blogger/v3/rest"],
        });
        gapiClientReady = true;
        currentApiKeyInClient = apiKeyToUse;
        console.log('gapi.client initialized SUCCESSFULLY.');
        displayMessage('Google API Client ready. You can now Get All Posts.', 'success');
        updateButtonStates();
    } catch (error) {
        gapiClientReady = false;
        currentApiKeyInClient = '';
        console.error('Error initializing gapi.client:', error);
        const errorMessage = error.details || (error.result && error.result.error && error.result.error.message) || error.message || JSON.stringify(error);
        displayMessage(`Failed to initialize API client. Error: ${errorMessage}. Please check your key and restrictions.`, 'error');
        updateButtonStates();
    }
}

async function getBlogIdFromUrl(blogUrl, apiKey) {
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

apiKeyInput.addEventListener('input', async () => {
    if (gapiClientReady && apiKeyInput.value.trim() !== currentApiKeyInClient) {
        gapiClientReady = false;
        currentApiKeyInClient = '';
        displayMessage('API Key changed. Please click "Initialize API Client" to re-initialize.', 'info');
    }
    updateButtonStates();
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
        clearSavedApiKey();
        displayMessage('API Key removed from local storage.', 'info');
    }
});

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

    messagesDiv.textContent = '';
    if (messagesDiv.dataset.timeoutId) {
        clearTimeout(parseInt(messagesDiv.dataset.timeoutId));
        delete messagesDiv.dataset.timeoutId;
    }

    displayMessage('Initializing API client...', 'info');
    await gapiCoreLoadedPromise;
    await initGapiClient(apiKey);
});

getPostsButton.addEventListener('click', async () => {
    console.log('[Get All Posts] button clicked. Current gapiClientReady:', gapiClientReady);

    let blogUrlOrId = blogUrlOrIdInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    postsList.innerHTML = ''; // Clear previous posts
    totalPostsCountDiv.textContent = ''; // Clear previous total count
    messagesDiv.textContent = ''; // Clear messages before starting
    if (messagesDiv.dataset.timeoutId) {
        clearTimeout(parseInt(messagesDiv.dataset.timeoutId));
        delete messagesDiv.dataset.timeoutId;
    }

    if (!gapiClientReady || apiKey !== currentApiKeyInClient) {
        displayMessage('Please initialize the Google API Client with your API Key first.', 'error');
        updateButtonStates();
        return;
    }

    if (!blogUrlOrId || !apiKey) {
        displayMessage('Please ensure both Blog URL/ID and Google API Key are entered.', 'error');
        updateButtonStates();
        return;
    }

    showLoading(true); // showLoading now also clears previous posts and count

    try {
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

        // --- NEW RENDERING LOGIC ---
        if (allPosts.length === 0) {
            postsList.innerHTML = '<li>No posts found for this blog, or the provided Blog ID/URL is invalid or has no posts.</li>';
            displayMessage('No posts found for the provided Blog ID/URL.', 'info');
            totalPostsCountDiv.textContent = 'Total Posts: 0';
        } else {
            // Sort posts by published date, newest first
            allPosts.sort((a, b) => new Date(b.published) - new Date(a.published));

            totalPostsCountDiv.textContent = `Total Posts: ${allPosts.length}`;

            let currentMonthYear = '';
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

            allPosts.forEach(post => {
                const postDate = new Date(post.published);
                const month = monthNames[postDate.getMonth()];
                const year = postDate.getFullYear();
                const day = postDate.getDate();
                const monthYear = `${month} ${year}`;

                // Check if we need to add a new month header
                if (monthYear !== currentMonthYear) {
                    currentMonthYear = monthYear;
                    const headerItem = document.createElement('li');
                    headerItem.className = 'post-month-header';
                    headerItem.textContent = currentMonthYear;
                    postsList.appendChild(headerItem);
                }

                const listItem = document.createElement('li');
                listItem.className = 'post-item';
                // Format: Day: Post title
                listItem.innerHTML = `<strong>${day}:</strong> <a href="${post.url}" target="_blank">${post.title}</a>`;
                postsList.appendChild(listItem);
            });
            displayMessage(`Successfully loaded ${allPosts.length} posts.`, 'success');
        }
    } catch (error) {
        displayMessage(`Error: ${error.message}`, 'error');
        console.error('API Error:', error);
        totalPostsCountDiv.textContent = 'Total Posts: 0'; // Set count to 0 on error
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
    messagesDiv.textContent = '';
    if (messagesDiv.dataset.timeoutId) {
        clearTimeout(parseInt(messagesDiv.dataset.timeoutId));
        delete messagesDiv.dataset.timeoutId;
    }

    clearSavedApiKey();
    apiKeyInput.value = '';
    apiKeyInput.type = 'password';
    toggleApiKeyVisibilityButton.textContent = 'Show Key';
    gapiClientReady = false;
    currentApiKeyInClient = '';
    postsList.innerHTML = ''; // Clear posts on API key clear
    totalPostsCountDiv.textContent = ''; // Clear total count on API key clear
    displayMessage('API Key cleared from local storage and input field. Please re-enter to use.', 'info');
    updateButtonStates();
});

// --- Initial DOM Load Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const savedKey = getSavedApiKey();
    if (savedKey) {
        apiKeyInput.value = savedKey;
    } else {
        displayMessage('Please enter your Google API Key and Blog URL or ID to begin.', 'info');
    }
    apiKeyInput.type = 'password';
    toggleApiKeyVisibilityButton.textContent = 'Show Key';

    updateButtonStates();
});