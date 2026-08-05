import { ExecutionContextWrapper } from "../context";
import { setupAlwaysLastBubble } from "./alwaysLastBubble";

export function setupAnchorHandler(
	{ self, rpc, client }: ExecutionContextWrapper,
	addAlwaysLastEventListener: ReturnType<typeof setupAlwaysLastBubble>
) {
	// anchors can be reached from more than one place (the observer, the initial sweep,
	// a node being moved around the dom), and registering twice would open two tabs
	const handled = new WeakSet<HTMLAnchorElement>();

	const handleAnchor = (_node: Node) => {
		if (!client.box.instanceof(_node, "HTMLAnchorElement")) return;
		const node = _node as HTMLAnchorElement;
		if (handled.has(node)) return;
		handled.add(node);

		const openInNewTab = () => {
			// note that this is the intercepted version
			const href = node.href;

			rpc.call("newtab", {
				url: href,
			});
		};

		addAlwaysLastEventListener(node, "click", (e: MouseEvent) => {
			if (e.defaultPrevented) return;
			if (e.button !== 0) return; // left click
			if (node.target !== "_blank") return;
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			openInNewTab();
		});

		addAlwaysLastEventListener(node, "auxclick", (e: MouseEvent) => {
			if (e.defaultPrevented) return;
			if (e.button !== 1) return; // middle click
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			openInNewTab();
		});
	};

	// the observer only reports the roots of inserted subtrees, so anything appended in one
	// go (innerHTML, a cloned/parsed fragment, the document we were injected into) has to be
	// walked by hand
	const handleTree = (node: Node) => {
		handleAnchor(node);

		if (
			client.box.instanceof(node, "Element") ||
			client.box.instanceof(node, "Document") ||
			client.box.instanceof(node, "DocumentFragment")
		) {
			(node as Element).querySelectorAll("a").forEach(handleAnchor);
		}
	};

	const anchorObserver = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			// https://issues.chromium.org/issues/440360422
			// setTimeout(() => {
			mutation.addedNodes.forEach(handleTree);
			// }, 2000);
		});
	});
	anchorObserver.observe(self.document, {
		childList: true,
		subtree: true,
	});

	// anchors that were already parsed before we got here are never reported by the observer.
	// sweep now for whatever exists, then again at each readiness milestone to pick up the rest
	// of the parse (this also beats the observer's timeout to the punch for links present on load)
	handleTree(self.document);
	self.document.addEventListener("readystatechange", () =>
		handleTree(self.document)
	);
	self.addEventListener("load", () => handleTree(self.document));
}
