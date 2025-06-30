// app.js
const BLOGGER_API_KEY_STORAGE_KEY = 'blogger_api_key';
const BLOGGER_API_KEY_REMEMBER_FLAG = 'blogger_api_key_remember';
const THEME_STORAGE_KEY = 'app_theme'; // NEW: Theme storage key

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
const totalPostsCountDiv = document.getElementById('totalPostsCount');
const saveAsHtmlButton = document.getElementById('saveAsHtmlButton');
const themeToggle = document.getElementById('themeToggle'); // NEW: Theme toggle button

let gapiClientReady = false;
let gapiCoreLoadedPromise = null;
let currentApiKeyInClient = '';
let blogIdFromQueryString = '';
let apiKeyRememberedOnLoad = false;

// --- Theme Functions (NEW) ---

function setTheme(theme) {
    document.body.classList.remove('light-mode', 'dark-mode'); // Remove existing classes
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.textContent = 'Light Mode';
    } else {
        // Default is light, no specific light-mode class needed due to :root
        themeToggle.textContent = 'Dark Mode';
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function getPreferredTheme() {
    // 1. Check localStorage for user preference
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme) {
        return storedTheme;
    }
    // 2. Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    // 3. Default to light theme
    return 'light';
}

// --- Utility Functions ---

function displayMessage(msg, type = 'error') {
    messagesDiv.textContent = msg;
    // NEW: Add classes for styling, remove previous ones
    messagesDiv.classList.remove('error-message', 'info-message', 'success-message');
    if (type === 'error') {
        messagesDiv.classList.add('error-message');
    } else if (type === 'success') {
        messagesDiv.classList.add('success-message');
    } else { // 'info' or default
        messagesDiv.classList.add('info-message');
    }

    if (messagesDiv.dataset.timeoutId) {
        clearTimeout(parseInt(messagesDiv.dataset.timeoutId));
        delete messagesDiv.dataset.timeoutId;
    }

    if (type === 'error') {
        // Error messages persist
    } else if (type === 'info' || type === 'success') {
        const timeoutId = setTimeout(() => {
            messagesDiv.textContent = '';
            messagesDiv.classList.remove('error-message', 'info-message', 'success-message');
        }, 8000); // Show for 8 seconds
        messagesDiv.dataset.timeoutId = timeoutId;
    }
}

