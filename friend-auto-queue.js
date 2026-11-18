(function FriendAutoQueue() {
    if (!Spicetify?.showNotification || !Spicetify?.Player || !Spicetify.LocalStorage) {
        setTimeout(FriendAutoQueue, 500);
        return;
    }

    const STORAGE_KEYS = {
        ENABLED: "friend_auto_queue_enabled",
        AUTO_SWITCH: "friend_auto_switch_enabled",
        TARGET: "friend_auto_queue_target"
    };

    let isEnabled = Spicetify.LocalStorage.get(STORAGE_KEYS.ENABLED) === "true";
    let isAutoSwitch = Spicetify.LocalStorage.get(STORAGE_KEYS.AUTO_SWITCH) === "true";
    let targetFriend = Spicetify.LocalStorage.get(STORAGE_KEYS.TARGET) || "";
    let lastProcessedTrackUri = null;

    const ICON_ON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="display:block; filter:none !important;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`;
    const ICON_OFF = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="display:block; filter:none !important;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" opacity="0.4"/></svg>`;

    function getAvailableFriends() {
        const sidebar = document.querySelector('aside[aria-label="Friend Activity"]') || document.body;
        const friendLinks = Array.from(sidebar.querySelectorAll('a[href*="/user/"]'));
        const friends = new Set();
        for (const link of friendLinks) {
            const name = link.textContent.trim();
            if (name) friends.add(name);
        }
        return Array.from(friends);
    }

    function injectUI() {
        if (document.getElementById("faq-native-btn")) return;

        // Anchor to TimeSkip button if present, otherwise fall back to Marketplace
        let anchorElement = document.getElementById("p30-native-btn") || document.querySelector('a[href="/marketplace"]') || document.querySelector('.marketplace-topbar-button');
        if (!anchorElement) {
            const allButtons = document.querySelectorAll('button, a');
            for (let target of allButtons) {
                if (target.textContent.toLowerCase().includes('marketplace') || (target.title && target.title.toLowerCase().includes('marketplace'))) {
                    anchorElement = target;
                    break;
                }
            }
        }

        const parentContainer = anchorElement ? anchorElement.parentElement : (document.querySelector(".main-topBar-container") || document.querySelector("header"));
        if (!parentContainer) {
            setTimeout(injectUI, 500);
            return;
        }

        const btn = document.createElement("button");
        btn.id = "faq-native-btn";
        btn.title = "Friend Auto-Queue & Sync";
        btn.style.cssText = `
            background: transparent !important;
            border: none !important;
            cursor: pointer !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 40px !important;
            height: 40px !important;
            margin-right: 12px !important;
            padding: 0 !important;
            position: relative !important;
            vertical-align: middle !important;
            opacity: 1 !important;
            filter: none !important;
            transition: transform 0.2s ease, color 0.2s ease;
        `;

        const dropdown = document.createElement("div");
        dropdown.id = "faq-native-drop";
        dropdown.style.cssText = `
            display: none;
            position: fixed;
            background: #282828 !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            border-radius: 6px !important;
            padding: 6px !important;
            width: 240px !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6) !important;
            z-index: 999999999 !important;
            flex-direction: column;
            font-family: var(--font-family, sans-serif);
            pointer-events: auto !important;
        `;

        dropdown.innerHTML = `
            <div id="faq-act-toggle" style="display:flex; flex-direction:column; padding:10px; border-radius:4px; cursor:pointer; transition: background 0.2s; pointer-events: auto !important;">
                <div style="display:flex; justify-content:space-between; width:100%; align-items:center; font-size:13px; font-weight:700; color:#ffffff; pointer-events: none;">
                    <span>Auto-Queue</span>
                    <span id="faq-lbl-toggle" style="margin-left:auto;">OFF</span>
                </div>
                <div style="font-size:11px; color:#b3b3b3; font-weight:400; margin-top:3px; opacity:0.6; text-align:left; pointer-events: none;">Automatically queue friend's tracks.</div>
            </div>
            <div style="height:1px; background:rgba(255,255,255,0.06); margin:4px 6px;"></div>
            <div id="faq-act-switch" style="display:flex; flex-direction:column; padding:10px; border-radius:4px; cursor:pointer; transition: background 0.2s; pointer-events: auto !important;">
                <div style="display:flex; justify-content:space-between; width:100%; align-items:center; font-size:13px; font-weight:700; color:#ffffff; pointer-events: none;">
                    <span>Auto-Switch (Sync)</span>
                    <span id="faq-lbl-switch" style="margin-left:auto;">OFF</span>
                </div>
                <div style="font-size:11px; color:#b3b3b3; font-weight:400; margin-top:3px; opacity:0.6; text-align:left; pointer-events: none;">Instantly switch to friend's current song.</div>
            </div>
            <div style="height:1px; background:rgba(255,255,255,0.06); margin:4px 6px;"></div>
            <div id="faq-act-target" style="display:flex; flex-direction:column; padding:10px; border-radius:4px; cursor:pointer; transition: background 0.2s; pointer-events: auto !important;">
                <div style="display:flex; justify-content:space-between; width:100%; align-items:center; font-size:13px; font-weight:700; color:#ffffff; pointer-events: none;">
                    <span>Target Friend</span>
                    <span id="faq-lbl-target" style="margin-left:auto; color:#b3b3b3; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">None</span>
                </div>
                <div style="font-size:11px; color:#b3b3b3; font-weight:400; margin-top:3px; opacity:0.6; text-align:left; pointer-events: none;">Click to pick a friend from sidebar.</div>
            </div>
        `;
        
        document.body.appendChild(dropdown);

        const rows = dropdown.querySelectorAll('#faq-act-toggle, #faq-act-switch, #faq-act-target');
        rows.forEach(row => {
            row.addEventListener('mouseenter', () => row.style.background = 'rgba(255,255,255,0.08)');
            row.addEventListener('mouseleave', () => row.style.background = 'transparent');
        });

        function syncUI() {
            const activeAny = isEnabled || isAutoSwitch;
            btn.innerHTML = activeAny ? ICON_ON : ICON_OFF;
            btn.style.color = activeAny ? "var(--spice-button-active, #1db954)" : "var(--spice-accent, #ffffff)";

            const lblToggle = document.getElementById("faq-lbl-toggle");
            const lblSwitch = document.getElementById("faq-lbl-switch");
            const lblTarget = document.getElementById("faq-lbl-target");
            
            if (lblToggle) {
                lblToggle.textContent = isEnabled ? "ON" : "OFF";
                lblToggle.style.color = isEnabled ? "var(--spice-button-active, #1db954)" : "#b3b3b3";
            }
            if (lblSwitch) {
                lblSwitch.textContent = isAutoSwitch ? "ON" : "OFF";
                lblSwitch.style.color = isAutoSwitch ? "var(--spice-button-active, #1db954)" : "#b3b3b3";
            }
            if (lblTarget) {
                lblTarget.textContent = targetFriend || "None";
                lblTarget.style.color = targetFriend ? "var(--spice-button-active, #1db954)" : "#b3b3b3";
            }
        }

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isHidden = dropdown.style.display !== "flex";
            if (isHidden) {
                const rect = btn.getBoundingClientRect();
                dropdown.style.top = `${rect.bottom + 6}px`;
                dropdown.style.left = `${rect.left}px`;
                dropdown.style.display = "flex";
            } else {
                dropdown.style.display = "none";
            }
        });

        dropdown.querySelector("#faq-act-toggle").addEventListener("click", (e) => {
            e.stopPropagation();
            isEnabled = !isEnabled;
            Spicetify.LocalStorage.set(STORAGE_KEYS.ENABLED, isEnabled);
            syncUI();
            Spicetify.showNotification(`Auto-Queue ${isEnabled ? "Enabled" : "Disabled"}`);
        });

        dropdown.querySelector("#faq-act-switch").addEventListener("click", (e) => {
            e.stopPropagation();
            isAutoSwitch = !isAutoSwitch;
            Spicetify.LocalStorage.set(STORAGE_KEYS.AUTO_SWITCH, isAutoSwitch);
            syncUI();
            Spicetify.showNotification(`Auto-Switch (Sync) ${isAutoSwitch ? "Enabled" : "Disabled"}`);
        });

        dropdown.querySelector("#faq-act-target").addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.style.display = "none";
            const friends = getAvailableFriends();
            if (friends.length === 0) {
                Spicetify.showNotification("No friends visible in sidebar right now!");
                return;
            }
            const promptMsg = "Select a target friend from your sidebar:\n\n" + friends.map((f, i) => `${i + 1}: ${f}`).join("\n") + "\n\nEnter number or exact name:";
            const res = prompt(promptMsg, targetFriend);
            if (res) {
                const trimmed = res.trim();
                const index = parseInt(trimmed) - 1;
                if (!isNaN(index) && friends[index]) {
                    targetFriend = friends[index];
                } else {
                    targetFriend = trimmed;
                }
                Spicetify.LocalStorage.set(STORAGE_KEYS.TARGET, targetFriend);
                syncUI();
                Spicetify.showNotification(`Target friend set to: ${targetFriend}`);
            }
        });

        document.addEventListener("click", () => { dropdown.style.display = "none"; });
        window.addEventListener("resize", () => { dropdown.style.display = "none"; });

        // Insert right after TimeSkip button if available, otherwise before marketplace
        if (anchorElement && anchorElement.id === "p30-native-btn") {
            parentContainer.insertBefore(btn, anchorElement.nextSibling);
        } else if (anchorElement) {
            parentContainer.insertBefore(btn, anchorElement);
        } else {
            parentContainer.appendChild(btn);
        }
        syncUI();
    }

    setInterval(() => {
        if ((!isEnabled && !isAutoSwitch) || !targetFriend) return;

        const sidebar = document.querySelector('aside[aria-label="Friend Activity"]') || document.body;
        const friendLinks = Array.from(sidebar.querySelectorAll('a[href*="/user/"]'));

        for (const link of friendLinks) {
            if (link.textContent.trim() === targetFriend) {
                const row = link.closest('li') || link.parentElement?.parentElement?.parentElement;
                const trackLink = row?.querySelector('a[href*="/track/"]');

                if (trackLink) {
                    const trackId = trackLink.getAttribute('href')?.split('/track/')[1]?.split('?')[0];
                    const trackUri = `spotify:track:${trackId}`;
                    const trackName = trackLink.textContent.trim();

                    if (trackId && trackUri !== lastProcessedTrackUri) {
                        lastProcessedTrackUri = trackUri;

                        if (isAutoSwitch) {
                            Spicetify.Player.playUri(trackUri);
                            Spicetify.showNotification(`Switched to ${targetFriend}'s track: ${trackName}`);
                        } else if (isEnabled) {
                            Spicetify.addToQueue([{ uri: trackUri }]);
                            Spicetify.showNotification(`Queued ${targetFriend}'s song: ${trackName}`);
                        }
                    }
                }
                break;
            }
        }
    }, 3000);

    injectUI();
})();
