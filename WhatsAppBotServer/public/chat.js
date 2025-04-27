// public/chat.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Get Elements ---
    const chatbox = document.getElementById('chatbox');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const loadingIndicator = document.getElementById('loading');
    const phonePromptOverlay = document.getElementById('phone-prompt-overlay');
    const phoneInput = document.getElementById('phone-input');
    const submitPhoneButton = document.getElementById('submit-phone-button');
    const appContainer = document.getElementById('app-container');

    const API_URL = '/api/chat';
    let USER_ID = null;
    let lastInboundMessageContainer = null; // To track the last user message for ticks

    // --- Formatting Parser ---
    function parseWhatsAppFormatting(text) {
        if (typeof text !== 'string') return '';
        let escapedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Monospace Block (```text```) - Process first, re-escape content inside
        escapedText = escapedText.replace(/```([\s\S]*?)```/g, (match, p1) =>
            `<pre>${p1.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`
        );

        const lines = escapedText.split('\n');
        let inBlock = null; // null, 'quote', 'ul', 'ol', 'pre'
        const processedLines = [];

        lines.forEach(line => {
            let currentLine = line;
            let lineAdded = false;

            // Check if inside a pre block (simple check, might fail with nested pre)
             const preStartMatch = /<pre>/.test(currentLine);
             const preEndMatch = /<\/pre>/.test(currentLine);
             if (preStartMatch && !preEndMatch) inBlock = 'pre'; // Enter pre block
             if (inBlock === 'pre') {
                 processedLines.push(currentLine);
                 if (preEndMatch) inBlock = null; // Exit pre block
                 return;
             }

            // Check for other block starters
            const quoteMatch = currentLine.startsWith('&gt; ');
            const ulMatch = currentLine.trim().match(/^(\*|-)\s+/);
            const olMatch = currentLine.trim().match(/^(\d+)\.\s+/);

            // Close previous blocks if type changes or line is not part of it
            if (inBlock === 'quote' && !quoteMatch) { processedLines.push('</blockquote>'); inBlock = null; }
            if (inBlock === 'ul' && !ulMatch) { processedLines.push('</ul>'); inBlock = null; }
            if (inBlock === 'ol' && !olMatch) { processedLines.push('</ol>'); inBlock = null; }

            // Handle Block Elements
            if (quoteMatch) {
                if (inBlock !== 'quote') { processedLines.push('<blockquote>'); inBlock = 'quote'; }
                processedLines.push(currentLine.substring(4)); // Add content without marker
                lineAdded = true;
            } else if (ulMatch) {
                if (inBlock !== 'ul') { processedLines.push('<ul>'); inBlock = 'ul'; }
                processedLines.push(`<li>${currentLine.replace(/^(\*|-)\s+/, '').trim()}</li>`);
                lineAdded = true;
            } else if (olMatch) {
                if (inBlock !== 'ol') { processedLines.push('<ol>'); inBlock = 'ol'; }
                processedLines.push(`<li>${currentLine.replace(/^\d+\.\s+/, '').trim()}</li>`);
                lineAdded = true;
            }

            if (!lineAdded) {
                processedLines.push(currentLine); // Add line if not processed as block item
            }
        });

        // Close any remaining open blocks
        if (inBlock === 'quote') processedLines.push('</blockquote>');
        if (inBlock === 'ul') processedLines.push('</ul>');
        if (inBlock === 'ol') processedLines.push('</ol>');

        escapedText = processedLines.join('\n'); // Join lines back with newline for inline processing

        // --- Inline Elements (Apply after blocks) ---
        // Regex needs to be careful about HTML tags and entities. Using negative lookarounds helps.
        // Order: code -> bold/italic/strike
        escapedText = escapedText.replace(/(?<!\\|`|<code>|<pre>|&lt;)``([^`\n]+?)`(?!`|<\/code>|<\/pre>|&gt;)/g, '<code>$1</code>'); // Inline Code `code`
        escapedText = escapedText.replace(/(?<!\\|\*|<strong>|<em>|<pre>|<code>|&lt;)\*([^\*\n<]+?)\*(?!\*|<\/strong>|<\/em>|<\/pre>|<\/code>|&gt;)/g, '<strong>$1</strong>'); // Bold *bold*
        escapedText = escapedText.replace(/(?<!\\|_|<em>|<strong>|<pre>|<code>|&lt;)_([^\_\n<]+?)_(?!_|<\/em>|<\/strong>|<\/pre>|<\/code>|&gt;)/g, '<em>$1</em>'); // Italic _italic_
        escapedText = escapedText.replace(/(?<!\\|~|<del>|<pre>|<code>|&lt;)~([^~\n<]+?)~(?!\~|<\/del>|<\/pre>|<\/code>|&gt;)/g, '<del>$1</del>'); // Strikethrough ~strike~

        // Replace actual newlines with <br> for final HTML rendering
        escapedText = escapedText.replace(/\n/g, '<br>');

        // Cleanup potentially broken tags from joining lines (redundant if using \n then replacing with <br>)
        escapedText = escapedText.replace(/<\/li><br>/g, '</li>');
        escapedText = escapedText.replace(/<\/blockquote><br>/g, '</blockquote>');
        escapedText = escapedText.replace(/<\/ul><br>/g, '</ul>');
        escapedText = escapedText.replace(/<\/ol><br>/g, '</ol>');
        escapedText = escapedText.replace(/<\/pre><br>/g, '</pre>');
        escapedText = escapedText.replace(/^<br>|<br>$/g, ''); // Remove leading/trailing breaks


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
        // Use the parser to set innerHTML
        messageDiv.innerHTML = parseWhatsAppFormatting(text);

        // Add Meta Area (Timestamp & Ticks) for user messages
        if (direction === 'inbound') {
            const metaArea = document.createElement('div');
            metaArea.classList.add('message-meta-area');

            const timestampSpan = document.createElement('span');
            timestampSpan.classList.add('timestamp');
            timestampSpan.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            metaArea.appendChild(timestampSpan);

            const ticksSpan = document.createElement('span');
            ticksSpan.classList.add('ticks', 'single-grey'); // Start with single grey
            if (messageId) ticksSpan.dataset.messageId = messageId; // Link ticks to message ID
            metaArea.appendChild(ticksSpan);
            messageDiv.appendChild(metaArea); // Append meta area

             // Add delete button only if messageId exists (loaded from history)
             if (messageId) {
                const deleteBtn = document.createElement('button');
                deleteBtn.classList.add('delete-button');
                deleteBtn.innerHTML = '&times;'; // 'x' symbol
                deleteBtn.title = 'Delete message';
                // Event listener is handled by delegation on chatbox
                messageDiv.appendChild(deleteBtn);
            }
            // Track the container for the last message sent by the user
            lastInboundMessageContainer = messageContainer;
        } else {
             // Add padding to bot messages as well to align heights visually if needed
             const botMetaPlaceholder = document.createElement('div');
             botMetaPlaceholder.style.height = '16px'; // Reserve space similar to meta area
             messageDiv.appendChild(botMetaPlaceholder);
         }

        messageContainer.appendChild(messageDiv);
        chatbox.appendChild(messageContainer);
        scrollToBottom();
    }


    function scrollToBottom() {
        setTimeout(() => { chatbox.scrollTop = chatbox.scrollHeight; }, 50);
    }

    function showLoading(show) {
        loadingIndicator.style.display = show ? 'block' : 'none';
        sendButton.disabled = show;
        // messageInput.disabled = show; // Keep input enabled
        if (!show) messageInput.focus();
    }

    async function fetchHistoryAndDisplay(userId) {
        if (!userId) return;
        try {
            const response = await fetch(`${API_URL}/history?userId=${userId}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const history = await response.json();
             chatbox.innerHTML = ''; // Clear before adding history
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
             chatbox.innerHTML = ''; // Clear on error too
            addMessage('System', 'Could not load chat history.', 'outbound');
        }
    }

    async function startSession(userId) {
        if (!userId) return;
        showLoading(true);
        chatbox.innerHTML = ''; // Clear chatbox immediately
        try {
            // Fetch history first
             await fetchHistoryAndDisplay(userId);

            // Then call /start to get potential initial prompts if needed
            const startUrl = `${API_URL}/start?userId=${userId}`;
            const response = await fetch(startUrl);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Only display initialReplies if the backend sent any
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
        const messageText = messageInput.value.trim();
        if (!messageText || !USER_ID) return;

        // Add user message visually (ID is null, no delete button yet)
        addMessage('You', messageText, 'inbound', null);
        const currentSentMessageContainer = lastInboundMessageContainer; // Capture ref to the container just added

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

            // Update Ticks and potentially add ID/Delete Btn to the sent message container
            if (currentSentMessageContainer) {
                const ticksElement = currentSentMessageContainer.querySelector('.ticks');
                 // Update ticks only if reply received or processing confirmed
                if (ticksElement && (data.replies && data.replies.length > 0 || data.inboundMessageId)) {
                     ticksElement.classList.remove('single-grey');
                     ticksElement.classList.add('double-blue');
                }

                // If backend returns the ID of the message we just saved, add it
                if (data.inboundMessageId) {
                    currentSentMessageContainer.dataset.messageId = data.inboundMessageId;
                     if(ticksElement) ticksElement.dataset.messageId = data.inboundMessageId;

                    // Add delete button now that we have an ID
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
             // Optionally handle the case of no specific reply but successful processing

        } catch (error) {
            console.error("Error sending message:", error);
            addMessage('System', `Error: ${error.message}`, 'outbound');
             // Revert tick on error for the specific message container
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
        console.log(`Requesting delete for message: ${messageId}`);
        const messageContainer = chatbox.querySelector(`.message-container[data-message-id="${messageId}"]`);
        const deleteButton = messageContainer ? messageContainer.querySelector('.delete-button') : null;
        if(deleteButton) deleteButton.disabled = true; // Disable button during API call

        try {
            const response = await fetch(`${API_URL}/message/${messageId}?userId=${USER_ID}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to delete' }));
                throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
            }
            if (messageContainer) messageContainer.remove(); // Remove from DOM
            console.log(`Message ${messageId} deleted from view.`);
        } catch (error) {
            console.error("Error deleting message:", error);
            alert(`Could not delete message: ${error.message}`);
            if(deleteButton) deleteButton.disabled = false; // Re-enable button on error
        }
    }

    // --- Phone Prompt Logic ---
    function handlePhoneSubmit() {
        const phoneNumber = phoneInput.value.trim();
        if (/^\+\d{10,}$/.test(phoneNumber)) { // Basic validation
            USER_ID = phoneNumber;
            localStorage.setItem('chatScreenUserId', USER_ID);
            phonePromptOverlay.style.display = 'none';
            appContainer.classList.remove('hidden');
            startSession(USER_ID);
        } else {
            alert('Please enter a valid phone number including country code (e.g., +91xxxxxxxxxx).');
        }
    }

    // --- Event Listeners ---
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (event) => { if (event.key === 'Enter' && !sendButton.disabled) sendMessage(); });
    submitPhoneButton.addEventListener('click', handlePhoneSubmit);
    phoneInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') handlePhoneSubmit(); });

    // Delete listener using event delegation
    chatbox.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-button')) {
            const messageContainer = event.target.closest('.message-container');
            const messageId = messageContainer ? messageContainer.dataset.messageId : null;
            if (messageId) handleDelete(messageId);
        }
    });

    // --- Initial Load ---
    const storedPhone = localStorage.getItem('chatScreenUserId');
    if (storedPhone && /^\+\d{10,}$/.test(storedPhone)) {
        USER_ID = storedPhone;
        phonePromptOverlay.style.display = 'none';
        appContainer.classList.remove('hidden');
        startSession(USER_ID);
    } else {
        phonePromptOverlay.style.display = 'flex';
        appContainer.classList.add('hidden');
        phoneInput.focus();
    }
});