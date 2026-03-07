<template>
	<view class="chat-container">
		<!-- #ifdef APP-PLUS -->
		<view class="status_bar">
			<view class="top_view"></view>
		</view>
		<!-- #endif -->

		<view class="chat-header" role="banner">
			<view class="back" role="button" aria-label="返回" @click="goBack">
				<text class="back-icon">←</text>
			</view>
			<view class="header-center">
				<text class="title">{{ targetUser.nickname || '聊天' }}</text>
				<text class="online-hint" v-if="isOnline" aria-label="对方在线">在线</text>
			</view>
			<view class="more" role="button" aria-label="更多操作" @click="showActions">
				<text>⋯</text>
			</view>
		</view>

		<!-- 消息列表 -->
		<scroll-view
			class="chat-list"
			scroll-y
			role="log"
			aria-label="消息列表"
			:scroll-into-view="scrollAnchor"
			:scroll-with-animation="scrollAnimate"
			@scrolltoupper="loadHistory"
		>
			<!-- 加载更多提示 -->
			<view class="load-more" v-if="hasMore" @click="loadHistory">
				<text v-if="loadingHistory" class="hint">加载中...</text>
				<text v-else class="hint">点击加载更多</text>
			</view>
			<view class="load-more" v-else-if="messages.length > 0">
				<text class="hint">没有更多消息了</text>
			</view>

			<!-- 消息气泡 -->
			<view
				v-for="(msg, index) in messages"
				:key="msg._id || msg.tempId || index"
				:id="'msg-' + (msg._id || msg.tempId)"
			>
				<!-- 时间分割线 -->
				<view class="time-divider" v-if="showTimeDivider(index)">
					<text class="time-text">{{ formatTime(msg.create_date) }}</text>
				</view>
				<!-- 系统消息 -->
				<view v-if="msg.type === 'system'" class="system-msg">
					<text>{{ msg.content }}</text>
				</view>
				<!-- 普通消息 -->
				<view v-else class="message-item" :class="{ me: msg.sender_id === myUserId }">
					<image
						class="avatar"
						:src="msg.sender_id === myUserId ? myAvatar : targetUser.avatar || '/static/tabbar/me.png'"
						mode="aspectFill"
					/>
					<view class="msg-body">
						<view
							class="bubble"
							:class="{ sending: msg._sending, failed: msg._failed }"
							@longpress="openMsgActions(msg, index)"
						>
							<image
								v-if="msg.type === 'image'"
								class="msg-image"
								:src="msg.content"
								mode="widthFix"
								@click="previewImage(msg.content)"
							/>
							<text v-else>{{ msg.content }}</text>
						</view>
						<!-- 发送失败重试 -->
						<view v-if="msg._failed" class="retry-btn" role="button" aria-label="重新发送" @click="retrySend(msg)">
							<text class="retry-icon">⟳</text>
						</view>
						<view v-else-if="msg.sender_id === myUserId" class="msg-status">
							<text v-if="msg._sending" class="status-text">发送中...</text>
							<text v-else-if="msg.read_at || msg.read" class="status-text delivered">已读</text>
							<text v-else class="status-text delivered">已发送</text>
						</view>
					</view>
				</view>
			</view>

			<!-- 底部锚点 -->
			<view id="msg-bottom"></view>
		</scroll-view>

		<!-- 输入区 -->
		<view class="input-area">
			<view class="toolbar">
				<text class="toolbar-btn" role="button" aria-label="表情" @click="toggleEmojiPicker">😊</text>
				<text class="toolbar-btn" role="button" aria-label="发送图片" @click="pickImage">📎</text>
			</view>
			<input
				class="input-box"
				v-model="inputText"
				placeholder="发送消息..."
				aria-label="输入消息"
				confirm-type="send"
				:adjust-position="true"
				@confirm="sendMessage"
				@focus="onInputFocus"
			/>
			<button
				class="send-btn"
				:class="{ active: inputText.trim() }"
				@click="sendMessage"
				:disabled="!inputText.trim() || sending"
			>发送</button>
		</view>

		<!-- 表情选择 -->
		<view v-if="showEmojiPicker" class="emoji-panel" role="listbox" aria-label="表情选择">
			<view
				v-for="emoji in emojiList"
				:key="emoji"
				class="emoji-item"
				role="option"
				:aria-label="emoji"
				@click="appendEmoji(emoji)"
			>{{ emoji }}</view>
		</view>
	</view>
