if (import.meta.env.VITE_PUTER_BRANDING) {
	let promises = [];

	let puterSdk = <script src="https://js.puter.com/v2/"></script>;
	document.head.append(puterSdk);
	promises.push(
		new Promise<void>((res) => {
			puterSdk.onload = () => res();
		})
	);

	if (import.meta.env.VITE_SENTRY_URL) {
		let sentrySdk = (
			<script
				src={import.meta.env.VITE_SENTRY_URL}
				crossorigin="anonymous"
			></script>
		);
		document.head.append(sentrySdk);
		promises.push(
			new Promise<void>((res, rej) => {
				sentrySdk.onload = () => res();
				sentrySdk.onerror = () => {
					console.error("Error loading Sentry (adblocker?)");
					res();
				};
			})
		);
	}
	if (import.meta.env.VITE_PLAUSIBLE_URL) {
		let plausibleSdk = (
			<script
				src={import.meta.env.VITE_PLAUSIBLE_URL}
				crossorigin="anonymous"
			></script>
		);
		document.head.append(plausibleSdk);
		plausibleSdk.onload = () => {
			// @ts-expect-error no types yet
			plausible.init();
		};
	}

	await Promise.all(promises);
}
