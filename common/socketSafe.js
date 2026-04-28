const MIN_CUSTOM_CLOSE_CODE = 3000;
const MAX_CUSTOM_CLOSE_CODE = 4999;

function normalizeCloseCode(rawCode) {
	const code = Number(rawCode);
	if (code === 1000) return 1000;
	if (Number.isInteger(code) && code >= MIN_CUSTOM_CLOSE_CODE && code <= MAX_CUSTOM_CLOSE_CODE) {
		return code;
	}
	return 1000;
}

function normalizeCloseReason(reason) {
	if (!reason) return 'normal close';
	const text = String(reason);
	return text.slice(0, 120);
}

export function safeCloseSocket(options = {}) {
	const { code, reason } = options;
	const normalizedCode = normalizeCloseCode(code);
	const normalizedReason = normalizeCloseReason(reason);
	if (normalizedCode !== Number(code)) {
		console.warn('[socket] invalid close code detected, fallback to 1000', {
			original: code,
			normalized: normalizedCode,
			reason: normalizedReason,
		});
	}

	return uni.closeSocket({
		...options,
		code: normalizedCode,
		reason: normalizedReason,
	});
}

export function patchUniCloseSocket() {
	if (typeof uni === 'undefined' || typeof uni.closeSocket !== 'function') return;
	if (uni.__fitmeetSafeCloseSocketPatched) return;

	const originCloseSocket = uni.closeSocket;
	uni.closeSocket = function patchedCloseSocket(options = {}) {
		const normalizedCode = normalizeCloseCode(options.code);
		const normalizedReason = normalizeCloseReason(options.reason);
		if (normalizedCode !== Number(options.code)) {
			console.warn('[socket] closeSocket code corrected', {
				original: options.code,
				normalized: normalizedCode,
			});
		}
		return originCloseSocket.call(uni, {
			...options,
			code: normalizedCode,
			reason: normalizedReason,
		});
	};

	uni.__fitmeetSafeCloseSocketPatched = true;
}

export default {
	safeCloseSocket,
	patchUniCloseSocket,
};
