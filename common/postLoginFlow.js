import { useUserStore } from '@/store/user.js';
import { reportError } from '@/common/errorMonitor.js';
import { consumePostLoginTarget } from '@/common/auth.js';

const DEFAULT_POST_LOGIN_PAGE = '/pages/grid/discover';
const TAB_PAGES = new Set([
	'/pages/meet/meet',
	'/pages/grid/discover',
	'/pages/notification/index',
	'/pages/ucenter/ucenter',
]);

function normalizeRoutePath(route = '') {
	if (!route) return '';
	const cleanRoute = String(route).split('?')[0].split('#')[0];
	if (!cleanRoute) return '';
	return cleanRoute.startsWith('/') ? cleanRoute : `/${cleanRoute}`;
}

function safeDecode(value = '') {
	try {
		return decodeURIComponent(value);
	} catch (_) {
		return value;
	}
}

function normalizeRedirectTarget(target = '') {
	if (!target) return '';
	let raw = safeDecode(String(target).trim());
	if (!raw) return '';
	if (/^[a-z]+:\/\//i.test(raw)) return '';
	if (!raw.startsWith('/')) raw = `/${raw}`;
	const [pathPart = '', queryPart = ''] = raw.split('?');
	const path = normalizeRoutePath(pathPart);
	if (!path || path.startsWith('/pages/login/')) return '';
	return queryPart ? `${path}?${queryPart}` : path;
}

function readRedirectFromLoginQuery() {
	try {
		const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
		if (!Array.isArray(pages) || !pages.length) return '';
		const current = pages[pages.length - 1] || {};
		const routePath = normalizeRoutePath(current.route || '');
		if (!routePath.startsWith('/pages/login/')) return '';
		const redirect = current.options && current.options.redirect;
		return normalizeRedirectTarget(redirect);
	} catch (_) {
		return '';
	}
}

function splitTarget(targetUrl = '') {
	const raw = normalizeRedirectTarget(targetUrl);
	if (!raw) return { path: '', full: '' };
	const [path = ''] = raw.split('?');
	return {
		path,
		full: raw,
	};
}

function navigateAfterLogin(targetUrl = '') {
	const normalized = splitTarget(targetUrl);
	const fallback = splitTarget(DEFAULT_POST_LOGIN_PAGE);
	const finalTarget = normalized.full || fallback.full;
	const finalPath = normalized.path || fallback.path;

	if (TAB_PAGES.has(finalPath)) {
		uni.switchTab({ url: finalPath });
		return;
	}
	uni.reLaunch({
		url: finalTarget,
		fail: () => {
			uni.switchTab({ url: fallback.path });
		},
	});
}

export async function handlePostLoginSuccess() {
	try {
		const userStore = useUserStore();
		userStore.syncFromLogin();
	} catch (e) {
		reportError(e, { action: 'syncFromLogin' });
	}

	const queryRedirect = readRedirectFromLoginQuery();
	const cachedTarget = consumePostLoginTarget();
	navigateAfterLogin(queryRedirect || cachedTarget);
}