</template>

<script>
	import chatService from '@/services/chatService.js';
	import { store } from '@/uni_modules/uni-id-pages/common/store.js';

	export default {
		data() {
			return {
				targetUser: {
					userId: '',
					nickname: '',
					avatar: ''
				},
				conversationId: '',
				messages: [],
				inputText: '',
				scrollAnchor: '',
				scrollAnimate: false,
				myUserId: '',
				myAvatar: '/static/tabbar/me.png',
				// 分页
				page: 1,
				pageSize: 30,
				hasMore: true,
				loadingHistory: false,
				// 状态
				sending: false,
				isOnline: false,
				pollTimer: null,
				lastMsgDate: 0,
				heartbeatTimer: null,
				showEmojiPicker: false,
				emojiList: ['😀','😁','😂','🤣','😊','😍','🤔','😎','😭','😡','👍','🙏','✨','🎉','❤️']
			};
		},
		onLoad(options) {
			// 获取当前登录用户信息
			this.initMyInfo();

			const userId = options.userId;
			if (!userId) {
				uni.showToast({ title: '用户不存在', icon: 'none' });
				setTimeout(() => uni.navigateBack(), 1500);
				return;
			}

			this.targetUser.userId = userId;

			// 从缓存恢复目标用户信息
			try {
				const storageModule = require('@/common/storage.js');
				const cached = storageModule.default.get(`user_${userId}`, '');
				if (cached) {
					const user = typeof cached === 'string' ? JSON.parse(cached) : cached;
					this.targetUser = { ...this.targetUser, ...user };
				}
			} catch (e) {
				console.error(e);
			}

			// 从 options 补充 nickname（navigate 时可能传入）
			if (options.nickname) {
				this.targetUser.nickname = decodeURIComponent(options.nickname);
			}

			// 初始化会话并加载消息
			this.initConversation();
		},
		onShow() {
			// 页面可见时开启轮询
			this.startPolling();
			this.startPresenceHeartbeat();
		},
		onHide() {
			this.stopPolling();
			this.stopPresenceHeartbeat();
		},
		onUnload() {
			this.stopPolling();
			this.stopPresenceHeartbeat();
		},
		methods: {
			/** 获取当前登录用户信息 */
			initMyInfo() {
				try {
					const userInfo = uniCloud.getCurrentUserInfo();
					if (userInfo && userInfo.uid) {
						this.myUserId = userInfo.uid;
					}
				} catch (e) {
					console.warn('获取用户信息失败', e);
				}
				// 从 uni-id-pages 存储获取头像
				try {
					const stored = uni.getStorageSync('uni-id-pages-userInfo');
					if (stored && stored.avatar_file && stored.avatar_file.url) {
						this.myAvatar = stored.avatar_file.url;
					}
				} catch (e) { /* ignore */ }
			},

			/** 初始化会话：获取/创建 conversationId → 加载历史消息 */
			async initConversation() {
				uni.showLoading({ title: '加载中...' });
				try {
					const result = await chatService.getOrCreateConversation(
						this.targetUser.userId,
						{
							nickname: this.targetUser.nickname,
							avatar: this.targetUser.avatar
						}
					);
					if (result && result.conversationId) {
						this.conversationId = result.conversationId;
						await this.loadMessages();
					}
				} catch (err) {
					console.error('初始化会话失败', err);
					uni.showToast({ title: '加载失败，请重试', icon: 'none' });
				} finally {
					uni.hideLoading();
				}
			},

			/** 加载消息（首次加载最新一页） */
			async loadMessages() {
				if (!this.conversationId) return;
				try {
					const list = await chatService.getMessages(this.conversationId, 1, this.pageSize);
					// 云端返回按 create_date desc，翻转为正序
					this.messages = (list || []).reverse();
					this.page = 1;
					this.hasMore = list && list.length >= this.pageSize;
					// 记录最后消息时间（用于轮询增量拉取）
					if (this.messages.length > 0) {
						this.lastMsgDate = this.messages[this.messages.length - 1].create_date || 0;
					}
					this.$nextTick(() => {
						this.scrollAnchor = 'msg-bottom';
					});
				} catch (err) {
					console.error('加载消息失败', err);
				}
			},

			/** 上拉加载更多历史消息 */
			async loadHistory() {
				if (this.loadingHistory || !this.hasMore || !this.conversationId) return;
				this.loadingHistory = true;
				try {
					const nextPage = this.page + 1;
					const list = await chatService.getMessages(this.conversationId, nextPage, this.pageSize);
					if (!list || list.length === 0) {
						this.hasMore = false;
						return;
					}
					// 旧消息倒序后插到头部
					const older = list.reverse();
					// 记录当前第一条消息 id 用于滚动定位
					const firstMsgId = this.messages.length > 0 ? (this.messages[0]._id || this.messages[0].tempId) : null;
					this.messages = [...older, ...this.messages];
					this.page = nextPage;
					this.hasMore = list.length >= this.pageSize;
					// 滚动到加载前的第一条消息位置
					if (firstMsgId) {
						this.$nextTick(() => {
							this.scrollAnimate = false;
							this.scrollAnchor = 'msg-' + firstMsgId;
						});
					}
				} catch (err) {
					console.error('加载历史失败', err);
					uni.showToast({ title: '加载失败', icon: 'none' });
				} finally {
					this.loadingHistory = false;
				}
			},

			/** 发送文本消息 */
			async sendMessage() {
				const text = this.inputText.trim();
				if (!text) return;
				await this.sendPayload(text, 'text');
				this.showEmojiPicker = false;
			},

			/** 公共发送入口，兼容文本与图片 */
			async sendPayload(content, type = 'text') {
				if (this.sending) return;
				if (!content || !this.conversationId) {
					uni.showToast({ title: '会话未就绪', icon: 'none' });
					return;
				}

				this.sending = true;
				const tempId = 'temp_' + Date.now();
				const tempMsg = {
					tempId,
					conversation_id: this.conversationId,
					sender_id: this.myUserId,
					content,
					type,
					create_date: Date.now(),
					_sending: true,
					_failed: false,
					_delivered: false,
					_read: false
				};
				this.messages.push(tempMsg);
				if (type === 'text') this.inputText = '';
				this.scrollToBottom();

				try {
					const result = await chatService.sendMessage(this.conversationId, content, type);
					const idx = this.messages.findIndex(m => m.tempId === tempId);
					if (idx > -1) {
						this.messages.splice(idx, 1, {
							...result,
							_id: result._id || tempId,
							sender_id: this.myUserId,
							_sending: false,
							_failed: false,
							_delivered: !!result.delivered_at,
							_read: !!result.read_at
						});
					}
					this.lastMsgDate = result.create_date || Date.now();
				} catch (err) {
					console.error('发送失败', err);
					const idx = this.messages.findIndex(m => m.tempId === tempId);
					if (idx > -1) {
						this.messages[idx]._sending = false;
						this.messages[idx]._failed = true;
					}
					uni.showToast({ title: '发送失败', icon: 'none' });
				} finally {
					this.sending = false;
				}
			},

			/** 重发失败消息 */
			async retrySend(msg) {
				const idx = this.messages.findIndex(m => m.tempId === msg.tempId);
				if (idx === -1) return;
				this.messages[idx]._sending = true;
				this.messages[idx]._failed = false;

				try {
					const result = await chatService.sendMessage(this.conversationId, msg.content, msg.type || 'text');
					this.messages.splice(idx, 1, {
						...result,
						_id: result._id || msg.tempId,
						sender_id: this.myUserId,
						_sending: false,
						_failed: false
					});
					this.lastMsgDate = result.create_date || Date.now();
				} catch (err) {
					this.messages[idx]._sending = false;
					this.messages[idx]._failed = true;
					uni.showToast({ title: '重发失败', icon: 'none' });
				}
			},

			/** 轮询新消息（增量 since） */
			startPolling() {
				this.stopPolling();
				this.pollTimer = setInterval(() => {
					this.pollNewMessages();
				}, 5000);
			},
			stopPolling() {
				if (this.pollTimer) {
					clearInterval(this.pollTimer);
					this.pollTimer = null;
				}
			},
			async pollNewMessages() {
				if (!this.conversationId) return;
				try {
					const list = await chatService.getMessages(this.conversationId, 1, this.pageSize, this.lastMsgDate);
					if (!list || list.length === 0) return;
					const newMsgs = list; // 后端 since 时按时间升序
					const byId = new Map(this.messages.filter(m => m._id).map(m => [m._id, m]));
					newMsgs.forEach(m => {
						const exist = m._id ? byId.get(m._id) : null;
						if (exist) {
							exist.read_at = m.read_at;
							exist.delivered_at = m.delivered_at;
							exist.read = m.read;
						} else if (m.sender_id !== this.myUserId) {
							this.messages.push(m);
						}
					});
					if (newMsgs.length > 0) {
						this.lastMsgDate = newMsgs[newMsgs.length - 1].create_date || this.lastMsgDate;
						this.scrollToBottom();
					}
				} catch (err) {
					// 静默失败，不影响用户体验
					console.warn('轮询新消息失败', err);
				}
			},

			/** 选择图片并发送（带校验） */
			async pickImage() {
				try {
					const res = await uni.chooseImage({ count: 1, sizeType: ['compressed'] });
					const file = res.tempFiles && res.tempFiles[0];
					const filePath = res.tempFilePaths?.[0];
					if (!filePath) return;
					const size = file?.size || 0;
					const maxSize = 5 * 1024 * 1024; // 5MB
					if (size > maxSize) {
						uni.showToast({ title: '图片过大，需小于5MB', icon: 'none' });
						return;
					}

					uni.showLoading({ title: '发送中...' });
					const cloudPath = `chat/${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;
					const upload = await uniCloud.uploadFile({ filePath, cloudPath });
					const url = upload.fileID || upload.filePath || upload.url;
					if (!url) throw new Error('上传失败');
					await this.sendPayload(url, 'image');
				} catch (err) {
					console.error(err);
					uni.showToast({ title: '发送图片失败', icon: 'none' });
				} finally {
					uni.hideLoading();
				}
			},

			toggleEmojiPicker() {
				this.showEmojiPicker = !this.showEmojiPicker;
			},
			appendEmoji(emoji) {
				this.inputText += emoji;
			},

			previewImage(src) {
				const urls = this.messages.filter(m => m.type === 'image').map(m => m.content);
				uni.previewImage({ current: src, urls });
			},

			openMsgActions(msg, index) {
				const actions = [];
				if (msg.type === 'text') actions.push('复制');
				if (msg._failed) actions.push('重新发送');
				actions.push('删除');
				uni.showActionSheet({
					itemList: actions,
					success: (res) => {
						const action = actions[res.tapIndex];
						if (action === '复制') {
							uni.setClipboardData({ data: msg.content });
						} else if (action === '重新发送') {
							this.retrySend(msg);
						} else if (action === '删除') {
							this.messages.splice(index, 1);
						}
					}
				});
			},

			/** presence 心跳，1 分钟内视为在线 */
			startPresenceHeartbeat() {
				this.stopPresenceHeartbeat();
				this.heartbeatTimer = setInterval(() => {
					this.pingOnline();
				}, 20000);
				this.pingOnline();
			},
			stopPresenceHeartbeat() {
				if (this.heartbeatTimer) {
					clearInterval(this.heartbeatTimer);
					this.heartbeatTimer = null;
				}
			},
			async pingOnline() {
				try {
					const res = await chatService.heartbeat(this.targetUser.userId);
					if (res && typeof res.targetOnline === 'boolean') {
						this.isOnline = res.targetOnline;
					}
				} catch (err) {
					console.warn('heartbeat failed', err);
				}
			},

			/** 滚动到底部 */
			scrollToBottom() {
				this.$nextTick(() => {
					this.scrollAnimate = true;
					this.scrollAnchor = '';
					setTimeout(() => {
						this.scrollAnchor = 'msg-bottom';
					}, 50);
				});
			},

			onInputFocus() {
				setTimeout(() => this.scrollToBottom(), 300);
			},

			/** 时间分割线：与上一条消息间隔 > 5分钟时显示 */
			showTimeDivider(index) {
				if (index === 0) return true;
				const curr = this.messages[index]?.create_date || 0;
				const prev = this.messages[index - 1]?.create_date || 0;
				return curr - prev > 5 * 60 * 1000;
			},

			/** 格式化时间 */
			formatTime(ts) {
				if (!ts) return '';
				const d = new Date(ts);
				const now = new Date();
				const pad = n => String(n).padStart(2, '0');
				const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
				// 今天
				if (d.toDateString() === now.toDateString()) return timeStr;
				// 昨天
				const yesterday = new Date(now);
				yesterday.setDate(yesterday.getDate() - 1);
				if (d.toDateString() === yesterday.toDateString()) return `昨天 ${timeStr}`;
				// 今年
				if (d.getFullYear() === now.getFullYear()) {
					return `${d.getMonth() + 1}月${d.getDate()}日 ${timeStr}`;
				}
				return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${timeStr}`;
			},

			goBack() {
				uni.navigateBack();
			},

			showActions() {
				uni.showActionSheet({
					itemList: ['清空聊天记录', '举报'],
					success: (res) => {
						if (res.tapIndex === 0) {
							uni.showModal({
								title: '提示',
								content: '确定清空聊天记录？',
								success: (r) => {
									if (r.confirm) {
										this.messages = [];
									}
								}
							});
						} else if (res.tapIndex === 1) {
							uni.showToast({ title: '已收到举报', icon: 'none' });
						}
					}
				});
			}
		}
	};
</script>

<style lang="scss">
	@import "@/uni.scss";

	.chat-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background-color: $neu-dark-bg;
	}
	.status_bar {
		height: var(--status-bar-height);
		width: 100%;
		background-color: $sl-surface;
	}
	.top_view {
		height: var(--status-bar-height);
		width: 100%;
		position: fixed;
		top: 0;
		background-color: $sl-surface;
	}
	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 44px;
		padding: 0 15px;
		background-color: $sl-surface;
		border-bottom: 1rpx solid $glass-border;
		box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.15);
	}
	.back {
		padding: 5px 10px 5px 0;
		transition: opacity 0.2s;
		&:active { opacity: 0.6; }
	}
	.back-icon {
		font-size: 20px;
		color: rgba(255,255,255,0.85);
	}
	.header-center {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.title {
		font-size: 17px;
		font-weight: 600;
		color: #fff;
	}
	.online-hint {
		font-size: 10px;
		color: #00E676;
		margin-top: 1px;
		position: relative;
		padding-left: 14px;
		&::before {
			content: '';
			position: absolute;
			left: 0;
			top: 50%;
			transform: translateY(-50%);
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: #00E676;
			animation: onlinePulse 2s ease-in-out infinite;
		}
	}
	@keyframes onlinePulse {
		0%, 100% { box-shadow: 0 0 0 0 rgba(0, 230, 118, 0.4); }
		50% { box-shadow: 0 0 0 4px rgba(0, 230, 118, 0); }
	}
	.more {
		padding: 5px 0 5px 10px;
		font-size: 20px;
		color: rgba(255,255,255,0.85);
		transition: opacity 0.2s;
		&:active { opacity: 0.6; }
	}

	/* 消息列表 */
	.chat-list {
		flex: 1;
		padding: 10px 15px;
		box-sizing: border-box;
	}
	.load-more {
		text-align: center;
		padding: 15px 0 5px;
	}
	.hint {
		font-size: 12px;
		color: rgba(255,255,255,0.45);
	}

	/* 时间分割线 */
	.time-divider {
		text-align: center;
		padding: 18px 0 12px;
	}
	.time-text {
		font-size: 11px;
		color: rgba(255,255,255,0.5);
		background-color: rgba(255,255,255,0.06);
		padding: 4px 10px;
		border-radius: 12px;
		backdrop-filter: blur(4px);
	}

	/* 系统消息 */
	.system-msg {
		text-align: center;
		padding: 8px 0;
		font-size: 12px;
		color: rgba(255,255,255,0.45);
	}

	/* 消息气泡 */
	.message-item {
		display: flex;
		margin-bottom: 18px;
		align-items: flex-start;
		animation: msgFadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);
		&.me {
			flex-direction: row-reverse;
			.bubble {
				background: linear-gradient(135deg, #00E5FF 0%, #00B0FF 100%);
				color: #0A1628;
				border-radius: 18px 4px 18px 18px;
				box-shadow: 0 4rpx 20rpx rgba(0, 229, 255, 0.2);
			}
			.msg-body {
				flex-direction: row-reverse;
			}
		}
	}
	@keyframes msgFadeIn {
		from { opacity: 0; transform: translateY(8px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	.avatar {
		width: 42px;
		height: 42px;
		border-radius: 14px;
		background-color: $sl-card-bg-solid;
		flex-shrink: 0;
		border: 1px solid $glass-border;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}
	.msg-body {
		display: flex;
		align-items: center;
		max-width: 70%;
		margin: 0 10px;
	}
	.bubble {
		padding: 12px 14px;
		background-color: $sl-card-bg-solid;
		color: rgba(255,255,255,0.92);
		border-radius: 4px 18px 18px 18px;
		font-size: 15px;
		line-height: 1.55;
		word-break: break-all;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.2);
		border: 1px solid $glass-border;
		transition: opacity 0.3s, transform 0.2s;
		&.sending {
			opacity: 0.55;
			animation: sendingPulse 1.2s ease-in-out infinite;
		}
		&.failed {
			opacity: 0.8;
			border-color: rgba(255, 82, 82, 0.3);
		}
	}
	@keyframes sendingPulse {
		0%, 100% { opacity: 0.55; }
		50% { opacity: 0.75; }
	}
	.msg-image {
		max-width: 220px;
		border-radius: 12px;
		display: block;
	}
	.retry-btn {
		margin: 0 6px;
		flex-shrink: 0;
		transition: transform 0.2s;
		&:active { transform: rotate(180deg); }
	}
	.retry-icon {
		font-size: 20px;
		color: #FF5252;
	}
	.msg-status {
		margin-top: 4px;
		margin-left: 6px;
	}
	.status-text {
		font-size: 11px;
		color: rgba(255,255,255,0.4);
	}
	.status-text.delivered {
		color: rgba(0, 229, 255, 0.65);
	}

	/* 输入区 */
	.input-area {
		display: flex;
		align-items: center;
		padding: 10px 12px;
		background-color: $sl-surface;
		border-top: 1rpx solid $glass-border;
		padding-bottom: calc(10px + env(safe-area-inset-bottom));
		box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.15);
	}
	.toolbar {
		display: flex;
		align-items: center;
		margin-right: 8px;
	}
	.toolbar-btn {
		width: 34px;
		height: 34px;
		line-height: 34px;
		text-align: center;
		border-radius: 12px;
		background-color: rgba(255,255,255,0.06);
		border: 1px solid $glass-border;
		margin-right: 6px;
		font-size: 18px;
		transition: all 0.2s;
		&:active {
			background-color: rgba(0, 229, 255, 0.1);
			transform: scale(0.92);
		}
	}
	.input-box {
		flex: 1;
		height: 38px;
		background-color: rgba(255,255,255,0.06);
		border-radius: 19px;
		padding: 0 16px;
		font-size: 16px;
		color: #fff;
		border: 1px solid $glass-border;
		transition: border-color 0.3s, box-shadow 0.3s;
		&:focus {
			border-color: rgba(0, 229, 255, 0.3);
			box-shadow: 0 0 0 3rpx rgba(0, 229, 255, 0.08);
		}
	}
	.send-btn {
		margin-left: 8px;
		height: 38px;
		line-height: 38px;
		font-size: 14px;
		background-color: rgba(255,255,255,0.08);
		color: rgba(255,255,255,0.45);
		border-radius: 19px;
		padding: 0 18px;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		&::after { border: none; }
		&.active {
			background: linear-gradient(135deg, #00E5FF 0%, #00B0FF 100%);
			color: #0A1628;
			font-weight: 600;
			box-shadow: 0 4rpx 20rpx rgba(0, 229, 255, 0.35);
			transform: scale(1.02);
		}
	}
	.emoji-panel {
		display: flex;
		flex-wrap: wrap;
		padding: 10px 12px;
		background-color: $sl-surface;
		border-top: 1rpx solid $glass-border;
		animation: panelSlideUp 0.25s ease-out;
	}
	@keyframes panelSlideUp {
		from { opacity: 0; transform: translateY(20px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	.emoji-item {
		width: 12.5%;
		padding: 8px 0;
		text-align: center;
		font-size: 22px;
		border-radius: 8px;
		transition: background 0.15s;
		&:active {
			background: rgba(0, 229, 255, 0.1);
		}
	}
</style>
