<script>
	import initApp from '@/common/appInit.js';
	import uniIdPageInit from '@/uni_modules/uni-id-pages/init.js';
	import apiService from '@/services/apiService.js';
	import { store } from '@/uni_modules/uni-id-pages/common/store.js';
	import { useUserStore } from '@/store/user.js';
	import { reportError } from '@/common/errorMonitor.js';
	import analytics from '@/common/analytics.js';
	import perfMonitor from '@/common/perfMonitor.js';
	export default {
		globalData: {
			searchText: '',
			appVersion: {},
			config: {},
			$i18n: {},
			$t: {}
		},
		onLaunch: async function() {
			console.log('App Launch')
			this.globalData.$i18n = this.$i18n
			this.globalData.$t = str => this.$t(str)
			initApp();

			// 埋点 & 性能监控初始化
			analytics.init();
			perfMonitor.init();

			await Promise.resolve(uniIdPageInit())

			// ========= 账号与数据隔离关键逻辑 =========
			// 1) 未登录：启动强制进入登录页
			// 2) 登录成功：通过 Pinia store 统一管理登录态
			// 3) 退出登录：由 userStore.logout() 统一清理
			this.setupAuthFlow();
		},
		onShow: function() {
			console.log('App Show')
			this.syncNotificationBadge()
			analytics.trackEvent('app_show')
		},
		onHide: function() {
			console.log('App Hide')
			analytics.trackEvent('app_hide')
			analytics.flush()
		}
		,
		methods: {
			/** 同步消息中心未读数角标 */
			async syncNotificationBadge() {
				try {
					if (!store.hasLogin) return
					const res = await apiService.getUnreadCount()
					const count = res.unreadCount || 0
					const tabIndex = 2 // 消息 tab 索引
					if (count > 0) {
						uni.setTabBarBadge({ index: tabIndex, text: count > 99 ? '99+' : String(count) })
					} else {
						uni.removeTabBarBadge({ index: tabIndex })
					}
				} catch (_) {
					// 静默：不影响正常使用
				}
			},
			setupAuthFlow() {
				// 避免重复绑定
				try { uni.$off('uni-id-pages-login-success'); } catch (_) {}
				try { uni.$off('uni-id-pages-logout'); } catch (_) {}

				// 启动时如果未登录，直接进入登录页（等待初始化完成）
				setTimeout(() => {
					if (!store.hasLogin) {
						uni.reLaunch({
							url: '/pages/login/login-withoutpwd'
						});
					}
				}, 80);

				uni.$on('uni-id-pages-login-success', async () => {
					try {
						const userStore = useUserStore();
						userStore.syncFromLogin();
					} catch (e) {
						reportError(e, { action: 'syncFromLogin' });
					}

					// 判断资料是否完整：不完整 → 个人中心；完整 → Tab 首页
					try {
						const profile = await apiService.getProfile();
						const ok = apiService.isProfileComplete(profile);
						if (!ok) {
							uni.switchTab({ url: '/pages/ucenter/ucenter' });
							return;
						}
						uni.switchTab({ url: '/pages/grid/discover' });
					} catch (e) {
						// 拉取失败时不阻塞登录流程：默认进入首页
						uni.switchTab({ url: '/pages/grid/discover' });
					}
				});

				uni.$on('uni-id-pages-logout', () => {
					try {
						const userStore = useUserStore();
						userStore.logout();
					} catch (e) {
						reportError(e, { action: 'logout' });
					}
				});
			}
		}
	}
</script>

<style>
	/* ===== Shorelines 全局基础样式 ===== */
	page {
		background-color: #0A1628;
		color: rgba(255, 255, 255, 0.9);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}

	/* 全局滚动条美化 (H5) */
	::-webkit-scrollbar {
		width: 4px;
		height: 4px;
	}
	::-webkit-scrollbar-track {
		background: transparent;
	}
	::-webkit-scrollbar-thumb {
		background: rgba(0, 229, 255, 0.2);
		border-radius: 4px;
	}
	::-webkit-scrollbar-thumb:hover {
		background: rgba(0, 229, 255, 0.35);
	}

	/* uni-popup 遮罩层深色 */
	.uni-popup .uni-popup__wrapper {
		background-color: transparent !important;
	}

	/* ===== 全局动画工具类 ===== */
	@keyframes fadeInUp {
		from { opacity: 0; transform: translateY(24rpx); }
		to   { opacity: 1; transform: translateY(0); }
	}
	@keyframes fadeInDown {
		from { opacity: 0; transform: translateY(-24rpx); }
		to   { opacity: 1; transform: translateY(0); }
	}
	@keyframes fadeInScale {
		from { opacity: 0; transform: scale(0.92); }
		to   { opacity: 1; transform: scale(1); }
	}
	@keyframes slideInRight {
		from { opacity: 0; transform: translateX(40rpx); }
		to   { opacity: 1; transform: translateX(0); }
	}
	@keyframes shimmer {
		0%   { background-position: -200% 0; }
		100% { background-position: 200% 0; }
	}
	@keyframes breathe {
		0%, 100% { box-shadow: 0 0 12rpx rgba(0, 229, 255, 0.15); }
		50%      { box-shadow: 0 0 24rpx rgba(0, 229, 255, 0.35); }
	}
	@keyframes floatSlow {
		0%, 100% { transform: translateY(0); }
		50%      { transform: translateY(-8rpx); }
	}

	/* 通用过渡增强 */
	button, .uni-btn, image {
		transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	}
	button:active {
		transform: scale(0.97);
	}

	/* 全局 Toast 样式覆盖 */
	.uni-toast {
		backdrop-filter: blur(12px) !important;
		-webkit-backdrop-filter: blur(12px) !important;
	}

	/* 全局图片加载占位 */
	image {
		will-change: opacity;
	}
</style>
