/**
 * 全局错误监控与上报
 *
 * 解决问题：
 * 1. 无 app.config.errorHandler —— 未捕获的 Vue 错误完全静默
 * 2. 无 unhandledrejection 处理 —— Promise rejection 丢失
 * 3. 无错误上报通道 —— 线上问题无法感知
 *
 * 用法（main.js）：
 *   import { setupErrorMonitor } from '@/common/errorMonitor.js';
 *   const app = createSSRApp(App);
 *   setupErrorMonitor(app);
 */

const ERROR_QUEUE = [];
const MAX_QUEUE = 50;
let _reportTimer = null;

/**
 * 收集一条错误信息
 */
function captureError(source, error, extra = {}) {
	const entry = {
		source,
		message: error?.message || String(error),
		stack: error?.stack || '',
		timestamp: Date.now(),
		page: getCurrentPageRoute(),
		platform: getPlatformInfo(),
		...extra,
	};

	// 开发环境始终打到控制台
	if (process.env.NODE_ENV !== 'production') {
		console.error(`[ErrorMonitor][${source}]`, error, extra);
	}

	ERROR_QUEUE.push(entry);
	if (ERROR_QUEUE.length > MAX_QUEUE) {
		ERROR_QUEUE.shift();
	}

	// 批量延迟上报（500ms 内多个错误合并一次请求）
	scheduleBatchReport();
}

/**
 * 延迟批量上报
 */
function scheduleBatchReport() {
	if (_reportTimer) return;
	_reportTimer = setTimeout(() => {
		_reportTimer = null;
		flushErrors();
	}, 500);
}

/**
 * 将队列中的错误批量上报到云端
 */
async function flushErrors() {
	if (!ERROR_QUEUE.length) return;
	const batch = ERROR_QUEUE.splice(0, MAX_QUEUE);

	try {
		// 上报到云函数（如无后端接口，可替换为其他上报通道）
		await uniCloud.callFunction({
			name: 'fit-ucenter-api',
			data: {
				action: 'reportErrors',
				params: { errors: batch },
			},
		});
	} catch (_) {
		// 上报失败不能再抛错，把数据放回队列下次重试
		ERROR_QUEUE.unshift(...batch.slice(0, 10));
	}
}

/**
 * 获取当前页面路由
 */
function getCurrentPageRoute() {
	try {
		const pages = getCurrentPages();
		const page = pages[pages.length - 1];
		return page ? page.route || page.__route__ || '' : '';
	} catch (_) {
		return '';
	}
}

/**
 * 获取平台信息
 */
function getPlatformInfo() {
	try {
		const info = uni.getSystemInfoSync();
		return {
			platform: info.platform,
			model: info.model,
			system: info.system,
			version: info.version,
			SDKVersion: info.SDKVersion,
		};
	} catch (_) {
		return {};
	}
}

/**
 * 安装全局错误监控
 * @param {import('vue').App} app Vue 应用实例
 */
export function setupErrorMonitor(app) {
	// 1. Vue 组件渲染/生命周期错误
	app.config.errorHandler = (err, vm, info) => {
		captureError('vue', err, {
			lifecycleHook: info,
			componentName: vm?.$options?.name || vm?.$options?.__name || 'Anonymous',
		});
	};

	// 2. Vue 警告（仅开发环境记录）
	if (process.env.NODE_ENV !== 'production') {
		app.config.warnHandler = (msg, vm, trace) => {
			console.warn(`[Vue warn]: ${msg}`, trace);
		};
	}

	// 3. 未捕获的 Promise rejection
	// #ifdef H5
	if (typeof window !== 'undefined') {
		window.addEventListener('unhandledrejection', (event) => {
			captureError('unhandledrejection', event.reason || event);
		});
		window.addEventListener('error', (event) => {
			captureError('window.onerror', event.error || event.message, {
				filename: event.filename,
				lineno: event.lineno,
				colno: event.colno,
			});
		});
	}
	// #endif

	// 4. uni-app 全局错误事件
	// #ifdef APP-PLUS
	if (typeof plus !== 'undefined' && plus.globalEvent) {
		plus.globalEvent.addEventListener('error', (e) => {
			captureError('plus.error', e);
		});
	}
	// #endif

	// 5. 小程序 onError（通过 App.vue onError 生命周期已处理，这里做兜底）
	uni.onError && uni.onError((err) => {
		captureError('uni.onError', err);
	});
}

/**
 * 手动上报错误（供 try/catch 中使用）
 */
export function reportError(error, extra = {}) {
	captureError('manual', error, extra);
}

/**
 * 获取当前错误队列（调试用）
 */
export function getErrorQueue() {
	return [...ERROR_QUEUE];
}

export default { setupErrorMonitor, reportError, getErrorQueue };
