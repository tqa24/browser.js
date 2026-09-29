import * as tldts from "tldts";
import { FAVICON_CACHE_TTL } from "../consts";
import { bare } from "../proxy/wisp";
import { Service } from "./Service";

export type FaviconCacheEntry = {
	domain: string;
	iconUrl: string;
	iconData: string;
	timestamp: number;
};

export type FaviconServiceState = {
	faviconCache: {
		domain: string;
		iconUrl: string;
		iconData: string;
		timestamp: number;
	}[];
};

export class FaviconService extends Service {
	private faviconCache: FaviconCacheEntry[] = [];
	private pendingFaviconRequests: Record<
		string,
		Promise<FaviconCacheEntry | null> | null
	> = {};

	constructor(data: FaviconServiceState | null) {
		super();
		if (data) {
			this.faviconCache = data.faviconCache.map((e) => ({
				domain: e.domain,
				iconUrl: e.iconUrl,
				iconData: e.iconData,
				timestamp: e.timestamp,
			}));
		} else {
			this.faviconCache = [];
		}
	}

	save(): FaviconServiceState {
		return {
			faviconCache: this.faviconCache.map((e) => ({
				domain: e.domain,
				iconUrl: e.iconUrl,
				iconData: e.iconData,
				timestamp: e.timestamp,
			})),
		};
	}

	clearCache() {
		this.faviconCache = [];
		this.markDirty();
	}

	getCachedFavicon(hostname: string): FaviconCacheEntry | null {
		const entry = this.faviconCache.find((e) => e.domain === hostname);
		if (entry && entry.timestamp > Date.now() - FAVICON_CACHE_TTL) {
			return entry;
		}
		return null;
	}

	private async __fetchFavicon(
		hostname: string
	): Promise<FaviconCacheEntry | null> {
		const toDataUrl = async (res: Response) => {
			const blob = await res.blob();
			const iconData = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onloadend = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(blob);
			});
			return iconData;
		};

		try {
			// first do google favicon search
			const url = `https://www.google.com/s2/favicons?domain=${hostname}`;
			let res = await bare.fetch(url);
			if (!res.ok) {
				throw new Error(
					`failed to fetch favicon from google: ${res.statusText}`
				);
			}
			const iconData = await toDataUrl(res);
			const entry: FaviconCacheEntry = {
				domain: hostname,
				iconUrl: url,
				iconData,
				timestamp: Date.now(),
			};
			// Update cache
			this.faviconCache = this.faviconCache.filter(
				(e) => e.domain !== hostname
			);
			this.faviconCache.push(entry);
			return entry;
		} catch (e) {
			// console.error(e);
		}

		try {
			// fall back to direct fetch
			const url = `https://${hostname}/favicon.ico`;
			let res = await bare.fetch(url);
			if (!res.ok) {
				throw new Error(`failed to fetch favicon from: ${res.statusText}`);
			}
			const iconData = await toDataUrl(res);
			const entry: FaviconCacheEntry = {
				domain: hostname,
				iconUrl: url,
				iconData,
				timestamp: Date.now(),
			};
			// Update cache
			this.faviconCache = this.faviconCache.filter(
				(e) => e.domain !== hostname
			);
			this.faviconCache.push(entry);
			return entry;
		} catch (e) {
			// console.error(e);
		}

		return null;
	}

	private async _fetchFavicon(
		hostname: string
	): Promise<FaviconCacheEntry | null> {
		let entry = this.faviconCache.find((e) => e.domain === hostname);
		if (entry) {
			if (entry.timestamp > Date.now() - FAVICON_CACHE_TTL) {
				return entry;
			}
			this.faviconCache = this.faviconCache.filter(
				(e) => e.domain !== entry!.domain
			);
		}

		const parsed = tldts.parse(hostname);
		if (parsed.isIp || !parsed.isIcann || hostname === "localhost") {
			// probably not a real domain, so don't try to fetch a favicon
			return null;
		}

		return this.__fetchFavicon(hostname);
	}

	async fetchFavicon(hostname: string): Promise<FaviconCacheEntry | null> {
		if (this.pendingFaviconRequests[hostname]) {
			return this.pendingFaviconRequests[hostname]!;
		}
		let p = this._fetchFavicon(hostname);
		this.pendingFaviconRequests[hostname] = p;
		let result = await p;
		this.pendingFaviconRequests[hostname] = null;
		return result;
	}
}
