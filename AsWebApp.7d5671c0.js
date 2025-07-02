let BLOGGER_API_KEY_STORAGE_KEY="blogger_api_key",BLOGGER_API_KEY_REMEMBER_FLAG="blogger_api_key_remember",THEME_STORAGE_KEY="app_theme",blogUrlOrIdInput=document.getElementById("blogUrlOrIdInput"),apiKeyInput=document.getElementById("apiKeyInput"),toggleApiKeyVisibilityButton=document.getElementById("toggleApiKeyVisibility"),rememberApiKeyCheckbox=document.getElementById("rememberApiKeyCheckbox"),initializeApiClientButton=document.getElementById("initializeApiClientButton"),getPostsButton=document.getElementById("getPostsButton"),clearApiKeyButton=document.getElementById("clearApiKeyButton"),messagesDiv=document.getElementById("messages"),loadingSpinner=document.getElementById("loadingSpinner"),postsList=document.getElementById("postsList"),totalPostsCountDiv=document.getElementById("totalPostsCount"),saveAsHtmlButton=document.getElementById("saveAsHtmlButton"),themeSelector=document.getElementById("themeSelector"),themeDeviceRadio=document.getElementById("themeDevice"),themeLightRadio=document.getElementById("themeLight"),themeDarkRadio=document.getElementById("themeDark"),gapiClientReady=!1,gapiCoreLoadedPromise=null,currentApiKeyInClient="",blogIdFromQueryString="",apiKeyRememberedOnLoad=!1;function applyTheme(e){document.body.classList.remove("light-mode","dark-mode");let t=e;"device"===e?(localStorage.removeItem(THEME_STORAGE_KEY),t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):localStorage.setItem(THEME_STORAGE_KEY,e),"dark"===t&&document.body.classList.add("dark-mode"),"device"===e?themeDeviceRadio.checked=!0:"light"===e?themeLightRadio.checked=!0:"dark"===e&&(themeDarkRadio.checked=!0)}function getInitialThemeChoice(){let e=localStorage.getItem(THEME_STORAGE_KEY);return e||"device"}function displayMessage(e,t="error"){if(messagesDiv.textContent=e,messagesDiv.classList.remove("error-message","info-message","success-message"),"error"===t?messagesDiv.classList.add("error-message"):"success"===t?messagesDiv.classList.add("success-message"):messagesDiv.classList.add("info-message"),messagesDiv.dataset.timeoutId&&(clearTimeout(parseInt(messagesDiv.dataset.timeoutId)),delete messagesDiv.dataset.timeoutId),"error"===t);else if("info"===t||"success"===t){let e=setTimeout(()=>{messagesDiv.textContent="",messagesDiv.classList.remove("error-message","info-message","success-message")},8e3);messagesDiv.dataset.timeoutId=e}}function updateButtonStates(){let e=0===apiKeyInput.value.trim().length,t=0===blogUrlOrIdInput.value.trim().length,s=apiKeyInput.value.trim()===currentApiKeyInClient&&gapiClientReady,i=postsList.children.length>0;console.log(`[updateButtonStates] API Empty: ${e}, Blog Empty: ${t}, GAPI Ready: ${gapiClientReady}, Key Matches Client: ${s}, Has Posts: ${i}`),clearApiKeyButton.disabled=e,getPostsButton.disabled=t||e||!gapiClientReady||!s,initializeApiClientButton.disabled=e||gapiClientReady&&s,rememberApiKeyCheckbox.disabled=e,e&&(rememberApiKeyCheckbox.checked=!1,localStorage.removeItem(BLOGGER_API_KEY_STORAGE_KEY),localStorage.removeItem(BLOGGER_API_KEY_REMEMBER_FLAG)),saveAsHtmlButton.disabled=!i}function showLoading(e){loadingSpinner.style.display=e?"block":"none",getPostsButton.disabled=e,clearApiKeyButton.disabled=e,initializeApiClientButton.disabled=e,blogUrlOrIdInput.disabled=e,apiKeyInput.disabled=e,toggleApiKeyVisibilityButton.disabled=e,rememberApiKeyCheckbox.disabled=e,saveAsHtmlButton.disabled=e,e?themeSelector.classList.add("disabled"):themeSelector.classList.remove("disabled"),e?(messagesDiv.textContent="Fetching posts...",messagesDiv.classList.remove("error-message","info-message","success-message"),messagesDiv.classList.add("info-message"),messagesDiv.dataset.timeoutId&&(clearTimeout(parseInt(messagesDiv.dataset.timeoutId)),delete messagesDiv.dataset.timeoutId),postsList.innerHTML="",totalPostsCountDiv.textContent=""):("Fetching posts..."===messagesDiv.textContent&&(messagesDiv.textContent="",messagesDiv.classList.remove("info-message")),updateButtonStates())}function saveApiKey(e){localStorage.setItem(BLOGGER_API_KEY_STORAGE_KEY,e),localStorage.setItem(BLOGGER_API_KEY_REMEMBER_FLAG,"true"),updateButtonStates()}function getSavedApiKey(){return"true"===localStorage.getItem(BLOGGER_API_KEY_REMEMBER_FLAG)?(rememberApiKeyCheckbox.checked=!0,localStorage.getItem(BLOGGER_API_KEY_STORAGE_KEY)):(rememberApiKeyCheckbox.checked=!1,null)}function clearSavedApiKey(){localStorage.removeItem(BLOGGER_API_KEY_STORAGE_KEY),localStorage.removeItem(BLOGGER_API_KEY_REMEMBER_FLAG),rememberApiKeyCheckbox.checked=!1,updateButtonStates()}function getBlogIdFromQuery(){let e=new URLSearchParams(window.location.search).get("blog");return e?(blogUrlOrIdInput.value=e,e):null}async function autoGetPostsIfReady(){apiKeyRememberedOnLoad&&blogIdFromQueryString&&gapiClientReady&&(console.log("Auto-triggering Get All Posts..."),await getPostsButton.click())}async function initGapiClient(e){if(!e){console.log("initGapiClient called with empty API Key, cannot initialize."),gapiClientReady=!1,currentApiKeyInClient="",displayMessage("API Key is missing for initialization.","error"),updateButtonStates();return}if(gapiClientReady&&currentApiKeyInClient===e){console.log("gapi.client already initialized with this key."),displayMessage("API Client already initialized with this key.","info"),updateButtonStates();return}try{console.log("Attempting to initialize gapi.client with provided key..."),messagesDiv.textContent="",messagesDiv.classList.remove("error-message","info-message","success-message"),messagesDiv.dataset.timeoutId&&(clearTimeout(parseInt(messagesDiv.dataset.timeoutId)),delete messagesDiv.dataset.timeoutId),displayMessage("Initializing API client...","info"),await gapi.client.init({apiKey:e,discoveryDocs:["https://www.googleapis.com/discovery/v1/apis/blogger/v3/rest"]}),gapiClientReady=!0,currentApiKeyInClient=e,console.log("gapi.client initialized SUCCESSFULLY."),displayMessage("Google API Client ready. You can now Get All Posts.","success"),updateButtonStates()}catch(t){gapiClientReady=!1,currentApiKeyInClient="",console.error("Error initializing gapi.client:",t);let e=t.details||t.result&&t.result.error&&t.result.error.message||t.message||JSON.stringify(t);displayMessage(`Failed to initialize API client. Error: ${e}. Please check your key and restrictions.`,"error"),updateButtonStates()}}async function getBlogIdFromUrl(e,t){if(!gapiClientReady||t!==currentApiKeyInClient)throw Error("Google API Client is not initialized or API Key has changed. Please initialize client first.");try{let s=await gapi.client.blogger.blogs.getByUrl({url:e,key:t});if(!s.result||!s.result.id)throw Error("Blog ID not found for the provided URL. Please check the URL carefully.");return s.result.id}catch(e){if(e.result&&e.result.error&&404===e.result.error.code)throw Error("Blog not found for this URL. Please verify the URL and your API key restrictions.");throw Error(`Failed to get Blog ID from URL: ${e.details||e.message||JSON.stringify(e)}`)}}async function listAllPosts(e,t,s=[],i){if(!gapiClientReady||t!==currentApiKeyInClient)throw Error("Google API Client is not initialized or API Key has changed. Please initialize client first.");try{let o=await gapi.client.blogger.posts.list({blogId:e,maxResults:500,pageToken:i,fetchBodies:!1,key:t});if(!o.result||!o.result.items)return s;if(s=s.concat(o.result.items||[]),o.result.nextPageToken)return listAllPosts(e,t,s,o.result.nextPageToken);return s}catch(e){if(e.result&&e.result.error&&404===e.result.error.code)throw Error("Blog not found for this ID. Please verify the Blog ID and API key restrictions.");if(e.result&&e.result.error&&400===e.result.error.code)throw Error("Invalid Blog ID or malformed request. Please check the ID.");throw Error(`Failed to list posts: ${e.details||e.message||JSON.stringify(e)}`)}}window.onGapiLoaded=function(){console.log("Google API client script loaded. Now loading the core client module..."),(gapiCoreLoadedPromise=new Promise(e=>{gapi.load("client",e)})).then(async()=>{console.log("gapi.client core module loaded.");let e=getSavedApiKey();e?(apiKeyInput.value=e,apiKeyRememberedOnLoad=!0,await initGapiClient(e),gapiClientReady&&blogIdFromQueryString&&autoGetPostsIfReady()):(displayMessage("Please enter your Google API Key and Blog URL or ID to begin.","info"),updateButtonStates())}).catch(e=>{console.error("Error loading gapi.client core module:",e),displayMessage("Critical Error: Failed to load Google API client core.","error"),updateButtonStates()})},themeSelector.addEventListener("change",e=>{applyTheme(e.target.value)}),toggleApiKeyVisibilityButton.addEventListener("click",()=>{"password"===apiKeyInput.type?(apiKeyInput.type="text",toggleApiKeyVisibilityButton.textContent="Hide Key"):(apiKeyInput.type="password",toggleApiKeyVisibilityButton.textContent="Show Key")}),apiKeyInput.addEventListener("input",async()=>{gapiClientReady&&apiKeyInput.value.trim()!==currentApiKeyInClient&&(gapiClientReady=!1,currentApiKeyInClient="",displayMessage('API Key changed. Please click "Initialize API Client" to re-initialize.',"info")),updateButtonStates()}),blogUrlOrIdInput.addEventListener("input",updateButtonStates),rememberApiKeyCheckbox.addEventListener("change",()=>{let e=apiKeyInput.value.trim();rememberApiKeyCheckbox.checked?e.length>0?(saveApiKey(e),displayMessage("API Key saved to local storage.","success")):(rememberApiKeyCheckbox.checked=!1,displayMessage('Please enter an API Key before checking "Remember API Key".',"error")):(clearSavedApiKey(),displayMessage("API Key removed from local storage.","info"))}),initializeApiClientButton.addEventListener("click",async()=>{let e=apiKeyInput.value.trim();return 0===e.length?void displayMessage("Please enter an API Key before initializing.","error"):gapiCoreLoadedPromise?void(messagesDiv.textContent="",messagesDiv.classList.remove("error-message","info-message","success-message"),messagesDiv.dataset.timeoutId&&(clearTimeout(parseInt(messagesDiv.dataset.timeoutId)),delete messagesDiv.dataset.timeoutId),displayMessage("Initializing API client...","info"),await gapiCoreLoadedPromise,await initGapiClient(e)):void displayMessage("Google API client script not yet loaded. Please wait.","error")}),getPostsButton.addEventListener("click",async()=>{console.log("[Get All Posts] button clicked. Current gapiClientReady:",gapiClientReady);let e=blogUrlOrIdInput.value.trim(),t=apiKeyInput.value.trim();if(postsList.innerHTML="",totalPostsCountDiv.textContent="",messagesDiv.textContent="",messagesDiv.classList.remove("error-message","info-message","success-message"),messagesDiv.dataset.timeoutId&&(clearTimeout(parseInt(messagesDiv.dataset.timeoutId)),delete messagesDiv.dataset.timeoutId),!gapiClientReady||t!==currentApiKeyInClient){displayMessage("Please initialize the Google API Client with your API Key first.","error"),updateButtonStates();return}if(!e||!t){displayMessage("Please ensure both Blog URL/ID and Google API Key are entered.","error"),updateButtonStates();return}showLoading(!0);try{!(e.length>0)||e.startsWith("http://")||e.startsWith("https://")||/^\d+$/.test(e)||(blogUrlOrIdInput.value=e="https://"+e,displayMessage("Automatically prefixed URL with https://","info"));let s=e;(e.startsWith("http://")||e.startsWith("https://"))&&(displayMessage("Attempting to get Blog ID from URL...","info"),s=await getBlogIdFromUrl(e,t),displayMessage(`Found Blog ID: ${s}`,"success"));let i=await listAllPosts(s,t);if(0===i.length)postsList.innerHTML="<li>No posts found for this blog, or the provided Blog ID/URL is invalid or has no posts.</li>",displayMessage("No posts found for the provided Blog ID/URL.","info"),totalPostsCountDiv.textContent="Total Posts: 0";else{i.sort((e,t)=>new Date(t.published)-new Date(e.published)),totalPostsCountDiv.textContent=`Total Posts: ${i.length}`;let e="",t=["January","February","March","April","May","June","July","August","September","October","November","December"];i.forEach(s=>{let i=new Date(s.published),o=t[i.getMonth()],a=i.getFullYear(),r=i.getDate(),n=`${o} ${a}`;if(n!==e){e=n;let t=document.createElement("li");t.className="post-month-header",t.textContent=e,postsList.appendChild(t)}let l=s.url;l.startsWith("http://")&&(l=l.replace("http://","https://"));let d=document.createElement("li");d.className="post-item",d.innerHTML=`<strong>${r}:</strong> <a href="${l}" target="_blank">${s.title}</a>`,postsList.appendChild(d)}),displayMessage(`Successfully loaded ${i.length} posts.`,"success")}}catch(e){displayMessage(`Error: ${e.message}`,"error"),console.error("API Error:",e),totalPostsCountDiv.textContent="Total Posts: 0"}finally{showLoading(!1)}}),clearApiKeyButton.addEventListener("click",()=>{(!(apiKeyInput.value.trim().length>0)||confirm("Are you sure you want to clear your Google API Key from local storage? This cannot be undone."))&&(messagesDiv.textContent="",messagesDiv.classList.remove("error-message","info-message","success-message"),messagesDiv.dataset.timeoutId&&(clearTimeout(parseInt(messagesDiv.dataset.timeoutId)),delete messagesDiv.dataset.timeoutId),clearSavedApiKey(),apiKeyInput.value="",apiKeyInput.type="password",toggleApiKeyVisibilityButton.textContent="Show Key",gapiClientReady=!1,currentApiKeyInClient="",postsList.innerHTML="",totalPostsCountDiv.textContent="",displayMessage("API Key cleared from local storage and input field. Please re-enter to use.","info"),updateButtonStates())}),saveAsHtmlButton.addEventListener("click",()=>{if(0===postsList.children.length)return void displayMessage("No posts to save. Please fetch posts first.","info");let e=new Date,t=e.toLocaleString("en-US",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!0}),s=e.getFullYear()+"-"+(e.getMonth()+1).toString().padStart(2,"0")+"-"+e.getDate().toString().padStart(2,"0"),i=blogUrlOrIdInput.value.trim().replace(/^(https?:\/\/)/,"").replace(/\//g,"-").replace(/\.+/g,"-").replace(/[^a-zA-Z0-9-]/g,"").replace(/^-+|-+$/g,"").substring(0,50);""===i&&(i="unknown-blog");let o=`
        <style>
            /* Base styles for the saved HTML */
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

            /* Light theme defaults (will be applied by default) */
            body {
                background-color: #ffffff;
                color: #333333;
            }
            .post-month-header {
                background-color: #e0f7fa;
                color: #333333;
            }
            .post-item a {
                color: #0056b3;
            }
            .generated-header {
                border: 1px solid #eee;
                background-color: #f9f9f9;
                color: #333;
            }
            .generated-header a {
                color: #0056b3;
            }
            .total-posts-count {
                color: #007bff;
            }


            /* Dark mode overrides using prefers-color-scheme */
            @media (prefers-color-scheme: dark) {
                body {
                    background-color: #1a1a1a;
                    color: #e0e0e0;
                }
                .post-month-header {
                    background-color: #003e4c;
                    color: #e0e0e0;
                }
                .post-item a {
                    color: #92e0ff;
                }
                .generated-header {
                    border: 1px solid #444444;
                    background-color: #2a2a2a;
                    color: #e0e0e0;
                }
                .generated-header a {
                    color: #92e0ff;
                }
                .total-posts-count {
                    color: #92e0ff;
                }
            }
        </style>
    `,a=`
        <div class="generated-header" style="margin-bottom: 20px; padding: 10px; border-radius: 5px;">
            <p style="margin: 0; font-size: 0.9em;">This list of blog posts was generated on **${t}** using the Blogger All Posts Lister.</p>
            <p style="margin: 5px 0 0 0; font-size: 0.9em;">Source Blog: <a href="${blogUrlOrIdInput.value.trim()}" target="_blank" rel="noopener noreferrer">${blogUrlOrIdInput.value.trim()}</a></p>
        </div>
    `,r=`
        <h2 style="font-family: sans-serif;">Posts</h2>
        <div class="total-posts-count" style="font-size: 1.1em; font-weight: bold; margin-bottom: 10px;">${totalPostsCountDiv.textContent}</div>
        <ul style="list-style: none; padding: 0; margin: 0;">
            ${postsList.innerHTML}
        </ul>
    `,n=new Blob([`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Blogger Posts - ${blogUrlOrIdInput.value.trim()} - ${s}</title>
            ${o}
        </head>
        <body>
            ${a}
            ${r}
        </body>
        </html>
    `],{type:"text/html;charset=utf-8"}),l=`${i}-Posts-List-${s}.html`,d=document.createElement("a");d.href=URL.createObjectURL(n),d.download=l,document.body.appendChild(d),d.click(),document.body.removeChild(d),URL.revokeObjectURL(d.href),displayMessage(`List saved as "${l}"`,"success")}),document.addEventListener("DOMContentLoaded",()=>{applyTheme(getInitialThemeChoice()),blogIdFromQueryString=getBlogIdFromQuery();let e=getSavedApiKey();e?apiKeyInput.value=e:displayMessage("Please enter your Google API Key and Blog URL or ID to begin.","info"),apiKeyInput.type="password",toggleApiKeyVisibilityButton.textContent="Show Key",updateButtonStates()}),window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",e=>{localStorage.getItem(THEME_STORAGE_KEY)||applyTheme("device")});
//# sourceMappingURL=AsWebApp.7d5671c0.js.map
