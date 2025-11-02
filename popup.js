
document.addEventListener('DOMContentLoaded', async () => {
    const checkboxes = document.querySelectorAll('.toggle_row input[type="checkbox"]');

    const storageData = await chrome.storage.sync.get({
        watchLaterEnabled: true,
        showAdSkipButton: true,
        autoAdSkip: false
    });

    checkboxes.forEach((checkbox) => {
        const key = checkbox.getAttribute('data-key');
        if (!key) return;

        if (key === 'watchLaterOnHomepage') {
            checkbox.checked = storageData.watchLaterEnabled;
        } else if (key === 'showAdSkipButton') {
            checkbox.checked = storageData.showAdSkipButton;
        } else if (key === 'autoAdSkip') {
            checkbox.checked = storageData.autoAdSkip;
        }

        checkbox.addEventListener('change', () => {
            const isChecked = checkbox.checked;

            if (key === 'watchLaterOnHomepage') {
                chrome.storage.sync.set({ watchLaterEnabled: isChecked });

                chrome.tabs.query({ url: "*://*.youtube.com/*" }, function (tabs) {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, {
                            type: 'WATCH_LATER_TOGGLE',
                            enabled: isChecked
                        }).catch(() => {
                            console.log('Tab not ready yet');
                        });
                    });
                });
            }
            else if (key === 'showAdSkipButton') {
                chrome.storage.sync.set({ showAdSkipButton: isChecked });

                chrome.tabs.query({ url: "*://*.youtube.com/*" }, function (tabs) {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, {
                            feature: 'showAdSkipButton',
                            enabled: isChecked
                        }).catch(() => {
                            console.log('Tab not ready yet');
                        });
                    });
                });
            }
            else if (key === 'autoAdSkip') {
                chrome.storage.sync.set({ autoAdSkip: isChecked });

                chrome.tabs.query({ url: "*://*.youtube.com/*" }, function (tabs) {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, {
                            feature: 'autoAdSkip',
                            enabled: isChecked
                        }).catch(() => {
                            console.log('Tab not ready yet');
                        });
                    });
                });
            }
        });
    });
});
