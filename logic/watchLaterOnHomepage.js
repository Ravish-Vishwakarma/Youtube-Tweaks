(async function () {
    const WATCH_LATER_URL = "https://www.youtube.com/playlist?list=WL";
    const CONTAINER_ID = "watch-later-extension";
    let injectedOnce = false;

    function isHomepage() {
        return location.hostname === "www.youtube.com" &&
            (location.pathname === "/" || location.pathname === "");
    }

    async function fetchWatchLaterIds() {
        try {
            const res = await fetch(WATCH_LATER_URL, { credentials: "include" });
            const text = await res.text();
            const match = text.match(/var ytInitialData = (.*?);<\/script>/);
            if (!match || match.length < 2) return [];

            const ytData = JSON.parse(match[1]);
            const items = ytData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
                ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]
                ?.playlistVideoListRenderer?.contents || [];

            const ids = items
                .map(item => item?.playlistVideoRenderer?.videoId)
                .filter(Boolean);

            return [...new Set(ids)];
        } catch (err) {
            console.error("Error fetching Watch Later:", err);
            return [];
        }
    }

    function createIframe(id) {
        const iframe = document.createElement("iframe");
        iframe.width = "510";
        iframe.height = "285";
        iframe.src = `https://www.youtube.com/embed/${id}`;
        iframe.style.margin = "8px";
        iframe.style.borderRadius = "12px";
        iframe.style.border = "none";
        iframe.setAttribute("allowfullscreen", "true");
        return iframe;
    }

    async function waitForGrid() {
        return new Promise((resolve) => {
            const interval = setInterval(() => {
                const grid = document.querySelector("ytd-rich-grid-renderer #contents");
                if (grid) {
                    clearInterval(interval);
                    resolve(grid);
                }
            }, 200);
        });
    }

    async function injectWatchLaterVideos() {
        if (!isHomepage()) return;
        if (injectedOnce) return;
        injectedOnce = true;

        const { watchLaterEnabled } = await chrome.storage.sync.get({ watchLaterEnabled: true });
        if (!watchLaterEnabled) return;

        const grid = await waitForGrid();
        if (!grid) return;

        const existing = document.getElementById(CONTAINER_ID);
        if (existing) existing.remove();

        const ids = await fetchWatchLaterIds();
        if (!ids.length) return;

        const container = document.createElement("div");
        container.id = CONTAINER_ID;
        container.style.margin = "20px";
        container.style.padding = "10px";
        container.style.background = "#111";
        container.style.borderRadius = "12px";
        container.style.display = "flex";
        container.style.flexWrap = "wrap";
        container.style.justifyContent = "start";

        const title = document.createElement("h2");
        title.textContent = "Your Watch Later";
        title.style.color = "white";
        title.style.width = "100%";
        title.style.marginBottom = "10px";
        title.style.textAlign = "center";
        title.style.fontSize = "22px";
        title.style.fontWeight = "600";
        container.appendChild(title);

        ids.slice(0, 12).forEach(id => {
            const iframe = createIframe(id);
            container.appendChild(iframe);
        });

        const chipsSection = document.querySelector("ytd-feed-filter-chip-bar-renderer")?.parentElement;
        if (chipsSection) {
            chipsSection.parentElement.insertBefore(container, chipsSection);
        } else {
            grid.prepend(container);
        }
    }

    function observeYouTubeNavigation() {
        let lastUrl = location.href;

        const onUrlChange = () => {
            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                injectedOnce = false;
                if (isHomepage()) {
                    setTimeout(injectWatchLaterVideos, 1000);
                }
            }
        };

        new MutationObserver(onUrlChange).observe(document.body, {
            childList: true,
            subtree: true
        });

        window.addEventListener("yt-navigate-finish", () => {
            injectedOnce = false;
            if (isHomepage()) {
                setTimeout(injectWatchLaterVideos, 1000);
            }
        });

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.type === 'WATCH_LATER_TOGGLE') {
                injectedOnce = false;
                if (request.enabled) {
                    injectWatchLaterVideos();
                } else {
                    const container = document.getElementById(CONTAINER_ID);
                    if (container) container.remove();
                }
            }
        });
    }

    if (isHomepage()) {
        setTimeout(injectWatchLaterVideos, 1000);
    }

    observeYouTubeNavigation();
})();