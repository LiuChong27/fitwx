/**
 * Pinia 用户状态管理
 *
 * 解决问题：
 * 1. 登录态通过 uni.setStorageSync 散布在 App.vue / meet.vue / discover.vue 等 5+ 处
 * 2. 同一字段有 fit_user_id / user_id / uid 多个 key，极易不一致
 * 3. 无响应式全局状态，组件间通信依赖 globalData 或事件总线
 *
 * 用法：
 *   import { useUserStore } from '@/store/user.js';
 *   const userStore = useUserStore();
 *   userStore.syncFromLogin();   // 登录后同步
 *   userStore.userId;            // 唯一 user id
 *   userStore.logout();          // 退出清理
 */
import { defineStore } from 'pinia';
import storage from '@/common/storage.js';
import { getAuthSnapshot } from '@/common/auth.js';

export const useUserStore = defineStore('user', {
	state: () => ({
		/** 用户 ID（唯一来源） */
		userId: '',
		/** 用户昵称 */
		nickname: '',
		/** 头像 URL */
		avatarUrl: '',
		/** 微信 openid */
		openid: '',
		/** uni-id token */
		token: '',
		/** 是否已登录 */
		isLoggedIn: false,
		/** 完整用户资料对象 */
		profile: null,
	}),

	getters: {
		/** 是否处于有效登录态 */
		hasLogin() {
			return this.isLoggedIn && !!this.userId;
		},
		/** 是否已绑定手机号 */
		hasMobile() {
			return !!(this.profile && this.profile.mobile);
		},
		/** 用户信息摘要（供组件展示） */
		userInfo() {
			return {
				_id: this.userId,
				nickname: this.nickname,
				avatarUrl: this.avatarUrl,
				openid: this.openid,
			};
		},
	},

	actions: {
		/**
		 * 登录成功后调用：从 uni-id-pages store 同步到 Pinia + Storage
		 */
		syncFromLogin() {
			try {
				const snapshot = getAuthSnapshot();
				const merged = snapshot.userInfo || {};
				const uid = snapshot.userId || '';
				const wxOpenid = merged.wx_openid || {};
				const openid = wxOpenid['mp-weixin'] || wxOpenid.mp || merged.openid || '';
				const token = snapshot.token || '';

				this.userId = uid;
				this.nickname = merged.nickname || merged.username || '';
				this.avatarUrl = merged.avatar_file?.url || merged.avatarUrl || merged.avatar || '';
				this.openid = openid;
				this.token = token;
				this.isLoggedIn = !!snapshot.hasLogin;
				this.profile = snapshot.hasLogin ? { ...merged, _id: uid } : null;

				if (!snapshot.hasLogin) {
					this.userId = '';
					this.nickname = '';
					this.avatarUrl = '';
					this.openid = '';
					this.token = '';
					this.isLoggedIn = false;
					this.profile = null;
					storage.remove('userId');
					storage.remove('openid');
					storage.remove('token');
					storage.remove('userInfo');
					storage.set('isLoggedIn', false);
					return;
				}

				if (uid) storage.set('userId', uid);
				if (openid) storage.set('openid', openid);
				if (token) storage.set('token', token);
				storage.set('isLoggedIn', true);
				storage.set('userInfo', this.profile);
			} catch (e) {
				console.warn('[userStore] syncFromLogin failed:', e);
			}
		},

		/**
		 * 页面 onShow 时从 Storage 恢复（冷启动/页面切换）
		 */
		restoreFromStorage() {
			try {
				const snapshot = getAuthSnapshot();
				const snapshotUserInfo = snapshot.userInfo && Object.keys(snapshot.userInfo).length ? snapshot.userInfo : null;
				const userInfo = snapshotUserInfo || storage.get('userInfo', null);
				this.userId = snapshot.userId || storage.get('userId', '');
				this.openid = userInfo?.openid || storage.get('openid', '');
				this.token = snapshot.token || storage.get('token', '') || uni.getStorageSync('uni_id_token') || '';
				this.isLoggedIn = !!snapshot.hasLogin;
				if (userInfo && Object.keys(userInfo).length) {
					this.nickname = userInfo.nickname || userInfo.username || '';
					this.avatarUrl = userInfo.avatar_file?.url || userInfo.avatarUrl || userInfo.avatar || '';
					this.profile = { ...userInfo, _id: this.userId || userInfo._id || '' };
				} else if (!snapshot.hasLogin) {
					this.openid = '';
					this.token = '';
					this.nickname = '';
					this.avatarUrl = '';
					this.profile = null;
				}
			} catch (e) {
				console.warn('[userStore] restoreFromStorage failed:', e);
			}
		},

		/**
		 * 更新用户资料（编辑页保存后调用）
		 */
		updateProfile(profile) {
			if (!profile) return;
			this.nickname = profile.nickname || this.nickname;
			this.avatarUrl = profile.avatar_file?.url || profile.avatarUrl || this.avatarUrl;
			this.profile = { ...this.profile, ...profile };
			storage.set('userInfo', this.profile);
		},

		/**
		 * 退出登录：清理所有状态 + 存储
		 */
		logout() {
			this.userId = '';
			this.nickname = '';
			this.avatarUrl = '';
			this.openid = '';
			this.token = '';
			this.isLoggedIn = false;
			this.profile = null;
			storage.clearUserScoped();
		},
	},
});
