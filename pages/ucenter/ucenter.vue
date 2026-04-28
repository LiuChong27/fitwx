<template>
	<view class="profile-page">
		<!-- #ifdef APP -->
		<statusBar />
		<!-- #endif -->

		<!-- ====== 顶部封面区域 ====== -->
		<view class="cover-section">
			<view class="cover-wrap" @click="onCoverTap" role="button" aria-label="更换封面">
				<image v-if="coverSrc" class="cover-img" :src="coverSrc" mode="aspectFill" lazy-load aria-hidden="true" />
				<view v-else class="cover-img cover-placeholder">
					<uni-icons type="image" size="40" color="rgba(255,255,255,0.3)" />
				</view>
				<view class="cover-mask" />
				<!-- 刷新指示器 -->
				<view class="refresh-indicator" v-if="refreshing">
					<view class="refresh-spinner" />
				</view>
				<view class="cover-actions">
					<view class="cover-btn" @click.stop="onCoverTap">
						<uni-icons type="camera-filled" size="16" color="#fff" />
					</view>
				</view>
			</view>
		</view>

		<!-- ====== 用户资料卡片 ====== -->
		<view class="profile-card" v-if="!loading || profile.nickname">
			<view class="profile-header">
				<view class="avatar-wrap" @click="toUserInfo" role="button" aria-label="编辑头像">
					<image v-if="avatarSrc" class="avatar" :src="avatarSrc" mode="aspectFill" lazy-load aria-hidden="true" />
					<view v-else class="avatar default-avatar">
						<uni-icons type="person-filled" size="50" color="rgba(255,255,255,0.6)" />
					</view>
					<view class="avatar-badge" v-if="hasLogin">
						<uni-icons type="checkmarkempty" size="12" color="#fff" />
					</view>
				</view>
				<view class="profile-main">
					<view class="row-name">
						<text class="nickname">{{ displayName }}</text>
						<view class="vip-tag" v-if="profile.singleCert">
							<text class="vip-text">单身认证</text>
						</view>
					</view>
					<view class="row-meta" v-if="hasLogin">
						<text class="meta-text">{{ profileSummary }}</text>
					</view>
					<view class="row-meta" v-else>
						<text class="meta-text login-hint" @click="toUserInfo">点击登录/注册</text>
					</view>
				</view>
				<view class="profile-action" role="button" aria-label="完善资料" @click="openEditProfile">
					<uni-icons type="compose" size="22" color="rgba(255,255,255,0.6)" />
				</view>
			</view>
			<!-- 健身房标签 -->
			<view class="gym-tags" v-if="hasGyms">
				<text class="gym-tag" v-for="(g, i) in profile.gyms" :key="i">{{ g }}</text>
			</view>
		</view>
		<!-- 资料卡骨架屏 -->
		<view class="profile-card skeleton-card" v-else>
			<view class="profile-header">
				<view class="skeleton-circle skeleton-pulse" style="width:120rpx;height:120rpx;" />
				<view class="profile-main">
					<view class="skeleton-line skeleton-pulse" style="width:40%;height:34rpx;margin-bottom:12rpx;" />
					<view class="skeleton-line skeleton-pulse" style="width:60%;height:24rpx;" />
				</view>
			</view>
		</view>

		<!-- ====== 数据加载状态 ====== -->
		<view class="error-card" v-if="loadError && !loading">
			<uni-icons type="info" size="36" color="rgba(255,255,255,0.3)" />
			<text class="error-text">数据加载失败</text>
			<button class="btn-retry" @click="retryLoad">重新加载</button>
		</view>

		<!-- ====== 身份切换 ====== -->
		<view class="mode-bar" role="tablist" aria-label="身份切换">
			<view
				class="mode-item"
				v-for="tab in modeTabs"
				:key="tab.value"
				:class="{ active: isCoachMode === tab.value }"
				role="tab"
				:aria-selected="isCoachMode === tab.value"
				@click="switchMode(tab.value)"
			>
				<text>{{ tab.label }}</text>
			</view>
		</view>

		<!-- ====== 角色菜单（数据驱动渲染） ====== -->
		<view class="menu-card" role="menu" aria-label="功能菜单" v-if="roleMenus.length">
			<view
				class="menu-item"
				v-for="item in roleMenus"
				:key="item.title"
				role="menuitem"
				:aria-label="item.title"
				@click="item.handler"
			>
				<text class="menu-icon">{{ item.icon }}</text>
				<text class="menu-title">{{ item.title }}</text>
				<view class="menu-extra" v-if="item.badge">
					<text class="menu-badge">{{ item.badge }}</text>
				</view>
				<uni-icons type="right" size="16" color="rgba(255,255,255,0.3)" />
			</view>
		</view>

		<!-- ====== 通用功能菜单 ====== -->
		<view class="menu-card more-card" role="menu" aria-label="通用菜单">
			<view
				class="menu-item"
				v-for="item in commonMenus"
				:key="item.title"
				role="menuitem"
				:aria-label="item.title"
				@click="item.handler"
			>
				<text class="menu-icon">{{ item.icon }}</text>
				<text class="menu-title">{{ item.title }}</text>
				<uni-icons type="right" size="16" color="rgba(255,255,255,0.3)" />
			</view>
		</view>

		<!-- ====== 完善资料弹窗 ====== -->
		<edit-profile-popup
			ref="editPopup"
			:profile="profile"
			:avatar-src="avatarSrc"
			@saved="onProfileSaved"
			@choose-avatar="chooseAvatar"
		/>

		<!-- ====== 接单设置弹窗 ====== -->
		<coach-settings-popup
			ref="coachPopup"
			:settings="coachSettings"
			@saved="onCoachSettingsSaved"
		/>

		<!-- ====== 学员管理弹窗 ====== -->
		<students-popup
			ref="studentsPopup"
			:students="students"
			@chat="chatWithStudent"
		/>

		<!-- ====== 收入记录弹窗 ====== -->
		<income-popup
			ref="incomePopup"
			:summary="incomeSummary"
			:records="incomeRecords"
		/>
		<training-stats-popup
			ref="trainingStatsPopup"
			:stats-list="statsList"
			:before-after-list="beforeAfterList"
			@log-workout="logWorkout"
			@add-before-after="addBeforeAfter"
		/>

		<uni-sign-in ref="signIn" />
	</view>
