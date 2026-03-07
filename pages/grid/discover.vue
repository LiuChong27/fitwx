<template>
  <view class="warp">
    <!-- #ifdef APP -->
    <statusBar></statusBar>
    <!-- #endif -->

    <view class="header-section header-transparent">
      <view class="header-content">
        <text class="page-title">Discover</text>
        <view class="header-actions">
          <view class="action-btn" role="button" aria-label="搜索" @click="onSearch">
            <uni-icons type="search" size="24" color="#fff" />
          </view>
          <view v-if="cachedIsLoggedIn" class="action-btn" role="button" aria-label="发布动态" @click="openPublish">
            <uni-icons type="plus-filled" size="24" color="#fff" />
          </view>
          <view v-else class="action-btn disabled" role="button" aria-label="登录后发布" @click="goToLogin">
            <uni-icons type="plus-filled" size="24" color="rgba(255,255,255,0.5)" />
          </view>
        </view>
      </view>

      <scroll-view scroll-x class="filter-scroll" :show-scrollbar="false" enhanced :enable-flex="true">
        <view class="filter-row">
          <view class="filter-chip glass" :class="{ active: filters.gender !== 'all' }" role="button" aria-label="性别筛选" @click="openPicker('gender')">
            <text>{{ filters.gender === 'all' ? 'Gender' : genderLabel }}</text>
            <uni-icons type="bottom" size="10" color="rgba(255,255,255,0.8)" />
          </view>
          <view class="filter-chip glass" :class="{ active: filters.distance !== 'all' }" role="button" aria-label="距离筛选" @click="openPicker('distance')">
            <text>{{ filters.distance === 'all' ? 'Distance' : distanceLabel }}</text>
            <uni-icons type="bottom" size="10" color="rgba(255,255,255,0.8)" />
          </view>
        </view>
      </scroll-view>
    </view>

    <swiper class="feed-swiper" vertical :indicator-dots="false" :current="currentFeedIndex" @change="onSwiperChange">
      <swiper-item v-for="item in feedList" :key="item.id">
        <feed-card
          :item="item"
          @like="() => onLike(item)"
          @comment="() => onComment(item)"
          @invite="() => openInviteForm(item)"
          @chat="() => openChat(item)"
          @goProfile="() => goProfile(item)"
          @edit="() => onEdit(item)"
          @delete="() => onDelete(item)"
          @cardClick="() => onCardClick(item)"
        />
      </swiper-item>
      <swiper-item v-if="loading || noMore">
        <view class="end-page">
          <uni-load-more v-if="loading" status="loading" color="#fff" />
          <text v-else class="no-more-text">No more energy signals...</text>
        </view>
      </swiper-item>
    </swiper>

    <view v-if="loading && page === 1 && !feedList.length" class="skeleton-box fullscreen">
      <view class="skeleton-rect"></view>
    </view>

    <filter-popups
      ref="filterPopups"
      :filters="filters"
      :genderOptions="genderOptions"
      :distanceOptions="distanceOptions"
      :typeOptions="typeOptions"
      :levelOptions="levelOptions"
      @change="handleFilterChange"
    />

    <publish-modal ref="publishModal" :types="publishTypes" @submit="handlePublishSubmit" />

    <uni-popup ref="invitePopup" type="center" background-color="rgba(0,0,0,0.5)">
      <view class="invite-form-box">
        <view class="invite-title">想约 TA 一起练</view>
        <view v-if="inviteTarget" class="invite-user">
          <image class="invite-avatar" :src="inviteTarget.avatar" mode="aspectFill" />
          <text class="invite-name">{{ inviteTarget.nickname }}</text>
        </view>
        <view class="form-item">
          <text class="form-label">约练时间</text>
          <picker mode="date" :value="inviteForm.date" @change="onDateChange">
            <view class="form-input picker">{{ inviteForm.date || '选择日期' }}</view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">约练地点</text>
          <input class="form-input" placeholder="如:朝阳公园 / 某某健身房" placeholder-class="placeholder" aria-label="约练地点" v-model="inviteForm.place" />
        </view>
        <view class="form-item">
          <text class="form-label">留言</text>
          <textarea class="form-textarea" placeholder="打个招呼或说明想练的项目～" placeholder-class="placeholder" maxlength="100" aria-label="约练留言" v-model="inviteForm.message" />
        </view>
        <view class="invite-actions">
          <button class="btn-cancel" @click="closeInviteForm">取消</button>
          <button class="btn-submit" @click="submitInvite">发送约练请求</button>
        </view>
      </view>
    </uni-popup>

    <uni-popup ref="commentPopup" type="center" background-color="rgba(0,0,0,0.5)">
      <view class="comment-box">
        <view class="comment-title">写评论</view>
        <view v-if="commentTarget" class="comment-user">
          <image class="comment-avatar" :src="commentTarget.avatar" mode="aspectFill" />
          <text class="comment-name">{{ commentTarget.nickname }}</text>
        </view>
        <textarea class="comment-input" placeholder="说点什么..." placeholder-class="placeholder" maxlength="120" aria-label="评论内容" v-model="commentForm.content" />
        <view class="comment-actions">
          <button class="btn-cancel" @click="closeComment">取消</button>
          <button class="btn-submit" @click="submitComment">发送</button>
        </view>
      </view>
    </uni-popup>

    <uni-popup ref="giftPopup" type="center" background-color="rgba(0,0,0,0.5)">
      <view class="gift-box">
        <view class="gift-title">送个礼物</view>
        <view v-if="giftTarget" class="gift-user">
          <image class="gift-avatar" :src="giftTarget.avatar" mode="aspectFill" />
          <text class="gift-name">{{ giftTarget.nickname }}</text>
        </view>
        <view class="gift-grid">
          <view
            v-for="gift in giftOptions"
            :key="gift.code"
            class="gift-item"
            :class="{ active: selectedGift === gift.code }"
            role="option"
            :aria-label="gift.label"
            :aria-selected="selectedGift === gift.code"
            @click="selectGift(gift.code)"
          >
            <text class="gift-emoji">{{ gift.emoji }}</text>
            <text class="gift-label">{{ gift.label }}</text>
          </view>
        </view>
        <view class="gift-actions">
          <button class="btn-cancel" @click="closeGift">取消</button>
          <button class="btn-submit" @click="submitGift">确认赠送</button>
        </view>
      </view>
    </uni-popup>

    <uni-popup ref="detailPopup" type="bottom">
      <view v-if="detailTarget" class="detail-sheet">
        <image class="detail-cover" :src="detailTarget.cover" mode="aspectFill" />
        <view class="detail-body">
          <view class="detail-user">
            <image class="detail-avatar" :src="detailTarget.avatar" mode="aspectFill" />
            <view class="detail-user-text">
              <text class="detail-nickname">{{ detailTarget.nickname }}</text>
              <text class="detail-meta">{{ detailTarget.location || '附近健身房' }} · {{ resolveTypeLabel(detailTarget.type) }} · {{ formatDistance(detailTarget.distanceKm) }}</text>
            </view>
          </view>
          <text class="detail-content">{{ detailTarget.content }}</text>
          <view v-if="detailTarget.tags && detailTarget.tags.length" class="detail-tags">
            <text v-for="tag in detailTarget.tags" :key="tag" class="detail-tag">#{{ tag }}</text>
          </view>
          <view class="detail-stats">
            <text>❤️ {{ detailTarget.likeCount }}</text>
            <text>💬 {{ detailTarget.commentCount }}</text>
            <text>🎁 {{ detailTarget.giftCount }}</text>
          </view>
          <view class="detail-actions">
            <button class="detail-btn" @click="onLike(detailTarget)">{{ detailTarget.liked ? '已点赞' : '点赞' }}</button>
            <button class="detail-btn" @click="openInviteForm(detailTarget)">约练</button>
            <button class="detail-btn primary" @click="openChat(detailTarget)">立即开聊</button>
          </view>
          <view class="detail-actions">
            <button class="detail-btn ghost" @click="shareFeed(detailTarget)">分享</button>
            <button class="detail-btn ghost" @click="onComment(detailTarget)">评论</button>
            <button class="detail-btn ghost" @click="onGift(detailTarget)">送礼</button>
          </view>
          <button class="detail-close" @click="closeDetail">收起</button>
        </view>
      </view>
    </uni-popup>

    <uni-fab v-if="cachedIsLoggedIn" ref="fab" :pattern="fabPattern" horizontal="right" vertical="bottom" @fabClick="onFabClick" />
  </view>
