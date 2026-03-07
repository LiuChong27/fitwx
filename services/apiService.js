import { store } from '@/uni_modules/uni-id-pages/common/store.js';
import { callFunctionWithToken } from '@/services/cloudCall.js';
import cache from '@/common/cacheManager.js';
import perfMonitor from '@/common/perfMonitor.js';
import { validateText, validateImageFile, ContentType } from '@/common/contentSecurity.js';

/** 生成请求 ID 用于性能计时 */
let _reqSeq = 0
function nextReqId(action) {
    return `${action}_${++_reqSeq}_${Date.now()}`
}

// NOTE: keep both default and named export for compatibility
const apiService = {
    // ==================== 云函数调用封装 ====================
    async callCloud(action, params = {}) {
        const rid = nextReqId(action)
        perfMonitor.markApiStart(rid, action)
        try {
            const res = await callFunctionWithToken({
                name: 'fit-discover-api',
                data: { action, params }
            });
            perfMonitor.markApiEnd(rid)
            if (res.result && res.result.code === 0) {
                return res.result.data;
            }
            throw new Error(res.result?.msg || '请求失败');
        } catch (err) {
            perfMonitor.markApiEnd(rid)
            console.warn(`Cloud function ${action} failed:`, err);
            throw err;
        }
    },

    /** notification 云函数调用 */
    async callNotification(action, params = {}) {
        const rid = nextReqId('noti_' + action)
        perfMonitor.markApiStart(rid, action)
        try {
            const res = await callFunctionWithToken({
                name: 'fit-notification-api',
                data: { action, params }
            });
            perfMonitor.markApiEnd(rid)
            if (res.result && res.result.code === 0) {
                return res.result.data;
            }
            throw new Error(res.result?.msg || '请求失败');
        } catch (err) {
            perfMonitor.markApiEnd(rid)
            console.warn(`[notification] ${action} failed:`, err);
            throw err;
        }
    },

    /** ucenter 云函数调用 */
    async callUcenter(action, params = {}) {
        const rid = nextReqId('uc_' + action)
        perfMonitor.markApiStart(rid, action)
        try {
            const res = await callFunctionWithToken({
                name: 'fit-ucenter-api',
                data: { action, params }
            });
            perfMonitor.markApiEnd(rid)
            if (res.result && res.result.code === 0) {
                return res.result.data;
            }
            throw new Error(res.result?.msg || '请求失败');
        } catch (err) {
            perfMonitor.markApiEnd(rid)
            console.warn(`[ucenter] ${action} failed:`, err);
            throw err;
        }
    },

    /**
     * 资料完整度判断：用于“发布约�?发布动态”解�?
     * 必填（最小集合）：昵称、头像、性别、年龄、擅长项�?gyms)、个人简�?bio)
     */
    isProfileComplete(profile = {}) {
        const nickname = String(profile.nickname || '').trim();
        const avatar = String(profile.avatarUrl || '').trim();
        const gender = String(profile.gender || '').trim();
        const age = Number(profile.age);
        const gyms = Array.isArray(profile.gyms) ? profile.gyms.filter(Boolean) : [];
        const bio = String(profile.bio || '').trim();
        if (!nickname) return false;
        if (!avatar) return false;
        if (!gender) return false;
        if (!Number.isFinite(age) || age <= 0) return false;
        if (!gyms.length) return false;
        if (!bio) return false;
        return true;
    },

    async getFeedList(params = {}) {
        return await this.getDiscoverList(params);
    },

    async getDiscoverList(params = {}) {
        const {
            page = 1,
            pageSize = 15,
            gender = 'all',
            type = 'all',
            level = 'all',
            distanceKm,
        } = params;

        const numericDistance = Number(distanceKm);
        const requestData = {
            page,
            pageSize,
            gender,
            type,
            level
        };
        if (Number.isFinite(numericDistance)) {
            requestData.distanceKm = numericDistance;
        }

        try {
            return await this.callCloud('getFeedList', requestData);
        } catch (err) {
            console.warn('getDiscoverList callCloud failed:', err);
            throw err;
        }
    },

    async getPublicProfile(userId) {
        if (!userId) throw new Error('userId is required');
        return await this.callCloud('getPublicProfile', { userId });
    },
    parseList(res) {
        if (!res) return [];
        if (Array.isArray(res)) return res;
        if (Array.isArray(res.list)) return res.list;
        if (Array.isArray(res.data)) return res.data;
        if (Array.isArray(res.records)) return res.records;
        return [];
    },
    async likeFeed(id, liked) {
        try {
            await this.callCloud('likeFeed', { feedId: id, liked });
            return true;
        } catch (err) {
            console.warn('likeFeed failed:', err);
            throw err;
        }
    },
    async collectFeed(id, collected) {
        try {
            await this.callCloud('collectFeed', { feedId: id, collected });
            return true;
        } catch (err) {
            console.warn('collectFeed failed:', err);
            throw err;
        }
    },
    async sendInvite(toUserId, form) {
        // 邀约消息内容校验
        if (form.message) {
            const check = validateText(form.message, ContentType.INVITE);
            if (!check.valid) {
                uni.showToast({ title: check.reason, icon: 'none' });
                throw new Error(check.reason);
            }
            form = { ...form, message: check.sanitized };
        }
        await this.callCloud('sendInvite', {
            toUserId,
            toNickname: form.nickname || '',
            date: form.date,
            place: form.place,
            message: form.message
        });
        return true;
    },

    async removeFeed(feedId) {
        if (!feedId) throw new Error('feedId is required');
        return await this.callCloud('removeFeed', { feedId });
    },
    async commentFeed(id, content) {
        // 评论内容校验
        const check = validateText(content, ContentType.COMMENT);
        if (!check.valid) {
            uni.showToast({ title: check.reason, icon: 'none' });
            throw new Error(check.reason);
        }
        try {
            await this.callCloud('addComment', { feedId: id, content: check.sanitized });
            return true;
        } catch (err) {
            console.warn('commentFeed failed:', err);
            throw err;
        }
    },
    async giftFeed(id, giftCode, toUserId) {
        try {
            await this.callCloud('sendGift', { feedId: id, toUserId, giftCode });
            return true;
        } catch (err) {
            console.warn('giftFeed failed:', err);
            throw err;
        }
    },
    async publishFeed(payload = {}) {
        // 发布内容校验（文字部分）
        if (payload.content) {
            const check = validateText(payload.content, ContentType.FEED);
            if (!check.valid) {
                uni.showToast({ title: check.reason, icon: 'none' });
                throw new Error(check.reason);
            }
            payload = { ...payload, content: check.sanitized };
        }
        return await this.callCloud('publishFeed', {
            content: payload.content,
            type: payload.type,
            location: payload.location,
            location_address: payload.location_address || payload.address || '',
            location_geo: payload.location_geo || null,
            photo: payload.photo || payload.cover,
            tags: payload.tags,
            level: payload.level,
            gender: payload.gender,
            lat: payload.lat,
            lng: payload.lng
        });
    },

    async publishDiscover(payload = {}) {
        return await this.publishFeed(payload);
    },
    async publishMeet(payload) {
        return await this.callCloud('publishMeet', payload);
    },
    async getMyLeads() {
        return await this.callCloud('getMyLeads');
    },
    async getMyRequests() {
        return await this.callCloud('getMyRequests');
    },
    async updateLeadStatus(id, status) {
        return await this.callCloud('updateLeadStatus', { id, status });
    },
    async deleteLead(id) {
        return await this.callCloud('deleteLead', { id });
    },
    async updateRequestStatus(id, status) {
        return await this.callCloud('updateRequestStatus', { id, status });
    },
    async deleteRequest(id) {
        return await this.callCloud('deleteRequest', { id });
    },
    async sendCoachInvite(payload) {
        return await this.callCloud('sendCoachInvite', payload);
    },
    async getProfile() {
        return await cache.getOrFetch('user_profile', () => this.callUcenter('getProfile'), { ttl: 120 });
    },
    async updateProfile(payload) {
        return await cache.optimisticUpdate('user_profile', payload, () => this.callUcenter('updateProfile', payload));
    },
    async uploadImage(filePath) {
        // ── 上传前校验（扩展名 + 文件大小） ──
        let fileSize
        try {
            // #ifdef H5
            // H5 端无法直接获取本地文件大小，跳过大小检查
            // #endif
            // #ifdef APP-PLUS || MP
            const fileInfo = await new Promise((resolve, reject) => {
                uni.getFileInfo({
                    filePath,
                    success: resolve,
                    fail: reject,
                })
            })
            fileSize = fileInfo.size
            // #endif
        } catch (_) {
            // 获取失败不阻塞上传，但打印警告
            console.warn('[upload] 无法获取文件大小，跳过大小检查')
        }

        const imgCheck = validateImageFile(filePath, fileSize)
        if (!imgCheck.valid) {
            uni.showToast({ title: imgCheck.reason, icon: 'none' })
            throw new Error(imgCheck.reason)
        }

        // 优先使用 uniCloud.uploadFile 上传到云存储
        // 云存储侧自动通过 imageOptimizer 按需转 WebP
        try {
            const ext = filePath.split('.').pop() || 'jpg'
            const uploadRes = await uniCloud.uploadFile({
                filePath,
                cloudPath: `fit-images/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`,
            });
            return uploadRes.fileID;
        } catch (err) {
            console.warn('[upload] 云存储上传失败', err);
            throw new Error('上传失败');
        }
    },
    async getStats() {
        return await cache.getOrFetch('user_stats', () => this.callUcenter('getStats'), { ttl: 60 });
    },
    async logWorkout(params = {}) {
        return await this.callUcenter('logWorkout', params);
    },
    async getBeforeAfter() {
        return await cache.getOrFetch('before_after', () => this.callUcenter('getBeforeAfter'), { ttl: 120 });
    },
    async addBeforeAfter(entry) {
        return await this.callUcenter('addBeforeAfter', entry);
    },
    async getCoachSettings() {
        return await cache.getOrFetch('coach_settings', () => this.callUcenter('getCoachSettings'), { ttl: 180 });
    },
    async updateCoachSettings(settings) {
        return await cache.optimisticUpdate('coach_settings', settings, () => this.callUcenter('updateCoachSettings', settings));
    },
    async getStudents() {
        return await this.callUcenter('getStudents');
    },
    async getIncome() {
        return await this.callUcenter('getIncome');
    },

    // ==================== 通知中心 ====================
    /** 分页拉取通知列表 */
    async getNotifications(payload = {}) {
        const { page = 1, pageSize = 20, lastId } = payload;
        const params = { page, pageSize };
        if (lastId) params.lastId = lastId;
        return await this.callNotification('getNotifications', params);
    },

    /** 批量标记已读 */
    async readNotifications(ids = []) {
        if (!ids.length) return { success: true, unreadCount: 0 };
        return await this.callNotification('readNotifications', { ids });
    },

    /** 获取未读数（轻量） */
    async getUnreadCount() {
        return await this.callNotification('getUnreadCount');
    },

    /** 创建通知（供其他模块调用） */
    async createNotification({ toUserId, type, title, content, meetId, meetTitle }) {
        return await this.callNotification('createNotification', {
            toUserId, type, title, content, meetId, meetTitle
        });
    },

    /** 全部标记已读 */
    async markAllNotificationsRead() {
        return await this.callNotification('markAllRead');
    }
};

export { apiService };
export default apiService;
