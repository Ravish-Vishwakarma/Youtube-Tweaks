(async function () {
    let autoSkipEnabled = (await chrome.storage.sync.get({ autoAdSkip: false })).autoAdSkip;

    async function runSkipAdSequence() {
        function getIframe() {
            return document.getElementById('iframe');
        }

        function wait(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        async function retryUntilSuccess(checkFn, interval = 500, timeout = 10000) {
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
                try {
                    if (await checkFn()) {
                        return true;
                    }
                } catch (e) {
                    console.log('Error in check function:', e);
                }
                await wait(interval);
            }
            throw new Error('Timeout');
        }

        function tryClickAdButton() {
            // Check both modern and classic skip buttons first
            const skipButton = document.querySelector('.ytp-ad-skip-button-modern') ||
                document.querySelector('.ytp-ad-skip-button');

            if (skipButton && skipButton.offsetParent !== null) {
                skipButton.click();
                return true;
            }

            // Then try the ad button link
            const adButton = document.querySelector(
                '.ytp-ad-button.ytp-ad-button-link.ytp-ad-clickable.ytp-ad-hover-text-button--clean-player'
            );
            if (adButton) {
                adButton.click();
                return true;
            }
            return false;
        }

        async function getIframeDocument() {
            const iframe = getIframe();
            if (!iframe) return null;
            while (!iframe.contentDocument) {
                await wait(200);
            }
            return iframe.contentDocument;
        }

        async function tryClickBlockButtonInIframe() {
            const doc = await getIframeDocument();
            if (!doc) return false;
            const blockButton = doc.querySelector('button[aria-label="Block"]');
            if (blockButton) {
                blockButton.click();
                return true;
            }
            return false;
        }

        async function tryClickContinueButtonInIframe() {
            const doc = await getIframeDocument();
            if (!doc) return false;
            const continueButton = [...doc.querySelectorAll('div[role="button"]')].find(btn => {
                const span = btn.querySelector('span.RveJvd.snByac');
                return span && span.textContent.trim() === 'CONTINUE' && btn.offsetParent !== null;
            });
            if (continueButton) {
                continueButton.click();
                console.log('Continue button clicked');
                return true;
            }
            return false;
        }

        function tryClickOverlayBackdrop() {
            const overlay = document.querySelector('tp-yt-iron-overlay-backdrop.opened');
            if (overlay) {
                overlay.click();
                return true;
            }
            return false;
        }

        async function runSequence() {
            if (!autoSkipEnabled) return;

            try {
                await wait(500);
                await retryUntilSuccess(tryClickAdButton);
                console.log('Ad button clicked');
                await wait(500);
                await retryUntilSuccess(tryClickBlockButtonInIframe);
                console.log('Block button clicked');
                await wait(500);
                await retryUntilSuccess(tryClickContinueButtonInIframe);
                console.log('Continue button clicked');
                await wait(500);
                await retryUntilSuccess(tryClickOverlayBackdrop);
                console.log('Overlay backdrop clicked');
            } catch (error) {
                console.log('Sequence stopped:', error.message);
            }
        }
        await runSequence();
    }

    let checkInterval;

    function startAutoSkipCheck() {
        if (!checkInterval) {
            // Run the sequence every 2 seconds
            checkInterval = setInterval(runSkipAdSequence, 2000);
        }
    }

    function stopAutoSkipCheck() {
        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }
    }

    if (autoSkipEnabled) {
        startAutoSkipCheck();
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.feature === 'autoAdSkip') {
            autoSkipEnabled = request.enabled;
            if (autoSkipEnabled) {
                startAutoSkipCheck();
            } else {
                stopAutoSkipCheck();
            }
        }
    });

    document.addEventListener('play', function (e) {
        if (e.target.tagName === 'VIDEO' && autoSkipEnabled) {
            startAutoSkipCheck();
        }
    }, true);

    document.addEventListener('pause', function (e) {
        if (e.target.tagName === 'VIDEO') {
            stopAutoSkipCheck();
        }
    }, true);

    if (autoSkipEnabled) {
        startAutoSkipCheck();
    }
})();