</template>

<script>
import FeedCard from './components/feed-card.vue';
import FilterPopups from './components/filter-popups.vue';
import PublishModal from './components/publish-modal.vue';
import { apiService } from '@/services/apiService.js';
import { chatService } from '@/services/chatService.js';
import { store } from '@/uni_modules/uni-id-pages/common/store.js';
import { checkLogin } from '@/common/auth.js';
import { thumbnailUrl, avatarUrl as optimizedAvatar } from '@/common/imageOptimizer.js';
import tabCacheMixin from '@/common/tabCacheMixin.js';

export default {
  mixins: [tabCacheMixin],
  tabCacheKeys: ['currentFeedIndex', 'filters', 'feedList'],
  components: {
    FeedCard,
    FilterPopups,
    PublishModal
  },
  data() {
    return {
      currentFeedIndex: 0,
      filters: {
        gender: 'all',
        distance: 'all',
        type: 'all',
        level: 'all'
      },
      genderOptions: [
        { label: '全部', value: 'all', single: false },
        { label: '男', value: 'male', single: true },
        { label: '女', value: 'female', single: true }
      ],
      distanceOptions: [
        { label: '全部', value: 'all' },
        { label: '1km', value: '1km' },
        { label: '3km', value: '3km' },
        { label: '5km', value: '5km' },
        { label: '10km', value: '10km' }
      ],
      typeOptions: [
        { label: '全部', value: 'all' },
        { label: '健身房', value: 'gym' },
        { label: '徒手', value: 'bodyweight' },
        { label: '瑜伽', value: 'yoga' },
        { label: '跑步', value: 'run' },
        { label: '普拉提', value: 'pilates' },
        { label: '格斗', value: 'boxing' }
      ],
      levelOptions: [
        { label: '全部', value: 'all' },
        { label: '新手', value: 'beginner' },
        { label: '进阶', value: 'intermediate' },
        { label: '专业', value: 'pro' }
      ],
      feedList: [],
      loading: false,
      noMore: false,
      page: 1,
      pageSize: 8,
      hasMore: true,
      refreshing: false,
      inviteTarget: null,
      inviteForm: {
        date: '',
        place: '',
        message: ''
      },
      commentTarget: null,
      commentForm: {
        content: ''
      },
      giftTarget: null,
      selectedGift: '',
      giftOptions: [
        { code: 'drink', label: '能量饮', emoji: '🥤' },
        { code: 'protein', label: '蛋白粉', emoji: '💪' },
        { code: 'relax', label: '放松券', emoji: '🧖' },
        { code: 'rose', label: '运动玫瑰', emoji: '🌹' }
      ],
      detailTarget: null,
      editingFeedId: '',
      publishing: false,
      cachedOpenid: '',
      cachedUserInfo: null,
      cachedIsLoggedIn: false,
      fabPattern: {
        color: '#fff',
        backgroundColor: '#00E5FF',
        selectedColor: '#fff',
        buttonColor: '#00E5FF'
      }
    };
  },
  computed: {
    hasLogin() {
      return store.hasLogin;
    },
    userInfo() {
      return store.userInfo || {};
    },
    currentNickname() {
      const u = this.userInfo;
      return u.nickname || u.username || u.mobile || '微信用户';
    },
    currentAvatar() {
      const u = this.userInfo;
      return (u.avatar_file && u.avatar_file.url) || u.avatar || '';
    },
    genderLabel() {
      const option = this.genderOptions.find(item => item.value === this.filters.gender);
      return option ? option.label : 'Gender';
    },
    distanceLabel() {
      const option = this.distanceOptions.find(item => item.value === this.filters.distance);
      return option ? option.label : 'Distance';
    },
    publishTypes() {
      return this.typeOptions.filter(item => item.value !== 'all');
    }
  },
  onShow() {
    this.syncLoginCache();
    this.loadDiscoverList(true);
  },
  onLoad() {
    this.syncLoginCache();
    this.loadDiscoverList(true);
    uni.$on('uni-id-pages-login-success', () => {
      this.syncLoginCache();
      this.loadDiscoverList(true);
    });
    uni.$on('uni-id-pages-logout', () => {
      this.loadDiscoverList(true);
    });
  },
  onUnload() {
    uni.$off('uni-id-pages-login-success');
    uni.$off('uni-id-pages-logout');
  },
  onReachBottom() {
    if (this.hasMore && !this.loading) {
      this.loadDiscoverList(false);
    }
  },
  onPullDownRefresh() {
    this.loadDiscoverList(true).finally(() => {
      if (typeof uni.stopPullDownRefresh === 'function') {
        uni.stopPullDownRefresh();
      }
    });
  },
  methods: {
    /** 与 Meet 页一致：通过 Pinia store 恢复登录态 */
    syncLoginCache() {
      try {
        const { useUserStore } = require('@/store/user.js');
        const userStore = useUserStore();
        userStore.syncFromLogin();

        this.cachedOpenid = userStore.openid;
        this.cachedUserInfo = userStore.userInfo;
        this.cachedIsLoggedIn = userStore.hasLogin;
      } catch (e) {
        console.warn('[discover] syncLoginCache failed:', e);
      }
    },
    requireLogin(cb) {
      return checkLogin(() => {
        if (typeof cb === 'function') cb();
      });
    },
    decorateOwnership(list) {
      const uid = this.hasLogin ? this.userInfo._id : '';
      return (list || []).map(item => ({
        ...item,
        isMine: !!uid && item.userId === uid
      }));
    },
    onSwiperChange(e) {
      const index = e.detail.current;
      this.currentFeedIndex = index;
      if (this.feedList.length - index < 3 && !this.loading && !this.noMore) {
        this.loadMore();
      }
    },
    onFabClick() {
      this.openPublish();
    },
    normalizeFeed(list) {
      return (list || []).map(item => {
        const tags = Array.isArray(item.tags) ? item.tags : (item.tags ? String(item.tags).split(/[,，\s#]+/).filter(Boolean) : []);
        const distance = Number(item.distanceKm);
        return {
          ...item,
          tags,
          distanceKm: Number.isFinite(distance) ? Number(distance.toFixed(2)) : distance,
          liked: !!item.liked,
          collected: !!item.collected,
          likeCount: Number(item.likeCount || 0),
          commentCount: Number(item.commentCount || 0),
          giftCount: Number(item.giftCount || 0)
        };
      });
    },
    matchFilters(item = {}) {
      if (!item) return false;
      if (this.filters.gender !== 'all' && item.gender !== this.filters.gender) return false;
      if (this.filters.type !== 'all' && item.type !== this.filters.type) return false;
      if (this.filters.level !== 'all' && item.level !== this.filters.level) return false;
      if (this.filters.distance !== 'all' && !this.isDistanceMatch(item.distanceKm, this.filters.distance)) return false;
      return true;
    },
    isDistanceMatch(distanceValue, filterValue) {
      const limit = parseInt(filterValue, 10);
      if (!Number.isFinite(limit)) return true;
      const distance = Number(distanceValue);
      if (!Number.isFinite(distance)) return true;
      return distance <= limit;
    },
    filterFeed(list) {
      return (list || []).filter(item => this.matchFilters(item));
    },
    async loadDiscoverList(reset = true) {
      if (this.loading) return;
      if (reset) {
        this.page = 1;
        this.hasMore = true;
        this.noMore = false;
        this.feedList = [];
      }
      if (!this.hasMore) return;
      this.loading = true;
      try {
        const distanceKm = this.filters.distance === 'all' ? undefined : parseInt(this.filters.distance, 10);
        const response = await apiService.getDiscoverList({
          page: this.page,
          pageSize: this.pageSize,
          gender: this.filters.gender,
          type: this.filters.type,
          level: this.filters.level,
          distanceKm: Number.isFinite(distanceKm) ? distanceKm : undefined
        });
        const list = this.normalizeFeed(apiService.parseList(response));
        const filtered = this.decorateOwnership(this.filterFeed(list));
        if (reset) {
          this.feedList = filtered;
        } else {
          this.feedList = [...this.feedList, ...filtered];
        }
        const incomingLen = list.length;
        const hasMore = response && typeof response.hasMore === 'boolean' ? response.hasMore : incomingLen >= this.pageSize;
        this.hasMore = hasMore;
        this.noMore = !hasMore;
        if (incomingLen > 0) {
          this.page += 1;
        }
      } catch (error) {
        uni.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        this.loading = false;
        this.refreshing = false;
      }
    },
    loadMore() {
      if (this.loading || this.noMore || !this.hasMore) return;
      this.loadDiscoverList(false);
    },
    onRefresh() {
      this.refreshing = true;
      this.loadDiscoverList(true);
    },
    openPicker(key) {
      const popup = this.$refs.filterPopups;
      if (popup) popup.open(key);
    },
    handleFilterChange({ key, value }) {
      this.filters[key] = value;
      this.feedList = [];
      this.page = 1;
      this.noMore = false;
      this.hasMore = true;
      this.loading = false;
      this.loadDiscoverList(true);
      uni.showToast({ title: 'Filter Updated', icon: 'none', mask: true });
    },
    onSearch() {
      uni.navigateTo({
        url: '/pages/common/search/search',
        fail: () => uni.showToast({ title: 'Search feature coming soon', icon: 'none' })
      });
    },
    goToLogin() {
      uni.navigateTo({ url: '/pages/login/login-withoutpwd' });
    },
    openPublish() {
      this.syncLoginCache();
      this.requireLogin(() => {
        this.editingFeedId = '';
        this.$refs.publishModal.open();
      });
    },
    onEdit(item) {
      if (!item || !item.isMine) return;
      this.requireLogin(() => {
        this.editingFeedId = item.id;
        this.$refs.publishModal.open({
          content: item.content || '',
          type: item.type || 'gym',
          location: item.location || '',
          photo: item.cover || ''
        });
      });
    },
    onDelete(item) {
      if (!item || !item.isMine) return;
      uni.showModal({
        title: '确认删除',
        content: '删除后不可恢复，确认继续？',
        success: res => {
          if (!res.confirm) return;
          this.requireLogin(async () => {
            uni.showLoading({ title: '删除中...' });
            try {
              await apiService.removeFeed(item.id);
              this.feedList = (this.feedList || []).filter(f => f.id !== item.id);
              uni.showToast({ title: '已删除', icon: 'success' });
            } catch (err) {
              uni.showToast({ title: err?.message || '删除失败', icon: 'none' });
            } finally {
              uni.hideLoading();
            }
          });
        }
      });
    },
    async handlePublishSubmit(formData) {
      this.syncLoginCache();
      if (this.publishing) return;

      if (!this.requireLogin()) {
        if (this.$refs.publishModal) {
          this.$refs.publishModal.submitFail();
        }
        return;
      }

      this.publishing = true;
      let loadingShown = false;
      try {
        const content = String(formData.content || '').trim();
        if (!content) {
          uni.showToast({ title: '请输入发布内容', icon: 'none' });
          return;
        }

        uni.showLoading({ title: this.editingFeedId ? '更新中...' : '发布中...', mask: true });
        loadingShown = true;

        const action = this.editingFeedId ? 'updateFeed' : 'publishFeed';
        const params = {
          feedId: this.editingFeedId || undefined,
          content,
          type: formData.type,
          location: formData.location || '',
          location_address: formData.address || '',
          location_geo: (formData.longitude && formData.latitude)
            ? { type: 'Point', coordinates: [formData.longitude, formData.latitude] }
            : null,
          photo: formData.photo || '',
          tags: this.extractTagsFromContent(content),
          level: formData.level,
          gender: formData.gender,
        };

        const result = this.editingFeedId
          ? await apiService.callCloud(action, params)
          : await apiService.publishFeed(params);
        if (!result) {
          throw new Error('发布失败');
        }

        uni.showToast({ title: this.editingFeedId ? '已更新' : '发布成功', icon: 'success' });
        this.editingFeedId = '';
        if (this.$refs.publishModal) {
          this.$refs.publishModal.submitDone();
        }
        this.loadDiscoverList(true);
      } catch (error) {
        if (this.$refs.publishModal) {
          this.$refs.publishModal.submitFail();
        }
        const msg = error?.message || '发布失败，请重试';
        if (msg.includes('请先登录') || msg.includes('未登录')) {
          uni.showToast({ title: '登录已失效，请重新登录', icon: 'none' });
          uni.navigateTo({ url: '/pages/login/login-withoutpwd' });
        } else {
          uni.showToast({ title: msg, icon: 'none' });
        }
      } finally {
        if (loadingShown) {
          uni.hideLoading();
        }
        this.publishing = false;
      }
    },
    extractTagsFromContent(content) {
      if (!content) return [];
      const matches = content.match(/#[^#\s]+/g) || [];
      return matches.map(tag => tag.replace('#', ''));
    },
    onLike(item) {
      if (!item) return;
      this.requireLogin(async () => {
        const nextLiked = !item.liked;
        const currentCount = Number(item.likeCount || 0);
        try {
          await apiService.likeFeed(item.id, nextLiked);
          item.liked = nextLiked;
          item.likeCount = Math.max(0, currentCount + (nextLiked ? 1 : -1));
          if (nextLiked && uni.vibrateShort) {
            uni.vibrateShort();
          }
        } catch (err) {
          uni.showToast({ title: err?.message || '操作失败', icon: 'none' });
        }
      });
    },
    onComment(item) {
      if (!item) return;
      this.requireLogin(() => {
        this.closeDetailIfMatch(item);
        this.commentTarget = item;
        this.commentForm = { content: '' };
        this.$refs.commentPopup.open();
      });
    },
    openInviteForm(item) {
      if (!item) return;
      this.requireLogin(() => {
        this.closeDetailIfMatch(item);
        this.inviteTarget = item;
        const today = new Date();
        this.inviteForm = {
          date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
          place: '',
          message: ''
        };
        this.$refs.invitePopup.open();
      });
    },
    closeInviteForm() {
      this.$refs.invitePopup.close();
    },
    onDateChange(e) {
      this.inviteForm.date = e.detail.value;
    },
    submitInvite() {
      this.requireLogin(async () => {
        if (!this.inviteTarget) return;
        if (!this.inviteForm.place.trim()) {
          uni.showToast({ title: '请填写约练地点', icon: 'none' });
          return;
        }
        try {
          await apiService.sendInvite(this.inviteTarget.userId, this.inviteForm);
          uni.showToast({ title: '约练请求已发送', icon: 'success' });
          this.closeInviteForm();
        } catch (err) {
          uni.showToast({ title: '发送失败', icon: 'none' });
        }
      });
    },
    openChat(item) {
      if (!item) return;
      this.requireLogin(() => {
        this.closeDetailIfMatch(item);
        try {
          const storageModule = require('@/common/storage.js');
          storageModule.default.set(`user_${item.userId}`, {
            userId: item.userId,
            nickname: item.nickname,
            avatar: item.avatar
          });
        } catch (error) {
          // ignore storage errors
        }
        chatService.getOrCreateConversation(item.userId, {
          nickname: item.nickname,
          avatar: item.avatar
        });
        uni.navigateTo({
          url: `/pages/chat/chat?userId=${item.userId}`,
          fail: () => {
            uni.showToast({ title: '功能开发中', icon: 'none' });
          }
        });
      });
    },
    onGift(item) {
      if (!item) return;
      this.requireLogin(() => {
        this.closeDetailIfMatch(item);
        this.giftTarget = item;
        this.selectedGift = '';
        this.$refs.giftPopup.open();
      });
    },
    goProfile(item) {
      if (!item) return;
      if (item.isMine) {
        uni.switchTab({ url: '/pages/ucenter/ucenter' });
        return;
      }
      const uid = item.userId;
      if (!uid) {
        uni.showToast({ title: '用户信息缺失', icon: 'none' });
        return;
      }
      uni.navigateTo({ url: `/pages/profile/profile?userId=${encodeURIComponent(uid)}` });
    },
    onCardClick(item) {
      uni.showActionSheet({
        itemList: ['查看详情', '分享给朋友', '复制链接', '举报'],
        success: res => {
          if (res.tapIndex === 0) {
            this.openDetail(item);
            return;
          }
          if (res.tapIndex === 1) {
            this.shareFeed(item);
            return;
          }
          if (res.tapIndex === 2) {
            uni.setClipboardData({
              data: `https://fitmeet.com/feed/${item.id}`,
              success: () => uni.showToast({ title: '链接已复制', icon: 'none' })
            });
            return;
          }
          if (res.tapIndex === 3) {
            this.requireLogin(() => {
              uni.showToast({ title: '已举报，感谢监督', icon: 'success' });
            });
          }
        }
      });
    },
    closeComment() {
      this.$refs.commentPopup.close();
    },
    submitComment() {
      this.requireLogin(async () => {
        const content = this.commentForm.content.trim();
        if (!content) {
          uni.showToast({ title: '请输入评论内容', icon: 'none' });
          return;
        }
        if (!this.commentTarget) return;
        this.closeComment();
        uni.showLoading({ title: '发送中...' });
        try {
          await apiService.commentFeed(this.commentTarget.id, content);
          this.commentTarget.commentCount = (this.commentTarget.commentCount || 0) + 1;
          uni.showToast({ title: '评论成功', icon: 'success' });
        } catch (err) {
          uni.showToast({ title: err?.message || '评论失败', icon: 'none' });
        } finally {
          uni.hideLoading();
        }
      });
    },
    selectGift(code) {
      this.selectedGift = code;
    },
    closeGift() {
      this.$refs.giftPopup.close();
    },
    submitGift() {
      this.requireLogin(async () => {
        if (!this.giftTarget) return;
        if (!this.selectedGift) {
          uni.showToast({ title: '请选择礼物', icon: 'none' });
          return;
        }
        this.closeGift();
        uni.showLoading({ mask: true, title: '赠送中...' });
        try {
          await apiService.giftFeed(this.giftTarget.id, this.selectedGift);
          this.giftTarget.giftCount = (this.giftTarget.giftCount || 0) + 1;
          uni.showToast({ title: '赠送成功', icon: 'success' });
        } catch (err) {
          uni.showToast({ title: err?.message || '赠送失败', icon: 'none' });
        } finally {
          uni.hideLoading();
        }
      });
    },
    openDetail(item) {
      if (!item) return;
      this.detailTarget = item;
      this.$refs.detailPopup.open();
    },
    closeDetail() {
      this.$refs.detailPopup.close();
      this.detailTarget = null;
    },
    closeDetailIfMatch(item) {
      if (this.detailTarget && item && this.detailTarget.id === item.id) {
        this.closeDetail();
      }
    },
    shareFeed() {
      uni.showToast({ title: '分享功能开发中', icon: 'none' });
    },
    resolveTypeLabel(type) {
      const option = this.typeOptions.find(opt => opt.value === type);
      return option ? option.label : '健身房';
    },
    formatDistance(distanceKm) {
      if (!Number.isFinite(distanceKm)) return '附近';
      if (distanceKm < 0.1) return '附近';
      if (distanceKm < 1) return `${(distanceKm * 1000).toFixed(0)}m`;
      return `${distanceKm.toFixed(1)}km`;
    }
  }
};
</script>

<style lang="scss">
@import "@/uni.scss";

:root {
  --bg-color: #0A1628;
}

page {
  background-color: #0A1628;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  height: 100%;
  overflow: hidden;
}

.warp {
  height: 100vh;
  width: 100vw;
  background-color: #0A1628;
  position: relative;
  overflow: hidden;
}

/* Transparent Floating Header - Glassmorphism */
.header-section {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding: 20rpx 32rpx;
  background: linear-gradient(to bottom, rgba(10, 22, 40, 0.75) 0%, rgba(10, 22, 40, 0.3) 60%, rgba(10, 22, 40, 0) 100%);
  transition: all 0.3s;
}
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
  animation: fadeInDown 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-16rpx); }
  to   { opacity: 1; transform: translateY(0); }
}
.page-title {
  font-size: 44rpx;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 2rpx 12rpx rgba(0, 229, 255, 0.2);
  letter-spacing: 1px;
}
.header-actions {
  display: flex;
  gap: 20rpx;
}
.action-btn {
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  @include glass-card(rgba(13, 27, 42, 0.55), 12px);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:active {
    background: rgba(0, 229, 255, 0.15);
    transform: scale(0.9);
    border-color: rgba(0, 229, 255, 0.25);
  }
  
  &.disabled {
    opacity: 0.5;
    background: rgba(13, 27, 42, 0.35);
  }
}

/* Filter Scroll - Glassmorphism */
.filter-scroll {
  white-space: nowrap;
  width: 100%;
  animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.1s both;
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12rpx); }
  to   { opacity: 1; transform: translateY(0); }
}
.filter-row {
  display: flex;
  gap: 16rpx;
  padding-right: 32rpx;
}
.filter-chip {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 28rpx;
  @include glass-card(rgba(13, 27, 42, 0.55), 10px);
  border-radius: 100rpx;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.filter-chip text {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}
.filter-chip.active {
  background: rgba(0, 229, 255, 0.18);
  border-color: rgba(0, 229, 255, 0.5);
  box-shadow: 0 0 16rpx rgba(0, 229, 255, 0.25), inset 0 0 8rpx rgba(0, 229, 255, 0.06);
}
.filter-chip.active text {
  color: #00E5FF;
  font-weight: 600;
}

/* Main Swiper */
.feed-swiper {
  width: 100%;
  height: 100vh;
  background: #0A1628;
}

/* Loading / End Page in Swiper */
.end-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: linear-gradient(180deg, #0D1B2A 0%, #0A1628 100%);
}
.no-more-text {
  color: rgba(255,255,255,0.4);
  font-size: 28rpx;
  margin-top: 20rpx;
  letter-spacing: 1px;
}

/* Initial Loading Fullscreen */
.skeleton-box.fullscreen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #0D1B2A;
  z-index: 50;
}
.skeleton-rect {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    #132136 25%,
    rgba(0, 229, 255, 0.04) 37%,
    #132136 63%
  );
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
}

