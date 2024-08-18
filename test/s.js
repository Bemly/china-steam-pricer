class TabbableLink extends HTMLAnchorElement {
    connectedCallback() {
        this.addEventListener("click", this.onClick)
    }

    onClick(e) {
        if (e.preventDefault(), this.classList.contains("selected")) return;
        const t = document.getElementById(this.getAttribute("aria-controls"));
        if (window.requestAnimationFrame(() => {
            this.activate(this), this.activate(t), this.dispatchEvent(new Event("tab-shown"));
            const n = this.closest(".tabbable");
            n && e.isTrusted && n.scrollIntoView({block: "start", behavior: "smooth"})
        }), location.pathname === "/search/") return;
        history.replaceState(null, null, this.href);
        const s = document.querySelector('link[rel="canonical"]');
        if (s) {
            const n = new URL(this.href, location.origin);
            s.href = n
        }
    }

    activate(e) {
        const t = e.parentNode.querySelector(".selected");
        t && t.classList.remove("selected"), e.classList.add("selected")
    }
}

customElements.define("tabbable-link", TabbableLink, {extends: "a"});
