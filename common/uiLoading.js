function getHideLoadingErrorMessage(error) {
	return String((error && (error.errMsg || error.message)) || '');
}

function isIgnorableHideLoadingError(error) {
	const errMsg = getHideLoadingErrorMessage(error);
	return errMsg.includes('hideLoading:fail') || errMsg.includes("toast can't be found");
}

export async function safeHideLoading() {
	if (typeof uni === 'undefined' || typeof uni.hideLoading !== 'function') return;

	try {
		await Promise.resolve(uni.hideLoading());
	} catch (error) {
		if (isIgnorableHideLoadingError(error)) return;
		console.warn('[uiLoading] hideLoading failed', error);
	}
}

export function patchUniHideLoading() {
	if (typeof uni === 'undefined' || typeof uni.hideLoading !== 'function') return;
	if (uni.__fitSafeHideLoadingPatched) return;

	const originHideLoading = uni.hideLoading;
	uni.hideLoading = function patchedHideLoading(...args) {
		try {
			const result = originHideLoading.apply(uni, args);
			if (result && typeof result.then === 'function') {
				return result.catch((error) => {
					if (isIgnorableHideLoadingError(error)) return;
					throw error;
				});
			}
			return result;
		} catch (error) {
			if (isIgnorableHideLoadingError(error)) return;
			throw error;
		}
	};

	uni.__fitSafeHideLoadingPatched = true;
}

export default {
	safeHideLoading,
	patchUniHideLoading,
};
