<script>
import initApp from '@/common/appInit.js';
import uniIdPageInit from '@/uni_modules/uni-id-pages/init.js';
import apiService from '@/services/apiService.js';
import { store } from '@/uni_modules/uni-id-pages/common/store.js';
import { useUserStore } from '@/store/user.js';
import { reportError } from '@/common/errorMonitor.js';
import analytics from '@/common/analytics.js';
import perfMonitor from '@/common/perfMonitor.js';
import { patchUniCloseSocket } from '@/common/socketSafe.js';
import { patchUniHideLoading } from '@/common/uiLoading.js';
import { flushDeferredStorageWrites } from '@/common/storage.js';
import { handlePostLoginSuccess } from '@/common/postLoginFlow.js';
// #ifdef MP-WEIXIN
import { prefetchWxCode } from '@/common/wxSilentLogin.js';
// #endif

export default {
	globalData: {
		searchText: '',
		appVersion: {},
		config: {},
		$i18n: {},
		$t: {},
	},
	onLaunch: async function () {
		this.globalData.$i18n = this.$i18n;
		this.globalData.$t = (str) => this.$t(str);

			initApp();
			patchUniCloseSocket();
			patchUniHideLoading();
			flushDeferredStorageWrites();
			analytics.init();
			perfMonitor.init();
		await Promise.resolve(uniIdPageInit());

		// #ifdef MP-WEIXIN
		this.warmupSilentWxLogin();
		// #endif

		this.setupAuthFlow();
	},
		onShow: function () {
			flushDeferredStorageWrites();
			this.syncNotificationBadge();
			analytics.trackEvent('app_show');
		},
	onHide: function () {
		analytics.trackEvent('app_hide');
		analytics.flush();
	},
	methods: {
		async warmupSilentWxLogin() {
			// #ifdef MP-WEIXIN
			try {
				await prefetchWxCode();
			} catch (e) {
				console.warn('[auth] prefetch wx code failed', e);
			}
			// #endif
		},
		async syncNotificationBadge() {
			try {
				if (!store.hasLogin) return;
				const res = await apiService.getUnreadCount();
				const count = res.unreadCount || 0;
				const tabIndex = 2;
				if (count > 0) {
					uni.setTabBarBadge({ index: tabIndex, text: count > 99 ? '99+' : String(count), fail() {} });
				} else {
					uni.removeTabBarBadge({ index: tabIndex, fail() {} });
				}
			} catch (_) {
				// ignore
			}
		},
		setupAuthFlow() {
			try {
				uni.$off('uni-id-pages-login-success');
			} catch (_) {
				// ignore missing listener
			}
			try {
				uni.$off('uni-id-pages-logout');
			} catch (_) {
				// ignore missing listener
			}

			uni.$on('uni-id-pages-login-success', async () => {
				await handlePostLoginSuccess();
			});

			uni.$on('uni-id-pages-logout', () => {
				try {
					const userStore = useUserStore();
					userStore.logout();
				} catch (e) {
					reportError(e, { action: 'logout' });
				}
			});
		},
	},
};
</script>

<style>
page {
	background-color: #08131d;
	color: rgba(255, 255, 255, 0.92);
	font-family: 'PingFang SC', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}

::-webkit-scrollbar {
	width: 4px;
	height: 4px;
}

::-webkit-scrollbar-track {
	background: transparent;
}

::-webkit-scrollbar-thumb {
	background: rgba(114, 228, 200, 0.24);
	border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
	background: rgba(114, 228, 200, 0.4);
}

.uni-popup .uni-popup__wrapper {
	background-color: transparent !important;
}

@keyframes fadeInUp {
	from {
		opacity: 0;
		transform: translateY(24rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes fadeInDown {
	from {
		opacity: 0;
		transform: translateY(-24rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes fadeInScale {
	from {
		opacity: 0;
		transform: scale(0.92);
	}
	to {
		opacity: 1;
		transform: scale(1);
	}
}

@keyframes slideInRight {
	from {
		opacity: 0;
		transform: translateX(40rpx);
	}
	to {
		opacity: 1;
		transform: translateX(0);
	}
}

@keyframes shimmer {
	0% {
		background-position: -200% 0;
	}
	100% {
		background-position: 200% 0;
	}
}

@keyframes breathe {
	0%,
	100% {
		box-shadow: 0 0 12rpx rgba(114, 228, 200, 0.14);
	}
	50% {
		box-shadow: 0 0 24rpx rgba(114, 228, 200, 0.3);
	}
}

@keyframes floatSlow {
	0%,
	100% {
		transform: translateY(0);
	}
	50% {
		transform: translateY(-8rpx);
	}
}

button,
.uni-btn,
image {
	transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

button:active {
	transform: scale(0.97);
}

.uni-toast {
	backdrop-filter: blur(12px) !important;
	-webkit-backdrop-filter: blur(12px) !important;
}

image {
	will-change: opacity;
}
</style>
