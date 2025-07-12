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
            if (await checkFn()) {
                return true;
            }
            await wait(interval);
        }
        throw new Error('Timeout');
    }

    function tryClickAdButton() {
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

function insertSkipButton() {
    const buttonContainer = document.querySelector('#top-level-buttons-computed');
    if (!buttonContainer) {
        console.log('Button container not found yet.');
        return false;
    }
    if (document.querySelector('#skip-ad-button')) {
        return true;
    }
    const btn = document.createElement('button');
    btn.id = 'skip-ad-button';
    btn.setAttribute('aria-label', 'Skip Ad');
    btn.style.width = '40px';
    btn.style.height = '40px';
    btn.style.borderRadius = '50%';
    btn.style.background = 'rgba(50, 50, 50, 0.6)';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.marginLeft = '8px';
    btn.style.padding = '0';
    btn.style.backdropFilter = 'blur(4px)';
    btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="white" viewBox="0 0 24 24" focusable="false">
        <path d="M4 4v16l12-8zM16 4v16h2V4z"/>
    </svg>
    `;
    btn.title = 'Skip Ad';
    btn.onclick = () => {
        console.log('Skip Ad button clicked!');
        runSkipAdSequence();
    };
    buttonContainer.appendChild(btn);
    console.log('Skip Ad button inserted.');
}

let lastUrl = location.href;
let featureEnabled = false;
let observer;

function enableFeature() {
    let insertAttempts = 0;
    const maxAttempts = 10;

    function tryInsertButton() {
        if (insertAttempts >= maxAttempts) return;
        insertAttempts++;

        if (location.href.includes('watch')) {
            const inserted = insertSkipButton();
            if (!inserted && insertAttempts < maxAttempts) {
                setTimeout(tryInsertButton, 1000);
            }
        }
    }

    if (location.href.includes('watch')) {
        tryInsertButton();
    }

    observer = new MutationObserver((mutations) => {
        const hasUrlChanged = location.href !== lastUrl;
        const hasRelevantDOMChange = mutations.some(mutation =>
            mutation.target.id === 'top-level-buttons-computed' ||
            mutation.target.id === 'content' ||
            mutation.target.id === 'page-manager'
        );

        if (hasUrlChanged || hasRelevantDOMChange) {
            lastUrl = location.href;
            insertAttempts = 0;
            if (location.href.includes('watch')) {
                tryInsertButton();
            }
        }
    });

    observer.observe(document, {
        subtree: true,
        childList: true,
        attributes: false,
        characterData: false
    });
}

function disableFeature() {
    const btn = document.querySelector('#skip-ad-button');
    if (btn) btn.remove();
    if (observer) {
        observer.disconnect();
        observer = null;
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.feature === 'showAdSkipButton') {
        featureEnabled = message.enabled;
        if (featureEnabled) {
            enableFeature();
        } else {
            disableFeature();
        }
    }
});

function initialize() {
    chrome.storage.sync.get(['showAdSkipButton'], (result) => {
        featureEnabled = result.showAdSkipButton ?? true;
        if (featureEnabled) {
            enableFeature();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}