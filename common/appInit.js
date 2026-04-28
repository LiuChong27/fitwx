import uniStarterConfig from '@/uni-starter.config.js';

const db = uniCloud.database();
let hasWarnedUniIdUsersClientDbIssue = false;

function getCurrentRoute() {
	try {
		const pages = getCurrentPages();
		const currentPage = pages[pages.length - 1];
		return currentPage && currentPage.route ? currentPage.route : '';
	} catch (_) {
		return '';
	}
}

function classifyClientDbError(code, message = '') {
	const raw = `${code || ''} ${message || ''}`.toLowerCase();
	if (
		raw.includes('schema') &&
		(raw.includes('missing') || raw.includes('not found') || raw.includes('collection schema') || raw.includes('schema error'))
	) {
		return 'schema_missing';
	}
	if (raw.includes('collection') && (raw.includes('not exist') || raw.includes('not found'))) {
		return 'collection_missing';
	}
	if (raw.includes('permission') || raw.includes('auth') || raw.includes('forbidden') || raw.includes('denied')) {
		return 'permission_denied';
	}
	if (raw.includes('token') && (raw.includes('invalid') || raw.includes('expired') || raw.includes('check-token-failed'))) {
		return 'token_invalid';
	}
	return 'unknown';
}

function getFriendlyCloudErrorMessage(errorMessage = '') {
	const msg = String(errorMessage || '').toLowerCase();
	if (msg.includes('resource exhausted')) {
		return '当前服务繁忙，请稍后重试。';
	}
	return '';
}

export default async function initApp() {
	const debug = uniStarterConfig.debug;

	setTimeout(() => {
		getApp({ allowDefault: true }).globalData.config = uniStarterConfig;
	}, 1);

	initAppVersion();

	db.on('error', ({ code, message }) => {
		const category = classifyClientDbError(code, message);
		const payload = {
			category,
			code,
			message,
			route: getCurrentRoute(),
		};
		const rawMessage = String(message || '');
		const isUniIdUsersSyncIssue =
			rawMessage.includes('uni-id-users') &&
			['schema_missing', 'collection_missing', 'permission_denied'].includes(category);

		if (isUniIdUsersSyncIssue) {
			if (!hasWarnedUniIdUsersClientDbIssue) {
				console.warn('[clientDB] uni-id-users profile sync skipped; auth fallback remains active', payload);
				hasWarnedUniIdUsersClientDbIssue = true;
			}
			return;
		}

		console.error('[clientDB]', payload);
	});

	uniCloud.interceptObject({
		async invoke({ objectName, methodName, params }) {
			if (
				objectName === 'uni-id-co' &&
				(methodName.includes('loginBy') || ['login', 'registerUser'].includes(methodName))
			) {
				params[0].inviteCode = await new Promise((resolve) => {
					uni.getClipboardData({
						success(res) {
							const clipData = (res.data || '').trim();
							if (clipData.slice(0, 18) === 'uniInvitationCode:') {
								resolve(clipData.slice(18, 38));
								return;
							}
							resolve();
						},
						fail() {
							resolve();
						},
					});
				});
			}
		},
		fail(error) {
			console.error(error);
			const errMsg = (error && (error.message || error.errMsg)) || JSON.stringify(error);
			const friendlyMessage = getFriendlyCloudErrorMessage(errMsg);
			if (friendlyMessage) {
				uni.showModal({
					title: '服务繁忙',
					content: friendlyMessage,
					showCancel: false,
				});
				return;
			}
			if (debug) {
				uni.showModal({
					content: errMsg,
					showCancel: false,
				});
			}
		},
	});

	// #ifdef APP
	uni.onNetworkStatusChange((res) => {
		if (res.networkType !== 'none') {
			uni.showToast({
				title: `网络已恢复：${res.networkType}`,
				icon: 'none',
				duration: 3000,
			});
		} else {
			uni.showToast({
				title: '网络已断开，请检查连接',
				icon: 'none',
				duration: 3000,
			});
		}
	});
	// #endif
}

function initAppVersion() {
	// #ifdef APP-PLUS
	const appid = plus.runtime.appid;
	plus.runtime.getProperty(appid, (wgtInfo) => {
		const appVersion = plus.runtime;
		const currentVersion = appVersion.versionCode > wgtInfo.versionCode ? appVersion : wgtInfo;
		getApp({ allowDefault: true }).appVersion = {
			...currentVersion,
			appid,
			hasNew: false,
		};
	});
	// #endif
}
