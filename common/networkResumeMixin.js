/**
 * 统一网络状态监听：
 * - 初始化 networkType / isOffline
 * - 监听断网 -> 联网切换
 * - 联网恢复时回调 onNetworkResume()
 */
export default {
	data() {
		return {
			networkType: 'unknown',
			isOffline: false,
			_networkBound: false,
			_networkChangeHandler: null,
		};
	},
	onLoad() {
		this.setupNetworkResumeListener();
	},
	onUnload() {
		this.teardownNetworkResumeListener();
	},
	methods: {
		syncNetworkStatus() {
			if (typeof uni.getNetworkType !== 'function') return;
			uni.getNetworkType({
				success: ({ networkType }) => {
					this.networkType = networkType || 'unknown';
					this.isOffline = networkType === 'none';
				},
			});
		},
		setupNetworkResumeListener() {
			this.syncNetworkStatus();
			if (this._networkBound || typeof uni.onNetworkStatusChange !== 'function') return;

			this._networkChangeHandler = (res = {}) => {
				const wasOffline = !!this.isOffline;
				this.networkType = res.networkType || 'unknown';
				this.isOffline = res.isConnected === false || res.networkType === 'none';

				if (wasOffline && !this.isOffline && typeof this.onNetworkResume === 'function') {
					this.onNetworkResume(res);
				}
			};

			this._networkBound = true;
			uni.onNetworkStatusChange(this._networkChangeHandler);
		},
		teardownNetworkResumeListener() {
			if (!this._networkBound) return;
			if (typeof uni.offNetworkStatusChange === 'function' && this._networkChangeHandler) {
				uni.offNetworkStatusChange(this._networkChangeHandler);
			}
			this._networkBound = false;
			this._networkChangeHandler = null;
		},
	},
};
