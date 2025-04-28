// public/chat.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Get Elements ---
    const chatbox = document.getElementById('chatbox');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const loadingIndicator = document.getElementById('loading'); // "typing..." below input
    const phonePromptOverlay = document.getElementById('phone-prompt-overlay');
    const phoneInput = document.getElementById('phone-input');
    const submitPhoneButton = document.getElementById('submit-phone-button');
    const appContainer = document.getElementById('app-container');
    // Header elements
    const botStatusElement = document.getElementById('bot-status');
    const headerMenuButton = document.getElementById('header-menu-button');
    const headerMenu = document.getElementById('header-menu');
    const clearChatButton = document.getElementById('clear-chat-button');
    const resetChatButton = document.getElementById('reset-chat-button');
    const changeNumberButton = document.getElementById('change-number-button');

    const API_URL = '/api/chat';
    let USER_ID = null;
    let lastSentUserMessageInfo = { element: null, id: null }; // Tracks the container element and potential ID

    // --- Formatting Parser ---
    function parseWhatsAppFormatting(text) {
        if (typeof text !== 'string') return '';
        let escapedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        escapedText = escapedText.replace(/```([\s\S]*?)```/g, (match, p1) => `<pre>${p1.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`);
        const lines = escapedText.split('\n');
        let inBlock = null; const processedLines = [];
        lines.forEach(line => {
            let currentLine = line; let lineAdded = false;
            const preStartMatch = /<pre>/.test(currentLine); const preEndMatch = /<\/pre>/.test(currentLine);
            if (preStartMatch && !preEndMatch) inBlock = 'pre';
            if (inBlock === 'pre') { processedLines.push(currentLine); if (preEndMatch) inBlock = null; return; }
            const quoteMatch = currentLine.startsWith('&gt; '); const ulMatch = currentLine.trim().match(/^(\*|-)\s+/); const olMatch = currentLine.trim().match(/^(\d+)\.\s+/);
            if (inBlock === 'quote' && !quoteMatch) { processedLines.push('</blockquote>'); inBlock = null; } if (inBlock === 'ul' && !ulMatch) { processedLines.push('</ul>'); inBlock = null; } if (inBlock === 'ol' && !olMatch) { processedLines.push('</ol>'); inBlock = null; }
            if (quoteMatch) { if (inBlock !== 'quote') { processedLines.push('<blockquote>'); inBlock = 'quote'; } processedLines.push(currentLine.substring(4)); lineAdded = true; }
            else if (ulMatch) { if (inBlock !== 'ul') { processedLines.push('<ul>'); inBlock = 'ul'; } processedLines.push(`<li>${currentLine.replace(/^(\*|-)\s+/, '').trim()}</li>`); lineAdded = true; }
            else if (olMatch) { if (inBlock !== 'ol') { processedLines.push('<ol>'); inBlock = 'ol'; } processedLines.push(`<li>${currentLine.replace(/^\d+\.\s+/, '').trim()}</li>`); lineAdded = true; }
            if (!lineAdded) { processedLines.push(currentLine); }
        });
        if (inBlock === 'quote') processedLines.push('</blockquote>'); if (inBlock === 'ul') processedLines.push('</ul>'); if (inBlock === 'ol') processedLines.push('</ol>');
        escapedText = processedLines.join('\n');
        escapedText = escapedText.replace(/(?<!\\|`|<code>|<pre>|&lt;)``([^`\n]+?)`(?!`|<\/code>|<\/pre>|&gt;)/g, '<code>$1</code>');
        escapedText = escapedText.replace(/(?<!\\|\*|<strong>|<em>|<pre>|<code>|&lt;)\*([^\*\n<]+?)\*(?!\*|<\/strong>|<\/em>|<\/pre>|<\/code>|&gt;)/g, '<strong>$1</strong>');
        escapedText = escapedText.replace(/(?<!\\|_|<em>|<strong>|<pre>|<code>|&lt;)_([^\_\n<]+?)_(?!_|<\/em>|<\/strong>|<\/pre>|<\/code>|&gt;)/g, '<em>$1</em>');
        escapedText = escapedText.replace(/(?<!\\|~|<del>|<pre>|<code>|&lt;)~([^~\n<]+?)~(?!\~|<\/del>|<\/pre>|<\/code>|&gt;)/g, '<del>$1</del>');
        escapedText = escapedText.replace(/\n/g, '<br>');
        escapedText = escapedText.replace(/<\/li><br>/g, '</li>').replace(/<\/blockquote><br>/g, '</blockquote>').replace(/<\/ul><br>/g, '</ul>').replace(/<\/ol><br>/g, '</ol>').replace(/<\/pre><br>/g, '</pre>');
        escapedText = escapedText.replace(/^<br>|<br>$/g, '');
        return escapedText;
    }

    // --- Core Functions ---

    function addMessage(sender, text, direction, messageId = null) {
        const messageContainer = document.createElement('div');
        messageContainer.classList.add('message-container', direction === 'inbound' ? 'user' : 'bot');
        if (messageId) messageContainer.dataset.messageId = messageId;

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(direction === 'inbound' ? 'user' : 'bot');

        const contentSpan = document.createElement('span');
        contentSpan.classList.add('message-content');
        contentSpan.innerHTML = parseWhatsAppFormatting(text);
        messageDiv.appendChild(contentSpan);

        if (direction === 'inbound') {
            const metaArea = document.createElement('div');
            metaArea.classList.add('message-meta-area');
            const timestampSpan = document.createElement('span');
            timestampSpan.classList.add('timestamp');
            timestampSpan.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); // Use consistent time format
            metaArea.appendChild(timestampSpan);
            const ticksSpan = document.createElement('span');
            ticksSpan.classList.add('ticks', 'single-grey');
            if (messageId) ticksSpan.dataset.messageId = messageId;
            metaArea.appendChild(ticksSpan);
            messageDiv.appendChild(metaArea);

            if (messageId) { // Only add delete button if message has an ID (from history)
                const deleteBtn = document.createElement('button');
                deleteBtn.classList.add('delete-button');
                deleteBtn.innerHTML = '&times;';
                deleteBtn.title = 'Delete message';
                messageDiv.appendChild(deleteBtn);
            }
            // Track the container element just added by the user
            lastSentUserMessageInfo = { element: messageContainer, id: messageId };
        }

        messageContainer.appendChild(messageDiv);
        chatbox.appendChild(messageContainer);
        scrollToBottom();
        return messageContainer; // Return the container element
    }

    function scrollToBottom() {
        setTimeout(() => { chatbox.scrollTop = chatbox.scrollHeight; }, 50);
    }

    // Updated showLoading to control header status
    function showLoading(show) {
        loadingIndicator.style.display = show ? 'block' : 'none'; // Show "typing..." below input
        if (botStatusElement) { // Check if element exists
            botStatusElement.textContent = show ? 'typing...' : 'online';
        }
        sendButton.disabled = show;
        // messageInput.disabled = show; // Keep input enabled
        if (!show && messageInput) messageInput.focus(); // Check if messageInput exists
    }

    async function fetchHistoryAndDisplay(userId) {
        if (!userId) return;
        try {
            const response = await fetch(`${API_URL}/history?userId=${userId}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const history = await response.json();
            if (chatbox) chatbox.innerHTML = ''; // Clear only if chatbox exists
            history.forEach(msg => {
                addMessage(
                    msg.direction === 'inbound' ? 'You' : 'Bot',
                    msg.message,
                    msg.direction,
                    msg._id // Pass message ID
                );
            });
        } catch (error) {
            console.error("Error fetching chat history:", error);
            if (chatbox) chatbox.innerHTML = '';
            addMessage('System', 'Could not load chat history.', 'outbound');
        }
    }

    async function startSession(userId) {
        if (!userId) return;
        showLoading(true);
        if (chatbox) chatbox.innerHTML = '';
        try {
            await fetchHistoryAndDisplay(userId); // Fetch history first
            const startUrl = `${API_URL}/start?userId=${userId}`;
            const response = await fetch(startUrl);
            if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(errorData.error || `HTTP error! status: ${response.status}`); }
            const data = await response.json();
            // Display initial prompts only if received from backend
            if (data.initialReplies && data.initialReplies.length > 0) {
                data.initialReplies.forEach(reply => addMessage('Bot', reply, 'outbound'));
            }
        } catch (error) {
            console.error("Error starting session:", error);
            addMessage('System', `Error starting session: ${error.message}`, 'outbound');
        } finally {
            showLoading(false);
        }
    }

    async function sendMessage() {
        if (!messageInput || !USER_ID) return; // Add check for messageInput
        const messageText = messageInput.value.trim();
        if (!messageText) return;

        // Add user message and store the container element reference
        const currentSentMessageContainer = addMessage('You', messageText, 'inbound', null);
        // lastSentUserMessageInfo is now set within addMessage

        messageInput.value = '';
        showLoading(true);

        try {
            const response = await fetch(`${API_URL}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: messageText, userId: USER_ID }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ replies: ['Unknown server error'] }));
                throw new Error(errorData.replies ? errorData.replies.join(' ') : `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Update Ticks and Add Delete Button/ID for the just-sent message
            if (currentSentMessageContainer) {
                const ticksElement = currentSentMessageContainer.querySelector('.ticks');
                // Update ticks if request succeeded (reply or ID received)
                if (ticksElement && (data.replies?.length > 0 || data.inboundMessageId)) {
                    ticksElement.classList.remove('single-grey');
                    ticksElement.classList.add('double-blue');
                }

                // Add ID and delete button if provided by backend
                if (data.inboundMessageId) {
                    currentSentMessageContainer.dataset.messageId = data.inboundMessageId;
                    if (ticksElement) ticksElement.dataset.messageId = data.inboundMessageId;
                    const messageDiv = currentSentMessageContainer.querySelector('.message');
                    if (messageDiv && !messageDiv.querySelector('.delete-button')) {
                        const deleteBtn = document.createElement('button');
                        deleteBtn.classList.add('delete-button');
                        deleteBtn.innerHTML = '&times;';
                        deleteBtn.title = 'Delete message';
                        messageDiv.appendChild(deleteBtn);
                    }
                }
            }

            // Display replies
            if (data.replies && data.replies.length > 0) {
                data.replies.forEach(reply => addMessage('Bot', reply, 'outbound'));
            }
            // No need for "No reply received" message if ticks updated correctly

        } catch (error) {
            console.error("Error sending message:", error);
            addMessage('System', `Error: ${error.message}`, 'outbound');
            // Revert tick on error
            if (currentSentMessageContainer) {
                const ticksElement = currentSentMessageContainer.querySelector('.ticks');
                if (ticksElement) {
                    ticksElement.classList.remove('double-blue');
                    ticksElement.classList.add('single-grey');
                }
            }
        } finally {
            showLoading(false);
        }
    }

    // --- Delete Logic ---
    async function handleDelete(messageId) {
        if (!messageId || !USER_ID || !confirm('Are you sure you want to delete this message?')) return;
        const messageContainer = chatbox.querySelector(`.message-container[data-message-id="${messageId}"]`);
        const deleteButton = messageContainer ? messageContainer.querySelector('.delete-button') : null;
        if (deleteButton) deleteButton.disabled = true;

        try {
            const response = await fetch(`${API_URL}/message/${messageId}?userId=${USER_ID}`, { method: 'DELETE' });
            if (!response.ok) { const errorData = await response.json().catch(() => ({ error: 'Failed to delete' })); throw new Error(errorData.error || `HTTP error! Status: ${response.status}`); }
            if (messageContainer) messageContainer.remove();
            console.log(`Message ${messageId} deleted from view.`);
        } catch (error) { console.error("Error deleting message:", error); alert(`Could not delete message: ${error.message}`); if (deleteButton) deleteButton.disabled = false; }
    }

    // --- Phone Prompt Logic ---
    function handlePhoneSubmit() {
        if (!phoneInput) return;
        const phoneNumber = phoneInput.value.trim();
        if (/^\+\d{10,}$/.test(phoneNumber)) {
            USER_ID = phoneNumber;
            localStorage.setItem('chatScreenUserId', USER_ID);
            if (phonePromptOverlay) phonePromptOverlay.style.display = 'none';
            if (appContainer) appContainer.classList.remove('hidden');
            startSession(USER_ID);
        } else {
            alert('Please enter a valid phone number including country code (e.g., +91xxxxxxxxxx).');
        }
    }

    // --- Header Menu Logic ---
    function toggleHeaderMenu() {
        if (headerMenu) { // Check if menu exists
            headerMenu.style.display = (headerMenu.style.display === 'block') ? 'none' : 'block';
        }
    }

    function clearChat() {
        if (confirm('Are you sure you want to clear all messages in this chat?')) {
            if (chatbox) chatbox.innerHTML = '';
            if (headerMenu) headerMenu.style.display = 'none';
            console.log("Chat cleared.");
        }
    }

    function changeNumber() {
        if (confirm('Are you sure you want to change your phone number? This will reset the current chat session.')) {
            localStorage.removeItem('chatScreenUserId');
            USER_ID = null;
            if (chatbox) chatbox.innerHTML = '';
            if (appContainer) appContainer.classList.add('hidden');
            if (phonePromptOverlay) phonePromptOverlay.style.display = 'flex';
            if (headerMenu) headerMenu.style.display = 'none';
            if (phoneInput) { phoneInput.value = ''; phoneInput.focus(); }
            console.log("Number changed, showing prompt.");
        }
    }

    function resetChat() {
        if (confirm('Are you sure you want to reset the chat? This will clear all messages and require you to enter your phone number again.')) {
            localStorage.removeItem('chatScreenUserId');
            if (headerMenu) headerMenu.style.display = 'none';
            window.location.reload();
        }
    }

    // --- Event Listeners ---
    // Add checks to ensure elements exist before adding listeners
    if (sendButton) sendButton.addEventListener('click', sendMessage);
    if (messageInput) messageInput.addEventListener('keypress', (event) => { if (event.key === 'Enter' && !sendButton?.disabled) sendMessage(); });
    if (submitPhoneButton) submitPhoneButton.addEventListener('click', handlePhoneSubmit);
    if (phoneInput) phoneInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') handlePhoneSubmit(); });

    if (chatbox) {
        chatbox.addEventListener('click', (event) => {
            if (event.target.classList.contains('delete-button')) {
                const messageContainer = event.target.closest('.message-container');
                const messageId = messageContainer?.dataset.messageId;
                if (messageId) handleDelete(messageId);
            }
        });
    }

    if (headerMenuButton) headerMenuButton.addEventListener('click', toggleHeaderMenu);
    if (clearChatButton) clearChatButton.addEventListener('click', clearChat);
    if (resetChatButton) resetChatButton.addEventListener('click', resetChat);
    if (changeNumberButton) changeNumberButton.addEventListener('click', changeNumber);

    document.addEventListener('click', (event) => {
        if (headerMenu && headerMenuButton && !headerMenu.contains(event.target) && !headerMenuButton.contains(event.target)) {
            headerMenu.style.display = 'none';
        }
    });

    // --- Initial Load ---
    const storedPhone = localStorage.getItem('chatScreenUserId');
    if (storedPhone && /^\+\d{10,}$/.test(storedPhone)) {
        USER_ID = storedPhone;
        if (phonePromptOverlay) phonePromptOverlay.style.display = 'none';
        if (appContainer) appContainer.classList.remove('hidden');
        startSession(USER_ID);
    } else {
        if (phonePromptOverlay) phonePromptOverlay.style.display = 'flex';
        if (appContainer) appContainer.classList.add('hidden');
        if (phoneInput) phoneInput.focus();
    }
});