</template>

<script>
	// #ifdef APP
	import statusBar from '@/uni_modules/uni-nav-bar/components/uni-nav-bar/uni-status-bar';
	// #endif
	import { store } from '@/uni_modules/uni-id-pages/common/store.js';
	import chatService from '@/services/chatService.js';
	import apiService from '@/services/apiService.js';
	import EditProfilePopup from './components/edit-profile-popup.vue';
	import CoachSettingsPopup from './components/coach-settings-popup.vue';
	import StudentsPopup from './components/students-popup.vue';
	import IncomePopup from './components/income-popup.vue';
	import TrainingStatsPopup from './components/training-stats-popup.vue';
	import { coverUrl, avatarUrl as optimizedAvatar } from '@/common/imageOptimizer.js';
	import { useUserStore } from '@/store/user.js';

	/** 环形进度最大值配置 */
	const RING_MAX = { days: 30, times: 60, calorie: 50 };

	/** 本地缓存 key 配置 */
	const STORAGE_KEYS = {
		coachMode: 'ucenter_coach_mode',
		lastUid: 'ucenter_last_uid',
		cover: 'ucenter_cover',
		avatar: 'ucenter_avatar',
	};

	// 统一存储服务
	import storage from '@/common/storage.js';
	import tabCacheMixin from '@/common/tabCacheMixin.js';
	import networkResumeMixin from '@/common/networkResumeMixin.js';

	export default {
		mixins: [tabCacheMixin, networkResumeMixin],
		tabCacheKeys: ['profile', 'stats', 'isCoachMode', 'beforeAfterList'],
		components: {
			// #ifdef APP
			statusBar,
			// #endif
			EditProfilePopup,
			CoachSettingsPopup,
			StudentsPopup,
			IncomePopup,
			TrainingStatsPopup,
		},

		data() {
			return {
				// 页面状态
				loading: false,
				saving: false,
				refreshing: false,
				loadError: false,
				isCoachMode: false,

				// 本地缓存图片
				localCover: '',
				localAvatar: '',

				// 用户资料
				profile: {
					nickname: '',
					gender: '',
					age: null,
					city: '',
					singleCert: false,
					gyms: [],
					coverUrl: '',
					avatarUrl: '',
					bio: '',
					isCoach: false,
				},

				// 训练统计
				stats: { days: 0, times: 0, calorie: 0 },

				// 对比照片
				beforeAfterList: [],

				// 编辑表单已拆分到 EditProfilePopup 组件

				// 教练相关
				coachSettings: {
					available: true,
					price: 120,
					skillsText: '',
					intro: '',
				},
				students: [],
				incomeSummary: { month: 0, total: 0 },
				incomeRecords: [],

				// 登录状态追踪
				prevLoginState: false,
			};
		},

		computed: {
			/** store 中的用户信息 */
			userInfo() {
				return store.userInfo || {};
			},
			/** 是否已登录 */
			hasLogin() {
				return store.hasLogin;
			},
			/** 显示名称：优先 profile，其次 store，最后兜底 */
			displayName() {
				if (this.profile.nickname) return this.profile.nickname;
				const u = this.userInfo;
				if (this.hasLogin && (u.nickname || u.username || u.mobile)) {
					return u.nickname || u.username || u.mobile;
				}
				if (this.hasLogin) return '新用户';
				return this.$t('mine.notLogged');
			},
			/** 封面图来源：本地优先，其次云端 */
			coverSrc() {
				if (this.localCover) return this.localCover;
				const raw = (this.hasLogin && this.profile.coverUrl)
					|| (this.hasLogin && this.userInfo.cover_file && this.userInfo.cover_file.url)
					|| (this.hasLogin && this.userInfo.cover)
					|| '';
				return raw ? coverUrl(raw) : '';
			},
			/** 头像来源 */
			avatarSrc() {
				if (this.localAvatar) return this.localAvatar;
				const raw = (this.hasLogin && this.profile.avatarUrl)
					|| (this.hasLogin && this.userInfo.avatar_file && this.userInfo.avatar_file.url)
					|| (this.hasLogin && this.userInfo.avatar)
					|| '';
				return raw ? optimizedAvatar(raw) : '';
			},
			/** 个人资料摘要 */
			profileSummary() {
				const parts = [];
				if (this.profile.gender) parts.push(this.profile.gender);
				if (this.profile.age) parts.push(this.profile.age + '岁');
				if (this.profile.city) parts.push('城市 ' + this.profile.city);
				return parts.join(' · ') || '完善你的个人资料';
			},
			/** 是否有健身房标签 */
			hasGyms() {
				return this.profile.gyms && this.profile.gyms.length > 0;
			},
			/** 统计项列表 */
			statsList() {
				const fmt = (v) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v);
				return [
					{ key: 'days', value: this.stats.days, label: '训练天数', display: fmt(this.stats.days), ringClass: '' },
					{ key: 'times', value: this.stats.times, label: '训练次数', display: fmt(this.stats.times), ringClass: '' },
					{ key: 'calorie', value: this.stats.calorie, label: '卡路里', display: fmt(this.stats.calorie) + 'cal', ringClass: 'calorie' },
				];
			},
			/** 模式切换 Tab */
			modeTabs() {
				return [
					{ label: '普通用户', value: false },
					{ label: '教练', value: true },
				];
			},
			/** 根据身份动态生成角色菜单 */
			roleMenus() {
				if (!this.isCoachMode) {
					return [
						{ icon: '📝', title: '我的笔记', handler: () => this.goMyPosts() },
						{ icon: '🤝', title: '我的约练', handler: () => this.goMyMeets() },
					];
				}
				if (!this.isCoachVerified) {
					return [
						{ icon: '🛡️', title: '申请教练认证', handler: () => this.promptCoachApply() },
					];
				}
				return [
					{ icon: '⚙️', title: '接单设置', handler: () => this.goCoachSettings() },
					{ icon: '👥', title: '学员管理', badge: this.students.length || '', handler: () => this.goStudents() },
					{ icon: '💰', title: '收入记录', badge: this.incomeSummary.month ? '¥' + this.incomeSummary.month : '', handler: () => this.goIncome() },
				];
			},
			/** 通用功能菜单 */
			commonMenus() {
				const menus = [
					{ icon: '🪪', title: '完善资料', handler: () => this.openEditProfile() },
					{ icon: '📈', title: '训练数据', handler: () => this.openTrainingStats() },
				];
				if (this.hasLogin) {
					menus.push({ icon: '📍', title: this.$t('mine.signIn'), handler: () => this.signIn() });
				}
				menus.push({ icon: '🔧', title: this.$t('mine.settings'), handler: () => this.goSettings() });
				// #ifdef APP
				menus.push({ icon: 'ℹ️', title: this.$t('mine.about'), handler: () => this.goAbout() });
				// #endif
				return menus;
			},
			isCoachVerified() {
				return !!this.profile.isCoach;
			},
		},

		watch: {
			isCoachMode(val) {
				try {
					storage.set(STORAGE_KEYS.coachMode, val ? '1' : '0');
				} catch (e) {
					console.error('[ucenter] 保存教练模式失败:', e);
				}
			},
		},

		onLoad() {
			this.prevLoginState = this.hasLogin;
			this.initPage();

			// 监听登录成功事件
			uni.$on('uni-id-pages-login-success', () => {
				this.prevLoginState = true;
				// 延迟一帧等待 store.userInfo 更新
				this.$nextTick(() => {
					this.syncUserInfo();
					this.loadRemoteData();
				});
			});

			// 监听退出登录事件
			uni.$on('uni-id-pages-logout', () => {
				this.prevLoginState = false;
				this.resetProfile();
			});
		},

		onUnload() {
			uni.$off('uni-id-pages-login-success');
			uni.$off('uni-id-pages-logout');
		},

		onShow() {
			this.syncUserInfo();
			// 检测登录状态变化：刚登录成功时重新拉取远端数据
			const currentLogin = this.hasLogin;
			if (currentLogin && !this.prevLoginState) {
				this.loadRemoteData();
			}
			this.prevLoginState = currentLogin;
		},

		/** 下拉刷新 */
		async onPullDownRefresh() {
			this.refreshing = true;
			try {
				await this.loadRemoteData();
			} finally {
				this.refreshing = false;
				uni.stopPullDownRefresh();
			}
		},

		/** 分享 */
		onShareAppMessage() {
			return {
				title: `${this.displayName} 的健身主页`,
				path: '/pages/ucenter/ucenter',
				imageUrl: this.coverSrc || undefined,
			};
		},

		methods: {
			onNetworkResume() {
				if (!this.hasLogin) return;
				this.loadRemoteData();
			},
			notifyError(message) {
				uni.showToast({ title: message, icon: 'none' });
			},
			reportError(action, err) {
				const detail = err?.message || err?.errMsg || String(err || '');
				console.error(`[ucenter] ${action} failed:`, detail);
			},
			handleError(message, action, err) {
				this.reportError(action, err);
				this.notifyError(message);
			},
			promptRetry(message, retryFn) {
				uni.showModal({
					title: '操作失败',
					content: message,
					confirmText: '重试',
					cancelText: '取消',
					success: (res) => {
						if (res.confirm && typeof retryFn === 'function') retryFn();
					}
				});
			},
			// 初始化与数据加载
			/** 页面初始化：先读缓存再拉远端 */
			async initPage() {
				this.restoreLocalCache();
				await this.loadRemoteData();
			},

			/** 注销时重置所有数据到默认值 */
			resetProfile() {
				this.profile = {
					nickname: '',
					gender: '',
					age: null,
					city: '',
					singleCert: false,
					gyms: [],
					coverUrl: '',
					avatarUrl: '',
					bio: '',
					isCoach: false,
				};
				this.stats = { days: 0, times: 0, calorie: 0 };
				this.beforeAfterList = [];
				this.students = [];
				this.incomeSummary = { month: 0, total: 0 };
				this.incomeRecords = [];
				this.localCover = '';
				this.localAvatar = '';
			},

			/** 从本地缓存恢复状态 */
			restoreLocalCache() {
				try {
					// 账号切换时清理上一账号的本地封面和头像缓存，避免串号
					const currentUid = this.hasLogin ? this.userInfo._id : '';
					const lastUid = storage.get(STORAGE_KEYS.lastUid, '');
					if (currentUid && lastUid && lastUid !== currentUid) {
						try {
							storage.remove(STORAGE_KEYS.cover);
							storage.remove(STORAGE_KEYS.avatar);
						} catch (_) { /* ignore */ }
						this.localCover = '';
						this.localAvatar = '';
					}
					if (currentUid) {
						storage.set(STORAGE_KEYS.lastUid, currentUid);
					}

					const coachMode = storage.get(STORAGE_KEYS.coachMode, '');
					if (coachMode !== '') this.isCoachMode = coachMode === '1';
					// 未登录时不读取封面和头像缓存，避免展示上一个账号的图片
					if (currentUid) {
						const cover = storage.get(STORAGE_KEYS.cover, '');
						if (cover) this.localCover = cover;
						const avatar = storage.get(STORAGE_KEYS.avatar, '');
						if (avatar) this.localAvatar = avatar;
					} else {
						this.localCover = '';
						this.localAvatar = '';
					}
				} catch (e) {
					console.error('[ucenter] 加载本地缓存失败:', e);
				}
			},

			/** 并行拉取远端数据，带错误追踪 */
			async loadRemoteData() {
				if (!this.hasLogin) {
					this.loading = false;
					this.loadError = false;
					return;
				}
				this.loading = true;
				this.loadError = false;
				try {
					const results = await Promise.allSettled([
						this.fetchProfile(),
						this.fetchStats(),
						this.fetchBeforeAfter(),
						this.fetchCoachSettings(),
						this.fetchStudents(),
						this.fetchIncome(),
					]);
					// 如果全部失败则标记加载失败
					const allFailed = results.every(r => r.status === 'rejected');
					if (allFailed) {
						this.loadError = true;
						this.handleError('数据加载失败，请稍后重试', 'loadRemoteData');
					} else if (results.some(r => r.status === 'rejected')) {
						this.handleError('部分数据加载失败', 'loadRemoteData');
					}
				} catch (e) {
					this.loadError = true;
					this.handleError('数据加载失败，请稍后重试', 'loadRemoteData', e);
				} finally {
					this.loading = false;
				}
			},

			/** 重新加载 */
			retryLoad() {
				this.loadRemoteData();
			},

			/** 登录守卫：未登录时跳转登录页 */
			requireLogin(_action) {
				if (this.hasLogin) return true;
				uni.showModal({
					title: '请先登录',
					content: '此功能需要登录后使用',
					confirmText: '去登录',
					success: (res) => {
						if (res.confirm) this.toUserInfo();
					},
				});
				return false;
			},

			/** 同步 store 中的用户信息到 profile */
			syncUserInfo() {
				const u = this.userInfo;
				if (u.nickname) this.profile.nickname = u.nickname;
				if (u.gender === 1) this.profile.gender = '男';
				if (u.gender === 2) this.profile.gender = '女';
				if (u.age !== undefined && u.age !== null && u.age !== '') this.profile.age = u.age;
				if (u.city) this.profile.city = u.city;
			},

			// 远端数据获取
			async fetchProfile() {
				try {
					const res = await apiService.getProfile();
					if (!res) return;
					const gyms = Array.isArray(res.gyms)
						? res.gyms
						: (res.gyms || '').split(/[,\uFF0C]/).map(g => g.trim()).filter(Boolean);
					this.profile = { ...this.profile, ...res, gyms };
				} catch (e) {
					this.reportError('fetchProfile', e);
					throw e;
				}
			},

			async fetchStats() {
				try {
					const res = await apiService.getStats();
					if (res) this.stats = { ...this.stats, ...res };
				} catch (e) {
					this.reportError('fetchStats', e);
					throw e;
				}
			},

			async fetchBeforeAfter() {
				try {
					const res = await apiService.getBeforeAfter();
					const list = apiService.parseList(res);
					this.beforeAfterList = list;
				} catch (e) {
					this.reportError('fetchBeforeAfter', e);
					throw e;
				}
			},

			async fetchCoachSettings() {
				try {
					const res = await apiService.getCoachSettings();
					if (res) this.coachSettings = { ...this.coachSettings, ...res };
				} catch (e) {
					this.reportError('fetchCoachSettings', e);
					throw e;
				}
			},

			async fetchStudents() {
				try {
					const res = await apiService.getStudents();
					const list = apiService.parseList(res);
					this.students = list;
				} catch (e) {
					this.reportError('fetchStudents', e);
					throw e;
				}
			},

			async fetchIncome() {
				try {
					const res = await apiService.getIncome();
					if (!res) return;
					this.incomeSummary = res.summary || this.incomeSummary;
					this.incomeRecords = apiService.parseList(res.records || res);
				} catch (e) {
					this.reportError('fetchIncome', e);
					throw e;
				}
			},

			// 环形进度
			ringFillStyle(value, key) {
				const max = RING_MAX[key] || 1;
				const percent = Math.min(1, Number(value) / max);
				const deg = percent * 360;
				if (deg <= 0) return { clipPath: 'polygon(0 0, 0 0, 0 0)' };
				const points = [];
				for (let d = 0; d <= deg; d += Math.max(2, Math.ceil(deg / 36))) {
					const rad = (d * Math.PI) / 180;
					points.push(`${(50 + 50 * Math.sin(rad)).toFixed(2)}% ${(50 - 50 * Math.cos(rad)).toFixed(2)}%`);
				}
				if (deg < 360) points.push('50% 50%');
				const poly = `polygon(50% 50%, 50% 0%, ${points.join(', ')})`;
				return { clipPath: poly, WebkitClipPath: poly };
			},

			// 图片上传
			/** 选择并上传封面 */
			onCoverTap() {
				uni.chooseImage({
					count: 1,
					success: (res) => {
						const path = res.tempFilePaths?.[0];
						if (!path) return;
						this.localCover = path;
						this.uploadFile(path, 'cover');
					},
				});
			},

			/** 选择并上传头像 */
			chooseAvatar() {
				uni.chooseImage({
					count: 1,
					success: (res) => {
						const path = res.tempFilePaths?.[0];
						if (!path) return;
						this.localAvatar = path;
						this.uploadFile(path, 'avatar');
					},
				});
			},

			/** 通用图片上传 */
			async uploadFile(filePath, type) {
				const labelMap = { cover: '封面', avatar: '头像' };
				const storageKey = type === 'cover' ? STORAGE_KEYS.cover : STORAGE_KEYS.avatar;
				try {
					const url = await apiService.uploadImage(filePath);
					const profileField = type === 'cover' ? 'coverUrl' : 'avatarUrl';
					const updated = await apiService.updateProfile({ [profileField]: url });
					if (type === 'cover') this.localCover = url;
					else this.localAvatar = url;
					this.syncProfilePatch({ ...(updated || {}), [profileField]: url });
					storage.set(storageKey, url);
					uni.showToast({ title: `${labelMap[type]}已更新`, icon: 'success' });
				} catch (e) {
					this.reportError('uploadFile', e);
					this.promptRetry(`${labelMap[type]}上传失败，是否重试？`, () => this.uploadFile(filePath, type));
				}
			},

			// 训练记录
			async logWorkout() {
				if (!this.requireLogin('logWorkout')) return;
				if (this.saving) return;
				this.saving = true;
				try {
					const res = await apiService.logWorkout();
					if (res) this.stats = { ...this.stats, ...res };
					uni.showToast({ title: '训练已记录', icon: 'success' });
				} catch (e) {
					this.reportError('logWorkout', e);
					this.promptRetry('记录失败，是否重试？', () => this.logWorkout());
				} finally {
					this.saving = false;
				}
			},

			addBeforeAfter() {
				if (!this.requireLogin('addBeforeAfter')) return;
				uni.chooseImage({
					count: 2,
					success: async (res) => {
						if (!res.tempFilePaths || res.tempFilePaths.length < 2) {
							return uni.showToast({ title: '请选择两张图片', icon: 'none' });
						}
						try {
							const [beforeUrl, afterUrl] = await Promise.all([
								apiService.uploadImage(res.tempFilePaths[0]),
								apiService.uploadImage(res.tempFilePaths[1]),
							]);
							const created = await apiService.addBeforeAfter({ before: beforeUrl, after: afterUrl });
							this.beforeAfterList.unshift(created || { before: beforeUrl, after: afterUrl });
							uni.showToast({ title: '已添加对比照', icon: 'success' });
						} catch (e) {
							this.reportError('addBeforeAfter', e);
							this.notifyError('上传失败');
						}
					},
				});
			},

			// 身份切换
			switchMode(val) {
				this.isCoachMode = val;
			},

			// 导航
			toUserInfo() {
				uni.navigateTo({ url: '/uni_modules/uni-id-pages/pages/userinfo/userinfo' });
			},
			goMyPosts() {
				storage.set('discover_open_my_posts', '1');
				storage.set('discover_view_mode', 'mine');
				uni.switchTab({ url: '/pages/grid/discover' });
			},
			goMyMeets() {
				uni.switchTab({ url: '/pages/meet/meet' });
			},
			goSettings() {
				uni.navigateTo({ url: '/pages/ucenter/settings/settings' });
			},
			goAbout() {
				uni.showModal({
					title: '关于 FitMeet',
					content: '关于页面暂未开放，版本与协议信息可在设置中查看。',
					showCancel: false,
				});
			},
			signIn() {
				this.$refs.signIn?.open();
			},

			// 完善资料弹窗
			openEditProfile() {
				if (!this.requireLogin('editProfile')) return;
				this.$refs.editPopup?.open();
			},
			openTrainingStats() {
				if (!this.requireLogin('openTrainingStats')) return;
				this.$refs.trainingStatsPopup?.open();
			},

			onProfileSaved(data) {
				this.syncProfilePatch(data);
			},

			syncProfilePatch(data = {}) {
				this.profile = { ...this.profile, ...data };
				try {
					const userStore = useUserStore();
					userStore.updateProfile({ ...this.profile, ...data });
				} catch (e) {
					console.warn('[ucenter] sync profile store failed:', e);
				}
			},

			// 教练功能
			goCoachSettings() {
				if (!this.isCoachVerified) {
					this.promptCoachApply();
					return;
				}
				this.$refs.coachPopup?.open();
			},

			onCoachSettingsSaved(data) {
				this.coachSettings = { ...this.coachSettings, ...data };
			},

			goStudents() {
				if (!this.isCoachVerified) {
					this.promptCoachApply();
					return;
				}
				this.fetchStudents();
				this.$refs.studentsPopup?.open();
			},

			async chatWithStudent(student) {
				if (!this.isCoachMode) {
					this.notifyError('仅教练身份可与学员私聊');
					return;
				}
				if (!this.requireLogin('chatWithStudent')) return;
				try {
					const conv = await chatService.getOrCreateConversation(student.id, {
						nickname: student.name,
						avatar: student.avatar,
					});
					const convId = conv?.conversationId || student.id;
					uni.navigateTo({
						url: `/pages/chat/chat?conversationId=${convId}&userId=${student.id}`,
						fail: () => uni.showToast({ title: '功能开发中', icon: 'none' }),
					});
				} catch (e) {
					const msg = e?.message || '';
					if (msg.includes('403') || msg.includes('无权限')) {
						this.notifyError('暂无权限访问该会话');
						return;
					}
					this.handleError('打开聊天失败', 'chatWithStudent', e);
				}
			},

			goIncome() {
				if (!this.isCoachVerified) {
					this.promptCoachApply();
					return;
				}
				this.fetchIncome();
				this.$refs.incomePopup?.open();
			},
			promptCoachApply() {
				uni.showModal({
					title: '教练认证',
					content: '教练功能需要完成资料并通过平台审核。请先完善个人资料，审核通过后可开启接单设置。',
					confirmText: '完善资料',
					cancelText: '稍后',
					success: (res) => {
						if (res.confirm) this.openEditProfile();
					},
				});
			},
		},
	};
