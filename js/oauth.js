document.addEventListener('DOMContentLoaded', function() {
    const observer = new MutationObserver(function() {
        if (document.getElementById('gdrive-oauth-btn')) return;

        const inputs = Array.from(document.querySelectorAll('input'));
        let clientIdInput = null;
        let clientSecretInput = null;
        let tokenInput = null;

        inputs.forEach(input => {
            const text = (input.placeholder || '') + (input.parentElement ? input.parentElement.innerText : '');
            if (text.includes('Client ID')) clientIdInput = input;
            if (text.includes('Client Secret')) clientSecretInput = input;
            if (text.includes('Token')) tokenInput = input;
        });

        if (clientIdInput && clientSecretInput && tokenInput) {
            const btn = document.createElement('button');
            btn.id = 'gdrive-oauth-btn';
            btn.textContent = '🔑 Connect with Google & Get Token';
            btn.className = 'button primary';
            btn.style.marginTop = '15px';
            btn.style.width = '100%';
            btn.style.padding = '10px';
            btn.style.fontWeight = 'bold';
            
            btn.addEventListener('click', async function(e) {
                e.preventDefault();
                if (!clientIdInput.value || !clientSecretInput.value) {
                    alert('Please enter Client ID and Secret first!');
                    return;
                }
                
                btn.textContent = '⌛ Waiting for Google...';
                const redirectUri = window.location.origin + OC.generateUrl('/apps/files_external_gdrive/callback');
                
                localStorage.removeItem('gdrive_oauth_code');
                
                const popup = window.open('about:blank', 'GoogleAuth', 'width=600,height=600');
                
                try {
                    const res = await fetch(OC.generateUrl('/apps/files_external_gdrive/oauth'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'requesttoken': OC.requestToken },
                        body: JSON.stringify({ client_id: clientIdInput.value, step: 1, redirect: redirectUri })
                    });

                    if (!res.ok) {
                        const errText = await res.text();
                        console.error("Server Error on initial fetch:", errText);
                        popup.close();
                        alert("Server Error: 404 or 500. Check F12 Console!");
                        btn.textContent = '❌ Error';
                        return;
                    }

                    const data = await res.json();
                    
                    if (data.status === 'success') {
                        popup.location.href = data.data.url; 
                        let tokenFetched = false;
                        
                        const pollTimer = setInterval(async function() {
                            const storedCode = localStorage.getItem('gdrive_oauth_code');
                            
                            if (storedCode && !tokenFetched) {
                                clearInterval(pollTimer);
                                tokenFetched = true;
                                localStorage.removeItem('gdrive_oauth_code');
                                
                                if (popup && !popup.closed) popup.close();
                                
                                btn.textContent = '🔄 Generating token...';
                                
                                try {
                                    const tokenReq = await fetch(OC.generateUrl('/apps/files_external_gdrive/oauth'), {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', 'requesttoken': OC.requestToken },
                                        body: JSON.stringify({ client_id: clientIdInput.value, client_secret: clientSecretInput.value, step: 2, code: storedCode, redirect: redirectUri })
                                    });
                                    const tokenRes = await tokenReq.json();
                                    
                                    if (tokenRes.status === 'success') {
                                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                                        nativeInputValueSetter.call(tokenInput, tokenRes.data.token);
                                        tokenInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        tokenInput.dispatchEvent(new Event('change', { bubbles: true }));
                                        tokenInput.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
                                        
                                        btn.textContent = '✅ Success! Please click Create!';
                                        btn.style.backgroundColor = '#4caf50';
                                        btn.style.color = 'white';
                                    } else {
                                        alert('Error: Google denied the token!');
                                        btn.textContent = '❌ Error';
                                    }
                                } catch(err) {
                                    console.error("Error fetching token:", err);
                                    btn.textContent = '❌ Error';
                                }
                            }
                            
                            if (popup && popup.closed && !tokenFetched) {
                                clearInterval(pollTimer);
                                if (btn.textContent === '⌛ Waiting for Google...') btn.textContent = '❌ Cancelled. Try again?';
                            }
                        }, 500);
                    } else {
                        popup.close();
                        alert("Unknown Server Error");
                    }
                } catch (err) {
                    console.error("Network Error:", err);
                    popup.close();
                    btn.textContent = '❌ Network Error';
                }
            });
            tokenInput.parentElement.appendChild(btn);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
});