/* Common Popup Styles - Shorelines Glass */
.invite-form-box, .comment-box, .gift-box, .detail-sheet {
  @include glass-card(rgba(13, 27, 42, 0.92), 20px);
  border-radius: 28rpx;
}
.detail-sheet {
  border-radius: 28rpx 28rpx 0 0;
  border-bottom: none;
}
.invite-title, .comment-title, .gift-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #ffffff;
  text-align: center;
  padding: 32rpx 0;
}
.invite-form-box {
  width: 600rpx;
  padding: 0 40rpx 40rpx;
}
.form-item {
  margin-bottom: 24rpx;
}
.form-label {
  font-size: 26rpx;
  color: rgba(255,255,255,0.55);
  margin-bottom: 12rpx;
  display: block;
}
.form-input, .form-textarea, .comment-input {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  font-size: 28rpx;
  width: 100%;
  box-sizing: border-box;
  transition: all 0.3s;
  
  &:focus {
    background: rgba(0, 229, 255, 0.06);
    border-color: rgba(0, 229, 255, 0.35);
    box-shadow: 0 0 0 3rpx rgba(0, 229, 255, 0.1);
  }
}
.invite-actions, .comment-actions, .gift-actions {
  display: flex;
  gap: 24rpx;
  margin-top: 32rpx;
}
.btn-cancel, .btn-submit {
  flex: 1;
  font-size: 28rpx;
  font-weight: 600;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  border: none;
}
.btn-cancel::after, .btn-submit::after {
  border: none;
}
.btn-cancel {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255,255,255,0.7);
  border: 1px solid rgba(255,255,255,0.1);
}
.btn-submit {
  @include sl-btn-primary;
}
.picker {
  height: 80rpx;
  line-height: 80rpx;
}

