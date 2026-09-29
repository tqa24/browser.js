import { css, type FC } from "dreamland/core";
import { defaultFaviconUrl } from "../assets/favicon";
import { faviconService } from "..";

export function Favicon(
	this: FC<
		{
			iconUrl?: string | null;
			domain?: string | null;
			size?: "small" | "medium" | "large" | "unset";
		},
		{
			url: string | undefined;
		}
	>
) {
	this.size ||= "small";

	// incremented whenever the source changes so stale fetches are ignored
	let generation = 0;

	const setUrl = (url: string) => {
		if (this.url !== url) this.url = url;
	};

	const loadFromDomain = (domain: string) => {
		const gen = generation;
		// set default favicon while it's loading
		setUrl(defaultFaviconUrl);
		faviconService
			.fetchFavicon(domain)
			.then((favicon) => {
				if (gen !== generation) return;
				setUrl(favicon?.iconData || defaultFaviconUrl);
			})
			.catch(() => {
				if (gen !== generation) return;
				setUrl(defaultFaviconUrl);
			});
	};

	use(this.iconUrl, this.domain).listen(([iconUrl, domain]) => {
		generation++;
		if (iconUrl) {
			setUrl(iconUrl);
		} else if (domain) {
			loadFromDomain(domain);
		} else {
			setUrl(defaultFaviconUrl);
		}
	});
	// :(
	this.domain = this.domain;
	this.iconUrl = this.iconUrl;

	const onError = () => {
		// the default icon itself failed, nothing else to fall back to
		if (this.url === defaultFaviconUrl) return;

		generation++;
		// explicit icon is broken, try looking it up by domain instead
		if (this.iconUrl && this.url === this.iconUrl && this.domain) {
			loadFromDomain(this.domain);
		} else {
			setUrl(defaultFaviconUrl);
		}
	};

	return (
		<img
			src={use(this.url)}
			on:error={onError}
			width={use(this.size).map((s) =>
				s === "small" ? 16 : s === "medium" ? 32 : 64
			)}
			height={use(this.size).map((s) =>
				s === "small" ? 16 : s === "medium" ? 32 : 64
			)}
			class={use(this.size)}
		></img>
	);
}
Favicon.style = css`
	:scope {
		font-size: 0;
	}
	:scope.small {
		width: 16px;
		height: 16px;
	}
	:scope.medium {
		width: 32px;
		height: 32px;
	}
	:scope.large {
		width: 64px;
		height: 64px;
	}
`;
