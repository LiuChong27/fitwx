/**
 * 聊天服务 — 基于 fit-ucenter-api 云函数
 * 提供会话管理与消息收发能力
 *
 * 注意：内部调用复用 apiService.callUcenter，避免重复封装。
 *       敏感词 / 长度校验统一使用 contentSecurity 模块。
 */
import { apiService } from '@/services/apiService.js';
import { validateText, ContentType } from '@/common/contentSecurity.js';

/** 复用 apiService.callUcenter，避免重复代码 */
const callUcenter = (action, params) => apiService.callUcenter(action, params);

// NOTE: keep both default and named export for compatibility
const chatService = {
	/**
	 * 获取或创建与目标用户的会话
	 * @param {string} targetUserId 目标用户ID
	 * @param {object} userInfo     目标用户信息快照 { nickname, avatar }
	 * @returns {{ conversationId: string, isNew: boolean }}
	 */
	async getOrCreateConversation(targetUserId, _userInfo = {}, context = null) {
		if (!targetUserId) {
			console.warn('[chatService] targetUserId is required');
			return null;
		}
		try {
			const result = await callUcenter('getOrCreateConversation', {
				targetUserId,
				context
			});
			return result;
		} catch (err) {
			console.warn('[chatService] getOrCreateConversation failed:', err);
			throw err;
		}
	},

	/**
	 * 发送消息
	 * @param {string} conversationId 会话ID
	 * @param {string} content        消息内容
	 * @param {string} type           消息类型 text|image|system
	 * @throws {Error} 输入校验失败时抛出错误
	 */
	async sendMessage(conversationId, content, type = 'text') {
		if (!conversationId) {
			console.warn('[chatService] conversationId is required');
			return null;
		}

		// 文本消息执行输入校验（统一使用 contentSecurity 模块）
		if (type === 'text') {
			const check = validateText(content, ContentType.CHAT);
			if (!check.valid) {
				uni.showToast({ title: check.reason, icon: 'none' });
				throw new Error(check.reason);
			}
			content = check.sanitized;
		} else if (!content) {
			console.warn('[chatService] content is required');
			return null;
		}

		try {
			return await callUcenter('sendMessage', {
				conversationId,
				content,
				type,
			});
		} catch (err) {
			console.warn('[chatService] sendMessage failed:', err);
			throw err;
		}
	},

	/**
	 * 获取消息历史
	 * @param {string} conversationId 会话ID
	 * @param {number} page           页码
	 * @param {number} pageSize       每页条数
	 */
	async getMessages(conversationId, page = 1, pageSize = 30, since = null) {
		if (!conversationId) return [];
		try {
			return await callUcenter('getMessages', {
				conversationId,
				page,
				pageSize,
				since,
			});
		} catch (err) {
			console.warn('[chatService] getMessages failed:', err);
			throw err;
		}
	},

	/** 心跳并查询对端在线状态 */
	async heartbeat(targetUserId) {
		try {
			return await callUcenter('heartbeat', { targetUserId });
		} catch (err) {
			console.warn('[chatService] heartbeat failed:', err);
			return null;
		}
	},

	/** 获取未读消息数 */
	async getUnreadCount() {
		try {
			const res = await callUcenter('getUnreadCount');
			return res.count || 0;
		} catch (err) {
			console.warn('[chatService] getUnreadCount failed:', err);
			return 0;
		}
	},

	/** 获取当前用户的会话列表 */
	async listConversations(limit = 50) {
		try {
			return await callUcenter('listConversations', { limit });
		} catch (err) {
			console.warn('[chatService] listConversations failed:', err);
			throw err;
		}
	},

	/** 清空当前用户所有私信未读数 */
	async markAllConversationsRead() {
		try {
			return await callUcenter('markAllConversationsRead');
		} catch (err) {
			console.warn('[chatService] markAllConversationsRead failed:', err);
			throw err;
		}
	},
};

export { chatService };
export default chatService;