function updateButtonStates() {
    const isApiKeyEmpty = apiKeyInput.value.trim().length === 0;
    const isBlogInputEmpty = blogUrlOrIdInput.value.trim().length === 0;
    const isCurrentApiKeyInClient = apiKeyInput.value.trim() === currentApiKeyInClient && gapiClientReady;
    const hasPostsDisplayed = postsList.children.length > 0;

    console.log(`[updateButtonStates] API Empty: ${isApiKeyEmpty}, Blog Empty: ${isBlogInputEmpty}, GAPI Ready: ${gapiClientReady}, Key Matches Client: ${isCurrentApiKeyInClient}, Has Posts: ${hasPostsDisplayed}`);

    clearApiKeyButton.disabled = isApiKeyEmpty;
    getPostsButton.disabled = isBlogInputEmpty || isApiKeyEmpty || !gapiClientReady || !isCurrentApiKeyInClient;
    initializeApiClientButton.disabled = isApiKeyEmpty || (gapiClientReady && isCurrentApiKeyInClient);

    rememberApiKeyCheckbox.disabled = isApiKeyEmpty;
    if (isApiKeyEmpty) {
        rememberApiKeyCheckbox.checked = false;
        localStorage.removeItem(BLOGGER_API_KEY_STORAGE_KEY);
        localStorage.removeItem(BLOGGER_API_KEY_REMEMBER_FLAG);
    }

    saveAsHtmlButton.disabled = !hasPostsDisplayed;
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
    saveAsHtmlButton.disabled = show;
    themeToggle.disabled = show; // NEW: Disable theme toggle during loading

    if (show) {
        messagesDiv.textContent = 'Fetching posts...';
        messagesDiv.classList.remove('error-message', 'info-message', 'success-message'); // Clear message classes
        messagesDiv.classList.add('info-message'); // Add info class for loading message
        if (messagesDiv.dataset.timeoutId) {
            clearTimeout(parseInt(messagesDiv.dataset.timeoutId));
            delete messagesDiv.dataset.timeoutId;
        }
        postsList.innerHTML = '';
        totalPostsCountDiv.textContent = '';
    } else {
        if (messagesDiv.textContent === 'Fetching posts...') { // Only clear if it was the loading message
            messagesDiv.textContent = '';
            messagesDiv.classList.remove('info-message');
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

function getBlogIdFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const blogParam = params.get('blog');
    if (blogParam) {
        blogUrlOrIdInput.value = blogParam;
        return blogParam;
    }
    return null;
}

async function autoGetPostsIfReady() {
    if (apiKeyRememberedOnLoad && blogIdFromQueryString && gapiClientReady) {
        console.log("Auto-triggering Get All Posts...");
        await getPostsButton.click();
    }
}

window.onGapiLoaded = function() {
    console.log('Google API client script loaded. Now loading the core client module...');
    gapiCoreLoadedPromise = new Promise(resolve => {
        gapi.load('client', resolve);
    });

    gapiCoreLoadedPromise.then(async () => {
        console.log('gapi.client core module loaded.');
        const savedKey = getSavedApiKey();
        if (savedKey) {
            apiKeyInput.value = savedKey;
            apiKeyRememberedOnLoad = true;
            await initGapiClient(savedKey);
            if (gapiClientReady && blogIdFromQueryString) {
                autoGetPostsIfReady();
            }
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
        messagesDiv.classList.remove('error-message', 'info-message', 'success-message');
        if (messagesDiv.dataset.timeoutId) {
            clearTimeout(parseInt(messagesDiv.dataset.timeoutId));
            delete messagesDiv.dataset.timeoutId;
        }

        displayMessage('Initializing API client...', 'info'); // Display before actual init call
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

themeToggle.addEventListener('click', () => { // NEW: Theme toggle click handler
    const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
});

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
    messagesDiv.classList.remove('error-message', 'info-message', 'success-message');
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

    postsList.innerHTML = '';
    totalPostsCountDiv.textContent = '';
    messagesDiv.textContent = '';
    messagesDiv.classList.remove('error-message', 'info-message', 'success-message'); // Clear all message classes
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

    showLoading(true);

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

        if (allPosts.length === 0) {
            postsList.innerHTML = '<li>No posts found for this blog, or the provided Blog ID/URL is invalid or has no posts.</li>';
            displayMessage('No posts found for the provided Blog ID/URL.', 'info');
            totalPostsCountDiv.textContent = 'Total Posts: 0';
        } else {
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

                if (monthYear !== currentMonthYear) {
                    currentMonthYear = monthYear;
                    const headerItem = document.createElement('li');
                    headerItem.className = 'post-month-header';
                    headerItem.textContent = currentMonthYear;
                    postsList.appendChild(headerItem);
                }

                const listItem = document.createElement('li');
                listItem.className = 'post-item';
                listItem.innerHTML = `<strong>${day}:</strong> <a href="${post.url}" target="_blank">${post.title}</a>`;
                postsList.appendChild(listItem);
            });
            displayMessage(`Successfully loaded ${allPosts.length} posts.`, 'success');
        }
    } catch (error) {
        displayMessage(`Error: ${error.message}`, 'error');
        console.error('API Error:', error);
        totalPostsCountDiv.textContent = 'Total Posts: 0';
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
    messagesDiv.classList.remove('error-message', 'info-message', 'success-message');
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
    postsList.innerHTML = '';
    totalPostsCountDiv.textContent = '';
    displayMessage('API Key cleared from local storage and input field. Please re-enter to use.', 'info');
    updateButtonStates();
});

// Save as HTML button functionality
saveAsHtmlButton.addEventListener('click', () => {
    if (postsList.children.length === 0) {
        displayMessage('No posts to save. Please fetch posts first.', 'info');
        return;
    }

    const now = new Date();
    const dateTimeString = now.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });

    const formattedDateYYYYMMDD = now.getFullYear() + '-' +
                                (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
                                now.getDate().toString().padStart(2, '0');

    let blogIdentifierForFile = blogUrlOrIdInput.value.trim()
        .replace(/^(https?:\/\/)/, '')
        .replace(/\//g, '-')
        .replace(/\.+/g, '-')
        .replace(/[^a-zA-Z0-9-]/g, '')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50);

    if (blogIdentifierForFile === '') {
        blogIdentifierForFile = 'unknown-blog';
    }

    // Capture current theme styles for the saved HTML
    const currentThemeClass = document.body.classList.contains('dark-mode') ? 'dark-mode' : '';
    const isDarkMode = currentThemeClass === 'dark-mode';

    // Embed current theme's colors directly into the saved HTML for fidelity
    // Note: This duplicates some CSS, but ensures standalone file accuracy.
    const savedHtmlThemeStyles = `
        <style>
            body { font-family: sans-serif; margin: 20px; line-height: 1.5; }
            ul { list-style: none; padding: 0; margin: 0; }
            .post-month-header {
                font-size: 1.1em;
                font-weight: bold;
                margin-top: 15px;
                margin-bottom: 5px;
                padding: 5px 10px;
                border-radius: 3px;
            }
            .post-item {
                margin-bottom: 2px;
                font-size: 0.95em;
                line-height: 1.3;
            }
            .post-item a {
                text-decoration: none;
            }
            .post-item a:hover {
                text-decoration: underline;
            }
            .post-item strong {
                font-weight: bold;
                margin-right: 3px;
            }
            /* Specific colors for the saved file based on active theme */
            body {
                background-color: ${isDarkMode ? '#1a1a1a' : '#ffffff'};
                color: ${isDarkMode ? '#e0e0e0' : '#333333'};
            }
            .post-month-header {
                background-color: ${isDarkMode ? '#003e4c' : '#e0f7fa'};
                color: ${isDarkMode ? '#e0e0e0' : '#333333'};
            }
            .post-item a {
                color: ${isDarkMode ? '#92e0ff' : '#0056b3'};
            }
        </style>
    `;

    const headerHtml = `
        <div style="font-family: sans-serif; margin-bottom: 20px; padding: 10px; border: 1px solid ${isDarkMode ? '#444' : '#eee'}; background-color: ${isDarkMode ? '#2a2a2a' : '#f9f9f9'}; border-radius: 5px; color: ${isDarkMode ? '#e0e0e0' : '#333'};">
            <p style="margin: 0; font-size: 0.9em; color: inherit;">This list of blog posts was generated on **${dateTimeString}** using the Blogger All Posts Lister.</p>
            <p style="margin: 5px 0 0 0; font-size: 0.9em; color: inherit;">Source Blog: <a href="${blogUrlOrIdInput.value.trim()}" target="_blank" rel="noopener noreferrer" style="color: ${isDarkMode ? '#92e0ff' : '#0056b3'};">${blogUrlOrIdInput.value.trim()}</a></p>
        </div>
    `;

    const listHtml = `
        <h2 style="font-family: sans-serif; color: ${isDarkMode ? '#e0e0e0' : '#333'};">Posts</h2>
        <div style="font-family: sans-serif; font-size: 1.1em; font-weight: bold; margin-bottom: 10px; color: ${isDarkMode ? '#92e0ff' : '#007bff'};">${totalPostsCountDiv.textContent}</div>
        <ul style="list-style: none; padding: 0; margin: 0;">
            ${postsList.innerHTML}
        </ul>
    `;

    const fullHtmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Blogger Posts - ${blogUrlOrIdInput.value.trim()} - ${formattedDateYYYYMMDD}</title>
            ${savedHtmlThemeStyles}
        </head>
        <body class="${currentThemeClass}">
            ${headerHtml}
            ${listHtml}
        </body>
        </html>
    `;

    const blob = new Blob([fullHtmlContent], { type: 'text/html;charset=utf-8' });
    const fileName = `${blogIdentifierForFile}-Posts-List-${formattedDateYYYYMMDD}.html`;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    displayMessage(`List saved as "${fileName}"`, 'success');
});


// --- Initial DOM Load Logic ---
document.addEventListener('DOMContentLoaded', () => {
    // NEW: Apply preferred theme immediately on DOM load
    setTheme(getPreferredTheme());

    blogIdFromQueryString = getBlogIdFromQuery();

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

// NEW: Listen for system theme changes and update if no specific user preference is set
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    if (!localStorage.getItem(THEME_STORAGE_KEY)) { // Only react to system changes if user hasn't manually set a theme
        setTheme(event.matches ? 'dark' : 'light');
    }
});