import { store } from '@/uni_modules/uni-id-pages/common/store.js';
import { callFunctionWithToken } from '@/services/cloudCall.js';
import cache from '@/common/cacheManager.js';
import perfMonitor from '@/common/perfMonitor.js';
import { validateText, validateImageFile, ContentType } from '@/common/contentSecurity.js';
import { ensureLoggedIn } from '@/common/auth.js';

/** 生成请求 ID 用于性能计时 */
let _reqSeq = 0
function nextReqId(action) {
    return `${action}_${++_reqSeq}_${Date.now()}`
}

function getCurrentUserId() {
    const info = store.userInfo || {}
    return info._id || ''
}

function withUserScope(key) {
    const uid = getCurrentUserId()
    return uid ? `${key}_${uid}` : key
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

    /** meet 云函数调用 */
    async callMeet(action, params = {}) {
        const rid = nextReqId('meet_' + action)
        perfMonitor.markApiStart(rid, action)
        try {
            const res = await callFunctionWithToken({
                name: 'fit-meet-api',
                data: { action, params }
            });
            perfMonitor.markApiEnd(rid)
            if (res.result && res.result.code === 0) {
                return res.result.data;
            }
            throw new Error(res.result?.msg || '请求失败');
        } catch (err) {
            perfMonitor.markApiEnd(rid)
            console.warn(`[meet] ${action} failed:`, err);
            throw err;
        }
    },

    /** maintenance 云函数调用 */
    async callMaintenance(action, params = {}) {
        const rid = nextReqId('maint_' + action)
        perfMonitor.markApiStart(rid, action)
        try {
            const res = await callFunctionWithToken({
                name: 'fit-maintenance-api',
                data: { action, params }
            });
            perfMonitor.markApiEnd(rid)
            if (res.result && res.result.code === 0) {
                return res.result.data;
            }
            throw new Error(res.result?.msg || '请求失败');
        } catch (err) {
            perfMonitor.markApiEnd(rid)
            console.warn(`[maintenance] ${action} failed:`, err);
            throw err;
        }
    },

    /** report 云函数调用 */
    async callReport(action, params = {}) {
        const rid = nextReqId('report_' + action)
        perfMonitor.markApiStart(rid, action)
        try {
            const res = await callFunctionWithToken({
                name: 'fit-report-api',
                data: { action, params }
            });
            perfMonitor.markApiEnd(rid)
            if (res.result && res.result.code === 0) {
                return res.result.data;
            }
            throw new Error(res.result?.msg || '请求失败');
        } catch (err) {
            perfMonitor.markApiEnd(rid)
            console.warn(`[report] ${action} failed:`, err);
            throw err;
        }
    },

    /**
     * 资料完整度判断：用于“发布约练/发布动态”解锁。
     * 必填（最小集合）：昵称、头像、性别、年龄、擅长项目(gyms)、个人简介(bio)
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
            lat,
            lng,
            userId,
            status,
        } = params;

        const numericDistance = Number(distanceKm);
        const numericLat = Number(lat);
        const numericLng = Number(lng);
        const requestData = {
            page,
            pageSize,
            gender,
            type,
            level
        };
        if (userId) {
            requestData.userId = userId;
        }
        if (status !== undefined && status !== null && status !== '') {
            requestData.status = status;
        }
        if (Number.isFinite(numericDistance)) {
            requestData.distanceKm = numericDistance;
        }
        if (Number.isFinite(numericLat) && Number.isFinite(numericLng)) {
            requestData.lat = numericLat;
            requestData.lng = numericLng;
        }

        try {
            return await this.callCloud('getFeedList', requestData);
        } catch (err) {
            console.warn('getDiscoverList callCloud failed:', err);
            throw err;
        }
    },

    async getPublicProfile(userId) {
        if (!userId) throw new Error('缺少用户ID');
        return await this.callCloud('getPublicProfile', { userId });
    },
    async getFeedDetail(feedId) {
        if (!feedId) throw new Error('缺少动态ID');
        return await this.callCloud('getFeedDetail', { feedId });
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
            feedId: form.feedId || '',
            toUserId,
            toNickname: form.nickname || '',
            date: form.date,
            place: form.place,
            message: form.message,
            lat: form.lat,
            lng: form.lng
        });
        return true;
    },

    async removeFeed(feedId) {
        if (!feedId) throw new Error('缺少动态ID');
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
    async getFeedComments(id, page = 1, pageSize = 20) {
        if (!id) throw new Error('缺少动态ID');
        try {
            const list = await this.callCloud('getComments', { feedId: id, page, pageSize });
            return Array.isArray(list) ? list : [];
        } catch (err) {
            console.warn('getFeedComments failed:', err);
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
    async getMyFeedStats() {
        return await this.callCloud('getMyFeedStats');
    },
    async submitReport(payload = {}) {
        return await this.callReport('createReport', payload)
    },
    async getReportStats() {
        return await this.callReport('getReportStats')
    },
    async getReportList(payload = {}) {
        return await this.callReport('getReportList', payload)
    },
    async getReportDetail(reportId) {
        return await this.callReport('getReportDetail', { reportId })
    },
    async handleReport(payload = {}) {
        return await this.callReport('handleReport', payload)
    },
    async getNeedsList(payload = {}) {
        return await this.callMeet('getNeedsList', payload);
    },
    async publishNeed(payload = {}) {
        return await this.callMeet('publishNeed', payload);
    },
    async updateNeed(payload = {}) {
        return await this.callMeet('updateNeed', payload);
    },
    async removeNeed(needId) {
        return await this.callMeet('removeNeed', { needId });
    },
    async getCoachList(payload = {}) {
        return await this.callMeet('getCoachList', payload);
    },
    async bookCoach(payload = {}) {
        return await this.callMeet('bookCoach', payload);
    },
    async updateBookingStatus(bookingId, status) {
        return await this.callMeet('updateBookingStatus', { bookingId, status });
    },
    async publishMeet(payload) {
        return await this.publishNeed(payload);
    },
    async getMyMeetStats() {
        return await this.callMeet('getMyMeetStats');
    },
    async getMyMeetList(payload = {}) {
        return await this.callMeet('getMyMeetList', payload);
    },
    async getPendingFeedList(payload = {}) {
        return await this.callMaintenance('getPendingFeedList', payload);
    },
    async reviewFeed(payload = {}) {
        return await this.callMaintenance('reviewFeed', payload);
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
        return await this.bookCoach(payload);
    },
    clearUcenterCache() {
        ;[
            withUserScope('user_profile'),
            withUserScope('user_stats'),
            withUserScope('before_after'),
            withUserScope('coach_settings'),
        ].forEach((key) => cache.remove(key))
    },
    async getProfile() {
        return await cache.getOrFetch(withUserScope('user_profile'), () => this.callUcenter('getProfile'), { ttl: 120 });
    },
    async updateProfile(payload) {
        const key = withUserScope('user_profile')
        const current = cache.get(key) || {}
        const nextProfile = { ...current, ...payload }
        return await cache.optimisticUpdate(key, nextProfile, async () => {
            const res = await this.callUcenter('updateProfile', payload)
            return { ...nextProfile, ...(res || {}) }
        });
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
        return await cache.getOrFetch(withUserScope('user_stats'), () => this.callUcenter('getStats'), { ttl: 60 });
    },
    async logWorkout(params = {}) {
        const res = await this.callUcenter('logWorkout', params);
        cache.remove(withUserScope('user_stats'));
        return res;
    },
    async getBeforeAfter() {
        return await cache.getOrFetch(withUserScope('before_after'), () => this.callUcenter('getBeforeAfter'), { ttl: 120 });
    },
    async addBeforeAfter(entry) {
        const res = await this.callUcenter('addBeforeAfter', entry);
        cache.remove(withUserScope('before_after'));
        return res;
    },
    async getCoachSettings() {
        return await cache.getOrFetch(withUserScope('coach_settings'), () => this.callUcenter('getCoachSettings'), { ttl: 180 });
    },
    async updateCoachSettings(settings) {
        const key = withUserScope('coach_settings')
        const current = cache.get(key) || {}
        const nextSettings = { ...current, ...settings }
        return await cache.optimisticUpdate(key, nextSettings, async () => {
            const res = await this.callUcenter('updateCoachSettings', settings)
            return { ...nextSettings, ...(res || {}) }
        });
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
        if (!ensureLoggedIn({ silent: true })) {
            throw new Error('请先登录');
        }
        const { page = 1, pageSize = 20, lastId } = payload;
        const params = { page, pageSize };
        if (lastId) params.lastId = lastId;
        return await this.callNotification('getNotifications', params);
    },

    /** 批量标记已读 */
    async readNotifications(ids = []) {
        if (!ensureLoggedIn({ silent: true })) {
            throw new Error('请先登录');
        }
        if (!ids.length) return { success: true, unreadCount: 0 };
        return await this.callNotification('readNotifications', { ids });
    },

    /** 获取未读数（轻量） */
    async getUnreadCount() {
        if (!ensureLoggedIn({ silent: true })) {
            throw new Error('请先登录');
        }
        return await this.callNotification('getUnreadCount');
    },

    /** 创建通知（供其他模块调用） */
    async createNotification({ toUserId, type, title, content, meetId, meetTitle }) {
        if (!ensureLoggedIn({ silent: true })) {
            throw new Error('请先登录');
        }
        return await this.callNotification('createNotification', {
            toUserId, type, title, content, meetId, meetTitle
        });
    },

    /** 全部标记已读 */
    async markAllNotificationsRead() {
        if (!ensureLoggedIn({ silent: true })) {
            throw new Error('请先登录');
        }
        return await this.callNotification('markAllRead');
    }
};

export { apiService };
export default apiService;