</script>

<style lang="scss" scoped>
	@import "@/uni.scss";

	.profile-page {
		min-height: 100vh;
		background-color: $neu-dark-bg;
		padding-bottom: calc(120rpx + constant(safe-area-inset-bottom));
		padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
	}

	/* ===== 封面区域 ===== */
	.cover-section {
		position: relative;
	}
	.cover-wrap {
		position: relative;
		width: 100%;
		height: 380rpx;
		background: linear-gradient(135deg, #0D1B2A 0%, #132136 100%);
		overflow: hidden;
	}
	.cover-img {
		width: 100%;
		height: 100%;
		display: block;
		filter: brightness(0.8);
		transition: filter 0.4s ease;
	}
	.cover-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #0D1B2A 0%, #132136 60%, rgba(0,229,255,0.08) 100%);
	}
	.cover-mask {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 65%;
		background: linear-gradient(to top, $neu-dark-bg, transparent);
		pointer-events: none;
	}
	.cover-actions {
		position: absolute;
		right: 32rpx;
		bottom: 32rpx;
		display: flex;
		gap: 20rpx;
	}
	.cover-btn {
		width: 64rpx;
		height: 64rpx;
		border-radius: 50%;
		@include glass-card(rgba(10,22,40,0.6), 10px);
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(0,229,255,0.15);
		transition: transform 0.2s ease, border-color 0.2s ease;
		&:active {
			transform: scale(0.9);
			border-color: rgba(0,229,255,0.3);
		}
	}

	/* ===== 刷新指示器 ===== */
	.refresh-indicator {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 3;
	}
	.refresh-spinner {
		width: 48rpx;
		height: 48rpx;
		border: 4rpx solid rgba(255, 255, 255, 0.2);
		border-top-color: #00E5FF;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* ===== 用户资料卡片 ===== */
	.profile-card {
		margin: -80rpx 24rpx 32rpx;
		@include sl-card;
		padding: 32rpx;
		position: relative;
		z-index: 2;
		animation: cardSlideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
	}
	@keyframes cardSlideUp {
		from { opacity: 0; transform: translateY(24rpx); }
		to   { opacity: 1; transform: translateY(0); }
	}
	.profile-header {
		display: flex;
		align-items: center;
	}
	.avatar-wrap {
		flex-shrink: 0;
		position: relative;
	}
	.avatar {
		width: 128rpx;
		height: 128rpx;
		border-radius: 50%;
		border: 4rpx solid rgba(0,229,255,0.2);
		background: rgba(255, 255, 255, 0.05);
		box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.4), 0 0 0 4rpx rgba(0,229,255,0.06);
		transition: border-color 0.3s ease;
	}
	.default-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.avatar-badge {
		position: absolute;
		right: 0;
		bottom: 0;
		width: 36rpx;
		height: 36rpx;
		border-radius: 50%;
		background: #00E5FF;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 4rpx solid $neu-dark-bg;
	}
	.profile-main {
		flex: 1;
		min-width: 0;
		margin-left: 32rpx;
	}
	.row-name {
		display: flex;
		align-items: center;
		gap: 16rpx;
		flex-wrap: wrap;
		margin-bottom: 8rpx;
	}
	.nickname {
		font-size: 36rpx;
		font-weight: 700;
		color: #ffffff;
		text-shadow: 0 2rpx 4rpx rgba(0,0,0,0.5);
	}
	.vip-tag {
		padding: 4rpx 16rpx;
		border-radius: 20rpx;
		background: linear-gradient(135deg, rgba(255,183,77,0.25) 0%, rgba(255,183,77,0.1) 100%);
		border: 1rpx solid rgba(255,183,77,0.3);
	}
	.vip-text {
		font-size: 20rpx;
		color: #FFB74D;
		font-weight: 600;
	}
	.row-meta {
		margin-top: 8rpx;
	}
	.meta-text {
		font-size: 26rpx;
		color: rgba(255, 255, 255, 0.7);
	}
	.login-hint {
		color: #00E5FF;
		font-weight: 500;
	}
	.profile-action {
		padding: 16rpx;
		@include neu-btn;
		width: 64rpx;
		height: 64rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: transform 0.2s ease;
		&:active {
			transform: scale(0.9) rotate(15deg);
		}
	}
	.gym-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 16rpx;
		margin-top: 24rpx;
		padding-top: 24rpx;
		border-top: 1rpx solid $glass-border;
	}
	.gym-tag {
		font-size: 22rpx;
		color: rgba(255, 255, 255, 0.9);
		background: rgba(0, 229, 255, 0.1);
		padding: 8rpx 20rpx;
		border-radius: 24rpx;
		border: 1rpx solid rgba(0, 229, 255, 0.18);
		transition: transform 0.2s ease;
		&:active {
			transform: scale(0.95);
		}
	}

	/* ===== 数据统计卡片 ===== */
	.stats-card {
		@include sl-card;
		margin: 0 24rpx 32rpx;
		padding: 32rpx;
		animation: cardSlideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.1s both;
	}
	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 32rpx;
	}
	.card-title {
		font-size: 30rpx;
		font-weight: 600;
		color: #ffffff;
	}
	.card-link {
		font-size: 26rpx;
		color: #00E5FF;
	}
	.stats-row {
		display: flex;
		justify-content: space-around;
		margin-bottom: 16rpx;
	}
	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.ring-wrap {
		position: relative;
		width: 110rpx;
		height: 110rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 16rpx;
	}
	.ring-bg {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		border: 8rpx solid rgba(255, 255, 255, 0.05);
		box-sizing: border-box;
	}
	.ring-fill {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		border: 8rpx solid #00E5FF;
		box-sizing: border-box;
		transition: clip-path 0.6s cubic-bezier(0.4, 0, 0.2, 1);
		filter: drop-shadow(0 0 6rpx rgba(0, 229, 255, 0.6));
	}
	.ring-fill.calorie {
		border-color: #FFB74D;
		filter: drop-shadow(0 0 6rpx rgba(255, 183, 77, 0.6));
	}
	.ring-num {
		font-size: 28rpx;
		font-weight: 700;
		color: #ffffff;
		z-index: 1;
	}
	.stat-label {
		font-size: 24rpx;
		color: rgba(255, 255, 255, 0.6);
	}

	/* ===== Before / After ===== */
	.ba-section {
		border-top: 1rpx solid $glass-border;
		padding-top: 24rpx;
		margin-top: 24rpx;
	}
	.ba-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20rpx;
	}
	.ba-title {
		font-size: 28rpx;
		color: rgba(255, 255, 255, 0.8);
	}
	.ba-swiper {
		height: 240rpx;
		border-radius: 20rpx;
		overflow: hidden;
		background: rgba(0, 0, 0, 0.2);
	}
	.ba-item {
		display: flex;
		height: 100%;
		padding: 16rpx;
		box-sizing: border-box;
	}
	.ba-half {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0 10rpx;
	}
	.ba-label {
		font-size: 22rpx;
		color: rgba(255, 255, 255, 0.6);
		margin-bottom: 10rpx;
	}
	.ba-img {
		width: 100%;
		flex: 1;
		border-radius: 16rpx;
		background: rgba(255, 255, 255, 0.05);
		min-height: 0;
	}

	/* ===== 身份切换 ===== */
	.mode-bar {
		display: flex;
		margin: 0 24rpx 32rpx;
		@include neu-pressed;
		border-radius: 24rpx;
		padding: 8rpx;
	}
	.mode-item {
		flex: 1;
		text-align: center;
		padding: 20rpx;
		font-size: 28rpx;
		color: rgba(255, 255, 255, 0.6);
		border-radius: 20rpx;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}
	.mode-item.active {
		@include neu-btn;
		background: #00E5FF;
		color: #0A1628;
		font-weight: 600;
		box-shadow: 0 4rpx 16rpx rgba(0, 229, 255, 0.3);
	}

	/* ===== 菜单卡片 ===== */
	.menu-card {
		@include sl-card;
		margin: 0 24rpx 32rpx;
		overflow: hidden;
		animation: cardSlideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.2s both;
	}
	.menu-item {
		display: flex;
		align-items: center;
		padding: 32rpx;
		border-bottom: 1rpx solid rgba(255, 255, 255, 0.05);
		transition: background 0.2s ease, padding-left 0.2s ease;
	}
	.menu-item:last-child {
		border-bottom: none;
	}
	.menu-item:active {
		background: rgba(0, 229, 255, 0.05);
		padding-left: 36rpx;
	}
	.menu-icon {
		font-size: 40rpx;
		margin-right: 24rpx;
		width: 56rpx;
		text-align: center;
	}
	.menu-title {
		flex: 1;
		font-size: 30rpx;
		color: rgba(255, 255, 255, 0.9);
	}
	.menu-extra {
		margin-right: 16rpx;
	}
	.menu-badge {
		font-size: 24rpx;
		color: #00E5FF;
		background: rgba(0, 229, 255, 0.1);
		padding: 6rpx 16rpx;
		border-radius: 16rpx;
	}
	.more-card {
		margin-bottom: 64rpx;
	}

	/* ===== 閫氱敤鎸夐挳 ===== */
	.btn-ghost {
		flex: 1;
		@include neu-btn;
		background: transparent;
		box-shadow: none;
		border: 1px solid $glass-border;
		height: 80rpx;
		line-height: 80rpx;
		border-radius: 40rpx;
		color: rgba(255, 255, 255, 0.9);
		font-size: 28rpx;
	}
	.btn-ghost:active {
		background: rgba(0, 229, 255, 0.05);
	}
	.btn-ghost.btn-sm {
		flex: none;
		height: 64rpx;
		line-height: 64rpx;
		padding: 0 32rpx;
		font-size: 26rpx;
		border-radius: 32rpx;
	}

	/* ===== 弹窗表单 ===== */
	.edit-box {
		width: 680rpx;
		@include glass-card($sl-card-bg-solid);
		border-radius: 32rpx;
		padding: 40rpx;
	}
	.sheet-box {
		width: 100%;
		@include glass-card($sl-card-bg-solid);
		border-radius: 32rpx 32rpx 0 0;
		padding: 40rpx 32rpx calc(40rpx + env(safe-area-inset-bottom));
	}
	.edit-header,
	.sheet-header {
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		margin-bottom: 32rpx;
	}
	.edit-title,
	.sheet-title {
		font-size: 32rpx;
		font-weight: 600;
		color: #ffffff;
	}
	.edit-close {
		position: absolute;
		right: 0;
		padding: 12rpx;
	}
	.edit-row {
		display: flex;
		align-items: center;
		gap: 20rpx;
		margin-bottom: 24rpx;
	}
	.edit-label {
		width: 140rpx;
		font-size: 28rpx;
		color: rgba(255, 255, 255, 0.7);
		flex-shrink: 0;
	}
	.edit-input {
		flex: 1;
		height: 88rpx;
		line-height: 88rpx;
		border-radius: 16rpx;
		@include neu-pressed;
		background: rgba(0,0,0,0.2);
		padding: 0 24rpx;
		color: #ffffff;
		font-size: 28rpx;
		box-sizing: border-box;
		border: 1rpx solid transparent;
		transition: border-color 0.2s;
	}
	.edit-input:focus {
		border-color: rgba(0, 229, 255, 0.5);
	}
	.edit-input.picker {
		color: rgba(255, 255, 255, 0.9);
	}
	.edit-avatar-wrap {
		display: flex;
		align-items: center;
		gap: 20rpx;
	}
	.edit-avatar-preview {
		width: 100rpx;
		height: 100rpx;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid $glass-border;
	}
	.edit-avatar-empty {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.edit-avatar-tip {
		font-size: 26rpx;
		color: #00E5FF;
	}
	.edit-textarea {
		flex: 1;
		min-height: 160rpx;
		border-radius: 16rpx;
		@include neu-pressed;
		background: rgba(0,0,0,0.2);
		padding: 20rpx;
		color: #ffffff;
		font-size: 28rpx;
		border: 1rpx solid transparent;
	}
	.edit-actions {
		display: flex;
		gap: 24rpx;
		margin-top: 40rpx;
	}
	.btn-cancel,
	.btn-submit {
		flex: 1;
		height: 88rpx;
		line-height: 88rpx;
		border-radius: 44rpx;
		font-size: 30rpx;
		border: none;
		font-weight: 600;
	}
	.btn-cancel {
		background: transparent;
		color: rgba(255, 255, 255, 0.6);
		border: 1px solid $glass-border;
	}
	.btn-submit {
		@include sl-btn-primary;
	}

	/* ===== 学员列表 ===== */
	.student-list {
		display: flex;
		flex-direction: column;
		gap: 20rpx;
		max-height: 50vh;
		overflow-y: auto;
	}
	.student-item {
		display: flex;
		align-items: center;
		gap: 20rpx;
		@include sl-card;
		padding: 24rpx;
	}
	.student-avatar {
		width: 80rpx;
		height: 80rpx;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
	}
	.student-info {
		flex: 1;
		min-width: 0;
	}
	.student-name {
		display: block;
		font-size: 28rpx;
		color: #fff;
		font-weight: 500;
	}
	.student-meta {
		font-size: 24rpx;
		color: rgba(255, 255, 255, 0.5);
		margin-top: 6rpx;
	}

	/* ===== 鏀跺叆 ===== */
	.income-summary {
		display: flex;
		gap: 20rpx;
		margin-bottom: 24rpx;
	}
	.income-item {
		flex: 1;
		@include neu-pressed;
		background: rgba(0,0,0,0.2);
		border-radius: 20rpx;
		padding: 24rpx;
	}
	.income-label {
		display: block;
		font-size: 24rpx;
		color: rgba(255, 255, 255, 0.5);
		margin-bottom: 10rpx;
	}
	.income-value {
		font-size: 36rpx;
		font-weight: 700;
		color: #00E5FF;
	}
	.income-list {
		display: flex;
		flex-direction: column;
		gap: 16rpx;
		max-height: 45vh;
		overflow-y: auto;
	}
	.income-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: rgba(255, 255, 255, 0.04);
		padding: 24rpx;
		border-radius: 16rpx;
		border-bottom: 1px solid rgba(255,255,255,0.05);
	}
	.income-title {
		display: block;
		font-size: 28rpx;
		color: rgba(255, 255, 255, 0.9);
	}
	.income-date {
		font-size: 24rpx;
		color: rgba(255, 255, 255, 0.4);
		margin-top: 6rpx;
	}
	.income-amount {
		font-size: 30rpx;
		color: #00E5FF;
		font-weight: 600;
	}

	/* ===== 绌虹姸鎬?===== */
	.empty-tip {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60rpx 0;
		gap: 20rpx;
	}
	.empty-text {
		font-size: 28rpx;
		color: rgba(255, 255, 255, 0.3);
	}

	/* ===== 楠ㄦ灦灞?===== */
	.skeleton-card {
		pointer-events: none;
	}
	.skeleton-circle {
		border-radius: 50%;
		background: #132136;
	}
	.skeleton-line {
		border-radius: 8rpx;
		background: #132136;
	}
	.skeleton-pulse {
		background: linear-gradient(90deg, #132136 25%, #1a2d4a 50%, #132136 75%);
		background-size: 200% 100%;
		animation: skeletonShimmer 1.6s ease-in-out infinite;
	}
	@keyframes skeletonShimmer {
		0%   { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}

	/* ===== 加载失败重试 ===== */
	.error-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 80rpx 32rpx;
		gap: 24rpx;
	}
	.error-text {
		font-size: 28rpx;
		color: rgba(255, 255, 255, 0.4);
	}
	.btn-retry {
		margin-top: 16rpx;
		height: 72rpx;
		line-height: 72rpx;
		padding: 0 48rpx;
		border-radius: 36rpx;
		@include neu-btn;
		color: #00E5FF;
		border: 1rpx solid rgba(0, 229, 255, 0.25);
		font-weight: 600;
	}
	.btn-retry:active {
		background: rgba(0, 229, 255, 0.1);
	}

	/* ===== BA 绌虹姸鎬佸紩瀵?===== */
	.ba-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16rpx;
		padding: 40rpx;
		border-radius: 20rpx;
		background: rgba(255, 255, 255, 0.03);
		border: 2rpx dashed rgba(0, 229, 255, 0.12);
	}
	.ba-empty-text {
		font-size: 26rpx;
		color: rgba(255, 255, 255, 0.3);
	}
</style>