/* Detail Popup Specifics */
.detail-cover {
  width: 100%;
  height: 440rpx;
  background: #0D1B2A;
}
.detail-body {
  padding: 32rpx;
  max-height: 60vh;
  overflow-y: auto;
}
.detail-user {
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
}
.detail-avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  border: 2px solid rgba(0, 229, 255, 0.2);
  margin-right: 24rpx;
}
.detail-nickname {
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 600;
}
.detail-meta {
  color: rgba(255,255,255,0.5);
  font-size: 24rpx;
  margin-top: 4rpx;
}
.detail-content {
  color: rgba(255,255,255,0.85);
  font-size: 30rpx;
  line-height: 1.6;
  margin-bottom: 32rpx;
}
.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 32rpx;
}
.detail-tag {
  color: #00E5FF;
  background: rgba(0, 229, 255, 0.12);
  padding: 6rpx 20rpx;
  border-radius: 100rpx;
  font-size: 24rpx;
  border: 1px solid rgba(0, 229, 255, 0.15);
}
.detail-stats {
  display: flex;
  gap: 40rpx;
  margin-bottom: 40rpx;
  color: rgba(255,255,255,0.5);
  font-size: 26rpx;
  padding-bottom: 32rpx;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.detail-actions {
  display: flex;
  gap: 20rpx;
  margin-bottom: 20rpx;
}
.detail-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  
  &.primary {
    @include sl-btn-primary;
  }
  &.ghost {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255,255,255,0.7);
    border: 1px solid rgba(255,255,255,0.08);
  }
}
.detail-close {
  width: 100%;
  background: transparent;
  color: rgba(255,255,255,0.4);
  font-size: 28rpx;
  margin-top: 16rpx;
}
.detail-close::after {
  border: none;
}

/* Gift Grid override */
.gift-box {
  width: 600rpx;
  padding: 0 32rpx 32rpx;
}
.gift-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
}
.gift-item {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 24rpx;
  padding: 28rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &.active {
    border-color: #00E5FF;
    background: rgba(0, 229, 255, 0.1);
    box-shadow: 0 0 20rpx rgba(0, 229, 255, 0.25);
    transform: scale(1.03);
  }
}
.gift-emoji {
  font-size: 48rpx;
  margin-bottom: 8rpx;
  transition: transform 0.3s;
}
.gift-item.active .gift-emoji {
  transform: scale(1.2);
}
.comment-box {
  width: 600rpx;
  padding: 32rpx;
}
.load-more {
  padding: 40rpx 0;
  text-align: center;
}

/* Hide unused classes from original */
.decoration, .section-text, .example-body, .grid-item-box, .big-number, .text, .banner-image, .swiper-box {
  display: none;
}
</style>
