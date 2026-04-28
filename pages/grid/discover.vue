<template>
  <view class="discover-page">
    <view class="discover-header">
      <view class="header-action" role="button" aria-label="发布笔记" @click="openPublish">
        <uni-icons type="plusempty" size="16" color="#08131D" />
        <text>发布</text>
      </view>
    </view>

    <view class="discover-hero">
      <view class="hero-copy">
        <text class="hero-title">{{ browseModeLabel }}</text>
      </view>
      <view class="hero-metrics">
        <view class="hero-metric">
          <text class="hero-metric__value">{{ feedList.length }}</text>
          <text class="hero-metric__label">笔记</text>
        </view>
        <view class="hero-metric">
          <text class="hero-metric__value">{{ activeFilterCount }}</text>
          <text class="hero-metric__label">筛选</text>
        </view>
      </view>
    </view>

    <scroll-view scroll-x class="filter-scroll" :show-scrollbar="false" enhanced :enable-flex="true">
      <view class="filter-row">
        <view class="filter-chip" :class="{ active: filters.gender !== 'all' }" role="button" aria-label="性别筛选" @click="openPicker('gender')">
          <text class="filter-label">性别</text>
          <text class="filter-value">{{ filters.gender === 'all' ? '不限' : genderLabel }}</text>
          <uni-icons type="bottom" size="10" color="rgba(255,255,255,0.65)" />
        </view>
        <view class="filter-chip" :class="{ active: filters.distance !== 'all' }" role="button" aria-label="距离筛选" @click="openPicker('distance')">
          <text class="filter-label">距离</text>
          <text class="filter-value">{{ filters.distance === 'all' ? '不限距离' : distanceLabel }}</text>
          <uni-icons type="bottom" size="10" color="rgba(255,255,255,0.65)" />
        </view>
        <view class="filter-chip" :class="{ active: filters.type !== 'all' }" role="button" aria-label="类型筛选" @click="openPicker('type')">
          <text class="filter-label">类型</text>
          <text class="filter-value">{{ filters.type === 'all' ? '全部类型' : resolveTypeLabel(filters.type) }}</text>
          <uni-icons type="bottom" size="10" color="rgba(255,255,255,0.65)" />
        </view>
        <view class="filter-chip" :class="{ active: filters.level !== 'all' }" role="button" aria-label="等级筛选" @click="openPicker('level')">
          <text class="filter-label">等级</text>
          <text class="filter-value">{{ filters.level === 'all' ? '不限等级' : filters.level }}</text>
          <uni-icons type="bottom" size="10" color="rgba(255,255,255,0.65)" />
        </view>
      </view>
    </scroll-view>

    <view class="discover-summary">
      <view class="summary-link" role="button" aria-label="刷新" @click="handleManualRefresh">
        <uni-icons type="reload" size="16" color="#72E4C8" />
        <text>{{ refreshing ? '刷新中...' : '刷新' }}</text>
      </view>
      <view v-if="isMineView" class="summary-link summary-link--ghost" role="button" aria-label="查看全部笔记" @click="showAllFeeds">
        <uni-icons type="undo" size="16" color="rgba(255,255,255,0.8)" />
        <text>查看全部</text>
      </view>
    </view>

    <scroll-view v-if="isMineView" scroll-x class="mine-status-scroll" :show-scrollbar="false" enhanced :enable-flex="true">
      <view class="mine-status-row">
        <view
          v-for="option in mineStatusOptions"
          :key="option.value"
          class="mine-status-chip"
          :class="{ active: mineStatusFilter === option.value }"
          role="button"
          :aria-label="option.label"
          @click="setMineStatusFilter(option.value)"
        >
          <text class="mine-status-chip__text">{{ option.label }}</text>
        </view>
      </view>
    </scroll-view>

    <view v-if="statusMessage" class="status-banner" :class="statusToneClass">
      <view class="status-banner__main">
        <uni-icons :type="statusIcon" size="16" :color="statusIconColor" />
        <text class="status-banner__text">{{ statusMessage }}</text>
      </view>
      <view v-if="loadError || isOffline" class="status-banner__action" role="button" aria-label="重试" @click="handleManualRefresh">重试</view>
    </view>

    <view class="discover-scroll" :class="{ 'discover-scroll--switching': filterTransitioning }">
      <fit-shimmer-stack v-if="filterTransitioning && feedList.length" class="switch-shimmer" variant="discover" :count="2" />
      <fit-shimmer-stack v-if="loading && page === 1 && !feedList.length" class="skeleton-box" variant="discover" :count="3" />

      <fit-state-panel
        v-else-if="!feedList.length && loadError"
        class="empty-state"
        :class="{ 'empty-state--switching': filterTransitioning }"
        tone="error"
        scene="discover"
        :kicker="$t('state.discover.error.kicker')"
        :title="$t('state.discover.error.title')"
        :description="loadError"
        :action-text="$t('state.generic.retry')"
        @action="handleManualRefresh"
      />

      <fit-state-panel
        v-else-if="!feedList.length"
        class="empty-state"
        :class="{ 'empty-state--switching': filterTransitioning }"
        scene="discover"
        :title="isMineView ? '暂无笔记' : '暂无内容'"
        :action-text="hasLogin ? $t('state.generic.postFeed') : $t('state.generic.loginToPost')"
        @action="hasLogin ? openPublish() : goToLogin()"
      />

      <view v-else class="feed-list" :class="{ 'feed-list--switching': filterTransitioning }">
        <view v-for="(item, index) in feedList" :key="item.id || item._id || index" class="feed-item">
          <feed-card
            :item="item"
            :index="index"
            @like="() => onLike(item)"
            @comment="() => onComment(item)"
            @invite="() => openInviteForm(item)"
            @chat="() => openChat(item)"
            @goProfile="() => goProfile(item)"
            @edit="() => onEdit(item)"
            @delete="() => onDelete(item)"
            @cardClick="() => onCardClick(item)"
          />
        </view>

        <view class="feed-footer">
          <uni-load-more v-if="loading" status="loading" color="#72E4C8" />
          <text v-else-if="noMore" class="no-more-text">没有更多了</text>
        </view>
      </view>
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
      <view class="invite-form-box popup-shell popup-shell--dialog">
        <view class="popup-head fit-popup-enter fit-popup-enter--1">
          <text class="popup-kicker">邀请</text>
          <view class="invite-title popup-title">发起约练邀请</view>
        </view>
        <fit-state-panel
          v-if="!inviteTarget"
          class="popup-inline-state fit-popup-enter fit-popup-enter--2"
          compact
          tone="error"
          scene="meet"
          :kicker="$t('state.discover.inviteTarget.kicker')"
          :title="$t('state.discover.inviteTarget.title')"
          :description="$t('state.discover.inviteTarget.description')"
        />
        <view v-if="inviteTarget" class="invite-user popup-user-chip fit-popup-enter fit-popup-enter--2">
          <image class="invite-avatar" :src="inviteTarget.avatar" mode="aspectFill" />
          <view class="popup-user-text">
            <text class="invite-name popup-user-name">{{ inviteTarget.nickname }}</text>
            <text class="popup-user-meta">向对方发送邀约</text>
          </view>
        </view>
        <view class="form-item fit-popup-enter fit-popup-enter--3">
          <text class="form-label">日期</text>
          <picker mode="date" :value="inviteForm.date" @change="onDateChange">
            <view class="form-input picker">{{ inviteForm.date || '请选择日期' }}</view>
          </picker>
        </view>
        <view class="form-item fit-popup-enter fit-popup-enter--4">
          <text class="form-label">地点</text>
          <view class="form-input picker" @click="chooseInviteLocation">
            {{ inviteForm.place || '请选择地点' }}
          </view>
          <fit-state-panel
            v-if="!inviteForm.place"
            class="popup-field-state"
            compact
            scene="meet"
            :kicker="$t('state.discover.invitePlace.kicker')"
            :title="$t('state.discover.invitePlace.title')"
            :description="$t('state.discover.invitePlace.description')"
          />
        </view>
        <view class="form-item fit-popup-enter fit-popup-enter--5">
          <text class="form-label">留言</text>
          <textarea class="form-textarea" placeholder="简单说下你的邀约需求..." placeholder-class="placeholder" maxlength="100" aria-label="邀请留言" v-model="inviteForm.message" />
        </view>
        <view class="invite-actions fit-popup-enter fit-popup-enter--6">
          <button class="btn-cancel" @click="closeInviteForm">取消</button>
          <button class="btn-submit" @click="submitInvite">发送邀请</button>
        </view>
      </view>
    </uni-popup>

    <uni-popup ref="giftPopup" type="center" background-color="rgba(0,0,0,0.5)">
      <view class="gift-box popup-shell popup-shell--dialog">
        <view class="popup-head fit-popup-enter fit-popup-enter--1">
          <text class="popup-kicker">礼物</text>
          <view class="gift-title popup-title">赠送礼物</view>
        </view>
        <fit-state-panel
          v-if="!giftTarget"
          class="popup-inline-state fit-popup-enter fit-popup-enter--2"
          compact
          tone="error"
          scene="discover"
          :kicker="$t('state.discover.giftTarget.kicker')"
          :title="$t('state.discover.giftTarget.title')"
          :description="$t('state.discover.giftTarget.description')"
        />
        <view v-if="giftTarget" class="gift-user popup-user-chip fit-popup-enter fit-popup-enter--2">
          <image class="gift-avatar" :src="giftTarget.avatar" mode="aspectFill" />
          <view class="popup-user-text">
            <text class="gift-name popup-user-name">{{ giftTarget.nickname }}</text>
            <text class="popup-user-meta">为 TA 送上一份鼓励</text>
          </view>
        </view>
        <fit-state-panel
          v-if="giftTarget && !selectedGift"
          class="popup-field-state fit-popup-enter fit-popup-enter--3"
          compact
          scene="discover"
          :kicker="$t('state.discover.giftSelect.kicker')"
          :title="$t('state.discover.giftSelect.title')"
          :description="$t('state.discover.giftSelect.description')"
        />
        <view class="gift-grid fit-popup-enter fit-popup-enter--3">
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
        <view class="gift-actions fit-popup-enter fit-popup-enter--4">
          <button class="btn-cancel" @click="closeGift">取消</button>
          <button class="btn-submit" :loading="giftSubmitting" :disabled="giftSubmitting" @click="submitGift">确认赠送</button>
        </view>
      </view>
    </uni-popup>

    <!-- 评论半屏弹窗 -->
    <uni-popup ref="commentPopup" type="bottom" background-color="#1e1e1e" @change="onCommentPopupChange">
      <view class="comment-sheet popup-shell">
        <view class="popup-head">
          <text class="popup-title">评论 ({{ activeCommentFeedId ? Number(commentStateMap[activeCommentFeedId]?.list?.length || 0) : 0 }})</text>
          <uni-icons type="closeempty" size="24" color="rgba(255,255,255,0.6)" @click="closeCommentPopup" />
        </view>
        <scroll-view scroll-y class="comment-scroll-area">
          <view v-if="activeCommentState.loading" class="inline-comment-hint">评论加载中...</view>
          <view v-else-if="activeCommentState.error" class="inline-comment-error" role="button" @click.stop="refreshInlineComments(activeCommentFeedId)">
            {{ activeCommentState.error }}，点击重试
          </view>
          <view v-else-if="!activeCommentList.length" class="inline-comment-hint">还没有评论，来抢沙发吧</view>
          <view v-else class="inline-comment-list">
            <view v-for="comment in activeCommentList" :key="comment._id || comment.create_date || comment.content" class="inline-comment-item">
              <image class="inline-comment-avatar" :src="comment.avatar || currentAvatar || '/static/logo.png'" mode="aspectFill" />
              <view class="inline-comment-body">
                <view class="inline-comment-meta">
                  <text class="inline-comment-name">{{ comment.nickname || '匿名用户' }}</text>
                  <text class="inline-comment-time">{{ formatCommentTime(comment.create_date) }}</text>
                </view>
                <text class="inline-comment-content">{{ comment.content || '' }}</text>
              </view>
            </view>
          </view>
        </scroll-view>

        <view class="comment-input-bar">
          <input
            class="inline-comment-input"
            :value="getInlineCommentDraft(activeCommentFeedId)"
            maxlength="120"
            placeholder="写下你的评论..."
            placeholder-class="inline-comment-placeholder"
            confirm-type="send"
            @input="onInlineCommentInput(activeCommentFeedId, $event)"
            @confirm="submitInlineComment(activeCommentFeedId)"
          />
          <button
            class="inline-comment-send"
            :loading="activeCommentState.submitting"
            :disabled="activeCommentState.submitting"
            @click.stop="submitInlineComment(activeCommentFeedId)"
          >发送</button>
        </view>
      </view>
    </uni-popup>

    <uni-popup ref="detailPopup" type="bottom">
      <view class="detail-sheet">
        <fit-state-panel
          v-if="!detailTarget"
          class="popup-inline-state"
          compact
          scene="discover"
          :kicker="$t('state.discover.detailTarget.kicker')"
          :title="$t('state.discover.detailTarget.title')"
          :description="$t('state.discover.detailTarget.description')"
        />
        <template v-else>
        <view v-if="detailTarget.cover" class="detail-cover-wrap">
          <image class="detail-cover" :src="detailTarget.cover" mode="aspectFill" />
        </view>
        <view v-else class="detail-cover detail-cover--empty">
          <fit-state-panel
            compact
            scene="profile"
            :kicker="$t('state.discover.detailCover.kicker')"
            :title="$t('state.discover.detailCover.title')"
            :description="$t('state.discover.detailCover.description')"
          />
        </view>
        <view class="detail-body">
          <view class="popup-head detail-head">
            <text class="popup-kicker">笔记详情</text>
            <text class="popup-title detail-title">训练笔记</text>
          </view>
          <view class="detail-user popup-user-chip">
            <image v-if="detailTarget.avatar" class="detail-avatar" :src="detailTarget.avatar" mode="aspectFill" />
            <view v-else class="detail-avatar detail-avatar--empty">
              <uni-icons type="person-filled" size="22" color="rgba(255,255,255,0.4)" />
            </view>
            <view class="detail-user-text popup-user-text">
              <text class="detail-nickname popup-user-name">{{ detailTarget.nickname }}</text>
              <text class="detail-meta popup-user-meta">{{ (detailTarget.location || '未知位置') + ' · ' + resolveTypeLabel(detailTarget.type) + ' · ' + formatDistance(detailTarget.distanceKm) }}</text>
            </view>
          </view>
          <view class="detail-content-block">
            <text class="detail-section-label">正文内容</text>
            <text v-if="detailTarget.content" class="detail-content">{{ detailTarget.content }}</text>
            <fit-state-panel
              v-else
              class="popup-field-state"
              compact
              scene="discover"
              :kicker="$t('state.discover.detailContent.kicker')"
              :title="$t('state.discover.detailContent.title')"
              :description="$t('state.discover.detailContent.description')"
            />
          </view>
          <view v-if="detailTarget.tags && detailTarget.tags.length" class="detail-tags">
            <text v-for="tag in detailTarget.tags" :key="tag" class="detail-tag">#{{ tag }}</text>
          </view>
          <view class="detail-stats">
            <view class="detail-stat-card">
              <text class="detail-stat-value">{{ detailTarget.likeCount }}</text>
              <text class="detail-stat-label">点赞</text>
            </view>
            <view class="detail-stat-card">
              <text class="detail-stat-value">{{ detailTarget.commentCount }}</text>
              <text class="detail-stat-label">评论</text>
            </view>
            <view class="detail-stat-card">
              <text class="detail-stat-value">{{ detailTarget.giftCount }}</text>
              <text class="detail-stat-label">礼物</text>
            </view>
          </view>
          <view class="detail-actions">
            <button class="detail-btn" @click="onLike(detailTarget)">{{ detailTarget.liked ? '已点赞' : '点赞' }}</button>
            <button class="detail-btn" :class="{ disabled: !canInvite(detailTarget) }" :disabled="!canInvite(detailTarget)" @click="openInviteForm(detailTarget)">邀请</button>
            <button class="detail-btn primary" @click="openChat(detailTarget)">私聊</button>
          </view>
          <view class="detail-actions">
            <button class="detail-btn ghost" @click="shareFeed(detailTarget)">分享</button>
            <button class="detail-btn ghost" @click="onComment(detailTarget)">评论</button>
            <button class="detail-btn ghost" @click="onGift(detailTarget)">送礼</button>
          </view>
          <button class="detail-close" @click="closeDetail">关闭</button>
        </view>
        </template>
      </view>
    </uni-popup>
  </view>
</template>

<script>
import FeedCard from './components/feed-card.vue';
import FilterPopups from './components/filter-popups.vue';
import PublishModal from './components/publish-modal.vue';
import FitShimmerStack from '@/components/fit-shimmer-stack.vue';
import FitStatePanel from '@/components/fit-state-panel.vue';
import { apiService } from '@/services/apiService.js';
import { chatService } from '@/services/chatService.js';
import { store } from '@/uni_modules/uni-id-pages/common/store.js';
import { requireLogin as requireAuthLogin, checkMobileBind, getAuthSnapshot } from '@/common/auth.js';
import tabCacheMixin from '@/common/tabCacheMixin.js';
import { useUserStore } from '@/store/user.js';
import storage from '@/common/storage.js';

const DISCOVER_VIEW_MODE_KEY = 'discover_view_mode';
const DISCOVER_OPEN_MINE_KEY = 'discover_open_my_posts';
const DISCOVER_MINE_STATUS_KEY = 'discover_mine_status';
const MAX_INVITE_DISTANCE_KM = 10;
const FEED_STATUS_LABELS = {
  0: '待审核',
  1: '已发布',
  2: '已删除'
};

export default {
  mixins: [tabCacheMixin],
  tabCacheKeys: ['currentFeedIndex', 'filters', 'feedList', 'viewMode', 'mineStatusFilter'],
  components: {
    FeedCard,
    FilterPopups,
    PublishModal,
    FitShimmerStack,
    FitStatePanel
  },
  data() {
    return {
      currentFeedIndex: 0,
      myLocation: {
        latitude: null,
        longitude: null,
        updatedAt: null,
      },
      filters: {
        gender: 'all',
        distance: 'all',
        type: 'all',
        level: 'all'
      },
      genderOptions: [
        { label: '不限', value: 'all', single: false },
        { label: '男', value: 'male', single: true },
        { label: '女', value: 'female', single: true }
      ],
      distanceOptions: [
        { label: '不限', value: 'all' },
        { label: '1km', value: '1km' },
        { label: '3km', value: '3km' },
        { label: '5km', value: '5km' },
        { label: '10km', value: '10km' }
      ],
      typeOptions: [
        { label: '不限', value: 'all' },
        { label: '健身房', value: 'gym' },
        { label: '徒手训练', value: 'bodyweight' },
        { label: '瑜伽', value: 'yoga' },
        { label: '跑步', value: 'run' },
        { label: '普拉提', value: 'pilates' },
        { label: '拳击', value: 'boxing' }
      ],
      levelOptions: [
        { label: '不限', value: 'all' },
        { label: '新手', value: 'beginner' },
        { label: '进阶', value: 'intermediate' },
        { label: '高手', value: 'pro' }
      ],
      feedList: [],
      viewMode: 'all',
      mineStatusFilter: '1',
      loading: false,
      noMore: false,
      page: 1,
      pageSize: 8,
      hasMore: true,
      refreshing: false,
      filterTransitioning: false,
      loadError: '',
      lastUpdatedText: '',
      networkType: 'unknown',
      isOffline: false,
      inviteTarget: null,
      inviteForm: {
        date: '',
        place: '',
        message: ''
      },
      activeCommentFeedId: '',
      commentDraftMap: {},
      commentStateMap: {},
      giftTarget: null,
      selectedGift: '',
      giftSubmitting: false,
      giftOptions: [
        { code: 'drink', label: '运动饮料', emoji: ':)' },
        { code: 'protein', label: '蛋白奶昔', emoji: ':D' },
        { code: 'relax', label: '放松礼包', emoji: ';)' },
        { code: 'rose', label: '玫瑰', emoji: '<3' }
      ],
      detailTarget: null,
      editingFeedId: '',
      publishing: false,
      pendingFeedId: '',
      lastListLoadedAt: 0,
      loadedOnce: false,
      reloadAfterCurrent: false,
      cachedOpenid: '',
      cachedUserInfo: null,
      cachedIsLoggedIn: false,
      fabPattern: {
        color: '#fff',
        backgroundColor: '#72E4C8',
        selectedColor: '#fff',
        buttonColor: '#72E4C8'
      }
    };
  },
  computed: {
    hasLogin() {
      return this.cachedIsLoggedIn || getAuthSnapshot().hasLogin || store.hasLogin;
    },
    userInfo() {
      return this.cachedUserInfo || getAuthSnapshot().userInfo || store.userInfo || {};
    },
    resolvedUserId() {
      return (this.userInfo && this.userInfo._id) || getAuthSnapshot().userId || '';
    },
    currentNickname() {
      const u = this.userInfo;
      return u.nickname || u.username || u.mobile || 'FIT用户';
    },
    currentAvatar() {
      const u = this.userInfo;
      return (u.avatar_file && u.avatar_file.url) || u.avatarUrl || u.avatar || '';
    },
    genderLabel() {
      const option = this.genderOptions.find(item => item.value === this.filters.gender);
      return option ? option.label : '不限';
    },
    distanceLabel() {
      const option = this.distanceOptions.find(item => item.value === this.filters.distance);
      return option ? option.label : '不限';
    },
    publishTypes() {
      return this.typeOptions.filter(item => item.value !== 'all');
    },
    isMineView() {
      return this.viewMode === 'mine';
    },
    browseModeLabel() {
      return this.isMineView ? '我的笔记' : '训练笔记';
    },
    activeFilterCount() {
      return ['gender', 'distance', 'type', 'level'].reduce((count, key) => {
        return count + (this.filters[key] !== 'all' ? 1 : 0);
      }, 0);
    },
    mineStatusOptions() {
      return [
        { label: '已发布', value: '1' },
        { label: '已删除', value: '2' },
        { label: '待审核', value: '0' }
      ];
    },
    statusToneClass() {
      if (this.isOffline) return 'status-banner--warn';
      if (this.loadError) return 'status-banner--error';
      if (this.refreshing) return 'status-banner--info';
      return 'status-banner--quiet';
    },
    statusIcon() {
      if (this.isOffline) return 'wifi';
      if (this.loadError) return 'info';
      if (this.refreshing || this.loading) return 'spinner-cycle';
      return 'checkmarkempty';
    },
    statusIconColor() {
      if (this.isOffline) return '#F3B45A';
      if (this.loadError) return '#FF8F8F';
      if (this.refreshing || this.loading) return '#72E4C8';
      return 'rgba(255,255,255,0.5)';
    },
    statusMessage() {
      if (this.isOffline) return '网络不可用，请检查连接。';
      if (this.loadError) return this.loadError;
      if (this.refreshing) return '正在刷新...';
      return '';
    },
    activeCommentState() {
      return this.activeCommentFeedId ? this.getInlineCommentState(this.activeCommentFeedId) : {
        list: [], loading: false, loaded: false, error: '', submitting: false
      };
    },
    activeCommentList() {
      return this.activeCommentFeedId ? this.getInlineComments(this.activeCommentFeedId) : [];
    }
  },
  onShow() {
    this.syncLoginCache();
    const modeChanged = this.restoreViewMode();
    this.syncNetworkStatus();
    this.requestLocation(false);
    if (this.loading) return;
    if (!this.loadedOnce || modeChanged) {
      this.loadDiscoverList(true);
    }
  },
  onLoad(options = {}) {
    this.pendingFeedId = options.feedId ? decodeURIComponent(options.feedId) : '';
    this.syncLoginCache();
    this.restoreViewMode();
    this.syncNetworkStatus();
    this.requestLocation(true);
    if (typeof uni.onNetworkStatusChange === 'function' && !this._networkBound) {
      this._networkBound = true;
      uni.onNetworkStatusChange(this.handleNetworkChange);
    }
    this.loadDiscoverList(true);
    uni.$on('uni-id-pages-login-success', () => {
      this.syncLoginCache();
      this.loadDiscoverList(true);
    });
    uni.$on('uni-id-pages-logout', () => {
      this.syncLoginCache();
      this.loadDiscoverList(true);
    });
  },
  onUnload() {
    uni.$off('uni-id-pages-login-success');
    uni.$off('uni-id-pages-logout');
    if (typeof uni.offNetworkStatusChange === 'function' && this._networkBound) {
      uni.offNetworkStatusChange(this.handleNetworkChange);
    }
    this._networkBound = false;
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
    requestLocation(forceRefresh = true) {
      const lastUpdated = Number(this.myLocation.updatedAt || 0);
      if (!forceRefresh && lastUpdated && Date.now() - lastUpdated < 5 * 60 * 1000) {
        return;
      }
      if (typeof uni.getLocation !== 'function') return;
      uni.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        highAccuracyExpireTime: 3000,
        timeout: 8000,
        success: (res) => {
          const prevLat = Number(this.myLocation.latitude);
          const prevLng = Number(this.myLocation.longitude);
          this.myLocation.latitude = Number(res.latitude);
          this.myLocation.longitude = Number(res.longitude);
          this.myLocation.updatedAt = Date.now();
          const locationChanged = !Number.isFinite(prevLat) ||
            !Number.isFinite(prevLng) ||
            Math.abs(prevLat - this.myLocation.latitude) > 0.0001 ||
            Math.abs(prevLng - this.myLocation.longitude) > 0.0001;
          if (locationChanged && (this.filters.distance !== 'all' || !this.feedList.length)) {
            this.loadDiscoverList(true);
          }
        }
      });
    },
    /** 将登录用户信息同步到页面状态，避免状态不同步。 */
    syncLoginCache() {
      try {
        const userStore = useUserStore();
        userStore.syncFromLogin();
        const snapshot = getAuthSnapshot();

        this.cachedOpenid = snapshot.userInfo?.openid || userStore.openid || '';
        this.cachedUserInfo = snapshot.hasLogin ? (snapshot.userInfo || userStore.profile || userStore.userInfo) : null;
        this.cachedIsLoggedIn = !!snapshot.hasLogin;
      } catch (e) {
        console.warn('[discover] syncLoginCache failed:', e);
      }
    },
    requireLogin(cb) {
      const passed = requireAuthLogin({
        message: '请先登录后继续',
        from: '/pages/grid/discover'
      });
      if (!passed) return false;
      if (typeof cb === 'function') cb();
      return true;
    },
    requireMobileBind(cb) {
      return checkMobileBind(() => {
        if (typeof cb === 'function') cb();
      });
    },
    restoreViewMode() {
      const shouldOpenMine = storage.get(DISCOVER_OPEN_MINE_KEY, '') === '1';
      if (shouldOpenMine) {
        storage.remove(DISCOVER_OPEN_MINE_KEY);
      }

      let nextMode = storage.get(DISCOVER_VIEW_MODE_KEY, 'all');
      if (nextMode !== 'mine') {
        nextMode = 'all';
      }

      if (nextMode === 'mine' && !this.hasLogin) {
        nextMode = 'all';
        storage.set(DISCOVER_VIEW_MODE_KEY, nextMode);
      }

      const changed = this.viewMode !== nextMode;
      this.viewMode = nextMode;
      this.restoreMineStatusFilter();

      if (shouldOpenMine && this.viewMode === 'mine') {
        uni.showToast({ title: '已切换到我的笔记', icon: 'none' });
      }

      return changed;
    },
    setViewMode(mode = 'all', options = {}) {
      const nextMode = mode === 'mine' ? 'mine' : 'all';
      if (nextMode === 'mine' && !this.hasLogin) {
        this.goToLogin();
        return;
      }
      if (this.viewMode === nextMode && !options.force) {
        return;
      }
      this.viewMode = nextMode;
      storage.set(DISCOVER_VIEW_MODE_KEY, nextMode);
      if (nextMode !== 'mine') {
        this.mineStatusFilter = '1';
      }
      if (options.toast) {
        uni.showToast({
          title: nextMode === 'mine' ? '已切换到我的笔记' : '已切换到笔记广场',
          icon: 'none'
        });
      }
      if (options.reload !== false) {
        this.loadDiscoverList(true);
      }
    },
    restoreMineStatusFilter() {
      const cached = storage.get(DISCOVER_MINE_STATUS_KEY, '1');
      this.mineStatusFilter = ['0', '1', '2'].includes(String(cached)) ? String(cached) : '1';
    },
    setMineStatusFilter(value) {
      const next = ['0', '1', '2'].includes(String(value)) ? String(value) : '1';
      if (this.mineStatusFilter === next) return;
      this.mineStatusFilter = next;
      storage.set(DISCOVER_MINE_STATUS_KEY, next);
      this.loadDiscoverList(true);
    },
    showAllFeeds() {
      this.setViewMode('all', { toast: true });
    },
    decorateOwnership(list) {
      const uid = this.hasLogin ? this.resolvedUserId : '';
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
        const tags = Array.isArray(item.tags) ? item.tags : (item.tags ? String(item.tags).split(/[，,、\s]+/).filter(Boolean) : []);
        const distance = Number(item.distanceKm);
        const statusValue = Number(item.status);
        const feedId = item.id || item._id || '';
        const userId = item.userId || item.uid || item.user_id || '';
        return {
          ...item,
          id: String(feedId || ''),
          userId: String(userId || ''),
          tags,
          distanceKm: Number.isFinite(distance) ? Number(distance.toFixed(2)) : distance,
          status: Number.isFinite(statusValue) ? statusValue : 1,
          statusLabel: FEED_STATUS_LABELS[statusValue] || FEED_STATUS_LABELS[1],
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
      if (!Number.isFinite(distance)) return false;
      return distance <= limit;
    },
    filterFeed(list) {
      return (list || []).filter(item => this.matchFilters(item));
    },
    warmupInlineComments(list = []) {
      (list || []).slice(0, 4).forEach((item) => {
        this.loadInlineComments(item, { silent: true });
      });
    },
    getLocationParams() {
      const lat = Number(this.myLocation.latitude);
      const lng = Number(this.myLocation.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    },
    async loadDiscoverList(reset = true) {
      if (this.loading) {
        if (reset) this.reloadAfterCurrent = true;
        return;
      }
      if (reset) {
        this.page = 1;
        this.hasMore = true;
        this.noMore = false;
        this.feedList = [];
        this.activeCommentFeedId = '';
        this.commentDraftMap = {};
        this.commentStateMap = {};
      }
      if (!this.hasMore) return;
      if (reset) {
        this.refreshing = true;
      }
      this.loading = true;
      this.loadError = '';
      try {
        const distanceKm = this.filters.distance === 'all' ? undefined : parseInt(this.filters.distance, 10);
        const locationParams = this.getLocationParams();
        const response = await apiService.getDiscoverList({
          page: this.page,
          pageSize: this.pageSize,
          gender: this.filters.gender,
          type: this.filters.type,
          level: this.filters.level,
          userId: this.isMineView ? this.resolvedUserId : undefined,
          status: this.isMineView ? Number(this.mineStatusFilter) : undefined,
          distanceKm: Number.isFinite(distanceKm) ? distanceKm : undefined,
          ...(locationParams || {})
        });
        const list = this.normalizeFeed(apiService.parseList(response));
        const filtered = this.decorateOwnership(this.filterFeed(list));
        if (reset) {
          this.feedList = filtered;
        } else {
          this.feedList = [...this.feedList, ...filtered];
        }
        this.warmupInlineComments(filtered);
        const incomingLen = list.length;
        const hasMore = response && typeof response.hasMore === 'boolean' ? response.hasMore : incomingLen >= this.pageSize;
        this.hasMore = hasMore;
        this.noMore = !hasMore;
        if (incomingLen > 0) {
          this.page += 1;
        }
        this.lastUpdatedText = this.formatRefreshTime();
        this.lastListLoadedAt = Date.now();
        this.loadedOnce = true;
        this.openPendingFeedDetail();
      } catch (error) {
        this.loadError = this.isOffline ? '网络不可用，请检查连接' : (error?.message || '加载失败，请稍后重试');
        uni.showToast({ title: this.loadError, icon: 'none' });
      } finally {
        this.loading = false;
        this.refreshing = false;
        if (this.reloadAfterCurrent) {
          this.reloadAfterCurrent = false;
          this.loadDiscoverList(true);
        }
      }
    },
    loadMore() {
      if (this.loading || this.noMore || !this.hasMore) return;
      this.loadDiscoverList(false);
    },
    async openPendingFeedDetail() {
      const feedId = this.pendingFeedId;
      if (!feedId) return;
      this.pendingFeedId = '';
      const local = (this.feedList || []).find(item => item.id === feedId || item._id === feedId);
      if (local) {
        this.openDetail(local);
        return;
      }
      try {
        const detail = await apiService.getFeedDetail(feedId);
        const normalized = this.decorateOwnership(this.normalizeFeed([detail]))[0];
        if (normalized) {
          this.openDetail(normalized);
        }
      } catch (err) {
        uni.showToast({ title: err?.message || '笔记不可见', icon: 'none' });
      }
    },
    onRefresh() {
      this.refreshing = true;
      this.loadDiscoverList(true);
    },
    handleManualRefresh() {
      this.onRefresh();
    },
    finishFilterTransition() {
      clearTimeout(this._filterTransitionTimer);
      this._filterTransitionTimer = setTimeout(() => {
        this.filterTransitioning = false;
      }, 240);
    },
    syncNetworkStatus() {
      if (typeof uni.getNetworkType !== 'function') return;
      uni.getNetworkType({
        success: ({ networkType }) => {
          this.networkType = networkType || 'unknown';
          this.isOffline = networkType === 'none';
        }
      });
    },
    handleNetworkChange(res = {}) {
      this.networkType = res.networkType || 'unknown';
      this.isOffline = res.isConnected === false || res.networkType === 'none';
      if (this.isOffline) {
        this.loadError = this.feedList.length ? '' : '网络不可用，请检查连接';
      } else if (this.loadError && this.loadError.indexOf('网络不可用') !== -1) {
        this.loadError = '';
      }
    },
    formatRefreshTime() {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    },
    openPicker(key) {
      const popup = this.$refs.filterPopups;
      if (popup) popup.open(key);
    },
    handleFilterChange({ key, value }) {
      if (key === 'distance' && value !== 'all' && !this.getLocationParams()) {
        uni.showToast({ title: '开启定位后才能按距离筛选', icon: 'none' });
        this.requestLocation(true);
        return;
      }
      this.filterTransitioning = true;
      this.filters[key] = value;
      this.feedList = [];
      this.page = 1;
      this.noMore = false;
      this.hasMore = true;
      this.loading = false;
      this.loadDiscoverList(true);
      this.finishFilterTransition();
      uni.showToast({ title: '筛选已更新', icon: 'none', mask: true });
    },
    goToLogin() {
      this.requireLogin();
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
        this.editingFeedId = item.id || item._id;
        this.$refs.publishModal.open({
          content: item.content || '',
          type: item.type || 'gym',
          location: item.location || '',
          photo: item.photo || item.cover || ''
        });
      });
    },
    onDelete(item) {
      if (!item || !item.isMine) return;
      uni.showModal({
        title: '删除笔记',
        content: '确认删除这条训练笔记吗？',
        success: res => {
          if (!res.confirm) return;
          this.requireLogin(async () => {
            uni.showLoading({ title: '删除中' });
            try {
              await apiService.removeFeed(item.id);
              this.feedList = (this.feedList || []).filter(f => f.id !== item.id);
              uni.showToast({ title: '删除成功', icon: 'success' });
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

      if (this.$refs.publishModal) {
        this.$refs.publishModal.setUploadError('');
      }

      this.publishing = true;
      let loadingShown = false;
      try {
        const content = String(formData.content || '').trim();
        if (!content) {
          uni.showToast({ title: '请输入内容', icon: 'none' });
          return;
        }

        uni.showLoading({ title: this.editingFeedId ? '保存中' : '发布中', mask: true });
        loadingShown = true;

        let uploadedPhoto = formData.photo || '';
        if (uploadedPhoto && !uploadedPhoto.startsWith('http') && !uploadedPhoto.startsWith('cloud://')) {
            const ext = uploadedPhoto.split('.').pop()?.toLowerCase() || 'jpg';
            const cloudPath = `feed/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
            const uploadRes = await uniCloud.uploadFile({
                filePath: uploadedPhoto,
                cloudPath,
            });
            uploadedPhoto = uploadRes.fileID;
        }

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
          photo: uploadedPhoto,
          tags: this.extractTagsFromContent(content),
          level: formData.level,
          gender: formData.gender,
        };

        const result = this.editingFeedId
          ? await apiService.callCloud(action, params)
          : await apiService.publishFeed(params);
        if (!result) {
          throw new Error('发布失败，请稍后重试');
        }

        const moderationStatus = result && result.moderationStatus ? String(result.moderationStatus) : '';
        const nextMineStatus = moderationStatus === 'review' ? '0' : '1';
        this.viewMode = 'mine';
        this.mineStatusFilter = nextMineStatus;
        storage.set(DISCOVER_VIEW_MODE_KEY, 'mine');
        storage.set(DISCOVER_MINE_STATUS_KEY, nextMineStatus);
        const successTitle = moderationStatus === 'review'
          ? (this.editingFeedId ? '更新成功，待审核' : '已提交审核')
          : (this.editingFeedId ? '更新成功' : '发布成功');
        uni.showToast({ title: successTitle, icon: 'success' });
        this.editingFeedId = '';
        if (this.$refs.publishModal) {
          this.$refs.publishModal.submitDone();
        }
        this.loadDiscoverList(true);
      } catch (error) {
        if (this.$refs.publishModal) {
          this.$refs.publishModal.submitFail();
        }
        const msg = error?.message || '发布失败，请稍后重试';
          if (msg.includes('url not in domain list') && this.$refs.publishModal) {
            this.$refs.publishModal.setUploadError('图片地址不在白名单，请检查配置。');
          }
        if (msg.includes('token') || msg.includes('登录')) {
          requireAuthLogin({
            message: '登录状态已过期，请重新登录',
            from: '/pages/grid/discover'
          });
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
      this.closeDetailIfMatch(item);
      const feedId = this.getFeedId(item);
      if (!feedId) return;
      this.activeCommentFeedId = feedId;
      this.loadInlineComments(feedId, { silent: true });
      this.$refs.commentPopup.open();
    },
    closeCommentPopup() {
      this.$refs.commentPopup.close();
    },
    onCommentPopupChange(e) {
      if (!e.show) {
        this.activeCommentFeedId = '';
      }
    },
    getFeedId(itemOrId) {
      if (!itemOrId) return '';
      if (typeof itemOrId === 'string' || typeof itemOrId === 'number') return String(itemOrId);
      return String(itemOrId.id || itemOrId._id || '');
    },
    getInlineCommentState(itemOrId) {
      const feedId = this.getFeedId(itemOrId);
      return this.commentStateMap[feedId] || {
        list: [],
        loading: false,
        loaded: false,
        error: '',
        expanded: false,
        submitting: false,
      };
    },
    patchInlineCommentState(itemOrId, patch = {}) {
      const feedId = this.getFeedId(itemOrId);
      if (!feedId) return;
      const prev = this.getInlineCommentState(feedId);
      this.commentStateMap = {
        ...this.commentStateMap,
        [feedId]: {
          ...prev,
          ...patch,
        },
      };
    },
    getInlineComments(itemOrId) {
      const state = this.getInlineCommentState(itemOrId);
      return Array.isArray(state.list) ? state.list : [];
    },
    getInlineCommentsPreview(itemOrId) {
      const state = this.getInlineCommentState(itemOrId);
      const list = this.getInlineComments(itemOrId);
      return state.expanded ? list : list.slice(0, 2);
    },
    getInlineCommentDraft(itemOrId) {
      const feedId = this.getFeedId(itemOrId);
      return feedId ? (this.commentDraftMap[feedId] || '') : '';
    },
    onInlineCommentInput(itemOrId, e) {
      const feedId = this.getFeedId(itemOrId);
      if (!feedId) return;
      const nextValue = e && e.detail ? String(e.detail.value || '') : '';
      this.commentDraftMap = {
        ...this.commentDraftMap,
        [feedId]: nextValue,
      };
    },
    onInlineCommentFocus(itemOrId) {
      const feedId = this.getFeedId(itemOrId);
      if (!feedId) return;
      this.activeCommentFeedId = feedId;
      this.loadInlineComments(feedId, { silent: true });
    },
    activateInlineComment(itemOrId) {
      const feedId = this.getFeedId(itemOrId);
      if (!feedId) return;
      this.activeCommentFeedId = feedId;
      this.loadInlineComments(feedId, { silent: true });
    },
    toggleInlineComments(itemOrId) {
      const state = this.getInlineCommentState(itemOrId);
      this.patchInlineCommentState(itemOrId, { expanded: !state.expanded });
    },
    refreshInlineComments(itemOrId) {
      this.loadInlineComments(itemOrId, { force: true });
    },
    async loadInlineComments(itemOrId, options = {}) {
      const feedId = this.getFeedId(itemOrId);
      if (!feedId) return;
      const { force = false, silent = false } = options;
      const state = this.getInlineCommentState(feedId);
      if (state.loading) return;
      if (state.loaded && !force) return;
      this.patchInlineCommentState(feedId, { loading: true, error: '' });
      try {
        const comments = await apiService.getFeedComments(feedId, 1, 30);
        this.patchInlineCommentState(feedId, {
          list: Array.isArray(comments) ? comments : [],
          loaded: true,
          error: '',
        });
      } catch (err) {
        const errorMessage = err?.message || '评论加载失败，请重试';
        this.patchInlineCommentState(feedId, {
          loaded: false,
          error: errorMessage,
        });
        if (!silent) {
          uni.showToast({ title: errorMessage, icon: 'none' });
        }
      } finally {
        this.patchInlineCommentState(feedId, { loading: false });
      }
    },
    formatCommentTime(timestamp) {
      if (!timestamp) return '刚刚';
      const diff = Date.now() - Number(timestamp);
      if (diff < 60 * 1000) return '刚刚';
      if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / 60000))}分钟前`;
      if (diff < 24 * 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / 3600000))}小时前`;
      const date = new Date(Number(timestamp));
      return `${date.getMonth() + 1}-${date.getDate()}`;
    },
    canInvite(item) {
      if (!item || item.isMine) return false;
      const distance = Number(item.distanceKm);
      return Number.isFinite(distance) && distance <= MAX_INVITE_DISTANCE_KM;
    },
    openInviteForm(item) {
      if (!item) return;
      if (!this.canInvite(item)) {
        uni.showToast({ title: '仅可邀请10公里内用户', icon: 'none' });
        return;
      }
      this.requireMobileBind(() => {
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
    chooseInviteLocation() {
      uni.chooseLocation({
        success: (res) => {
          this.inviteForm.place = res.name || res.address || '已选位置';
        },
        fail: (err) => {
          console.error('[discover] choose location failed:', err);
          if (err.errMsg && err.errMsg.includes('cancel')) return;
          let content = '无法打开地图选择。';
          // #ifdef H5
          if (err.errMsg && err.errMsg.includes('key')) {
            content += '请检查 manifest.json 中 H5 地图配置的 Key 是否正确。';
          }
          // #endif
          uni.showModal({
            title: '提示',
            content,
            showCancel: false
          });
        }
      });
    },
    submitInvite() {
      this.requireMobileBind(async () => {
        if (!this.inviteTarget) return;
        if (!this.canInvite(this.inviteTarget)) {
          uni.showToast({ title: '仅可邀请10公里内用户', icon: 'none' });
          return;
        }
        const locationParams = this.getLocationParams();
        if (!locationParams) {
          uni.showToast({ title: '请先开启定位后再发起约练', icon: 'none' });
          return;
        }
        if (!this.inviteForm.place.trim()) {
          uni.showToast({ title: '请输入地点', icon: 'none' });
          return;
        }
        try {
          await apiService.sendInvite(this.inviteTarget.userId, {
            ...this.inviteForm,
            feedId: this.inviteTarget.id || this.inviteTarget._id || '',
            nickname: this.inviteTarget.nickname || '',
            ...locationParams
          });
          uni.showToast({ title: '邀请已发送', icon: 'success' });
          this.closeInviteForm();
        } catch (err) {
          uni.showToast({ title: err?.message || '发送失败', icon: 'none' });
        }
      });
    },
    openChat(item) {
      if (!item) return;
      this.requireMobileBind(() => {
        this.closeDetailIfMatch(item);
        try {
          storage.set(`user_${item.userId}`, {
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
            uni.showToast({ title: '打开聊天失败', icon: 'none' });
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
        itemList: ['查看详情', '分享笔记', '复制链接', '举报'],
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
            const payload = this.buildSharePayload(item);
            uni.setClipboardData({
              data: payload.path,
              success: () => uni.showToast({ title: '已复制链接', icon: 'none' })
            });
            return;
          }
          if (res.tapIndex === 3) {
            this.requireLogin(() => {
              this.openReportPage(item)
            });
          }
        }
      });
    },
    openReportPage(item) {
      if (!item || !item.id) return
      if (item.isMine) {
        uni.showToast({ title: '不能举报自己的笔记', icon: 'none' })
        return
      }
      const targetNickname = encodeURIComponent(item.nickname || '用户')
      const targetContent = encodeURIComponent(String(item.content || '').slice(0, 120))
      uni.navigateTo({
        url: `/pages/report/create?targetType=feed&targetId=${encodeURIComponent(item.id)}&targetUserId=${encodeURIComponent(item.userId || '')}&targetNickname=${targetNickname}&targetContent=${targetContent}`,
      })
    },
    submitInlineComment(itemOrId) {
      const feedId = this.getFeedId(itemOrId);
      if (!feedId) return;
      this.requireLogin(async () => {
        const state = this.getInlineCommentState(feedId);
        if (state.submitting) return;
        const content = this.getInlineCommentDraft(feedId).trim();
        if (!content) {
          uni.showToast({ title: '请输入评论内容', icon: 'none' });
          return;
        }
        this.patchInlineCommentState(feedId, {
          submitting: true,
          error: '',
        });
        try {
          await apiService.commentFeed(feedId, content);
          const comment = {
            _id: `local_${Date.now()}`,
            nickname: this.currentNickname,
            avatar: this.currentAvatar,
            content,
            create_date: Date.now()
          };
          const prevList = this.getInlineComments(feedId);
          const nextList = [comment, ...prevList];
          this.patchInlineCommentState(feedId, {
            list: nextList,
            loaded: true,
            error: '',
          });
          this.commentDraftMap = {
            ...this.commentDraftMap,
            [feedId]: '',
          };
          if (itemOrId && typeof itemOrId === 'object') {
            itemOrId.commentCount = Number(itemOrId.commentCount || 0) + 1;
          }
          uni.showToast({ title: '评论成功', icon: 'success' });
        } catch (err) {
          uni.showToast({ title: err?.message || '评论失败', icon: 'none' });
        } finally {
          this.patchInlineCommentState(feedId, { submitting: false });
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
        if (this.giftSubmitting) return;
        this.giftSubmitting = true;
        try {
          await apiService.giftFeed(this.giftTarget.id || this.giftTarget._id, this.selectedGift, this.giftTarget.userId);
          this.giftTarget.giftCount = Number(this.giftTarget.giftCount || 0) + 1;
          const targetId = this.giftTarget.id || this.giftTarget._id;
          this.feedList = (this.feedList || []).map(item => {
            if ((item.id || item._id) !== targetId) return item;
            return { ...item, giftCount: Number(item.giftCount || 0) + 1 };
          });
          this.closeGift();
          uni.showToast({ title: '赠送成功', icon: 'success' });
        } catch (err) {
          uni.showToast({ title: err?.message || '赠送失败', icon: 'none' });
        } finally {
          this.giftSubmitting = false;
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
    buildSharePayload(item = {}) {
      const feedId = item.id || '';
      const nickname = item.nickname || 'FIT用户';
      const content = String(item.content || '').trim();
      const summary = content ? content.slice(0, 26) : '';
      const title = summary ? `${nickname}：${summary}` : `${nickname} 发布了新的训练笔记`;
      const text = summary ? `${nickname}：${summary}` : `${nickname} 发布了新的训练笔记`;
      const path = `/pages/grid/discover?feedId=${encodeURIComponent(feedId)}`;
      return { title, text, path };
    },
    shareFeed(item) {
      const target = item || this.detailTarget;
      if (!target || !target.id) {
        uni.showToast({ title: '无法分享', icon: 'none' });
        return;
      }
      const payload = this.buildSharePayload(target);

      // #ifdef H5
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const base = window.location.origin + window.location.pathname;
        navigator
          .share({
            title: payload.title,
            text: payload.text,
            url: `${base}#${payload.path}`,
          })
          .catch(() => {
            uni.setClipboardData({
              data: `${payload.text}\n${payload.path}`,
              success: () => uni.showToast({ title: '已复制分享内容', icon: 'none' }),
            });
          });
        return;
      }
      // #endif

      uni.showActionSheet({
        itemList: ['复制文案+链接', '仅复制链接'],
        success: ({ tapIndex }) => {
          const data = tapIndex === 0 ? `${payload.text}\n${payload.path}` : payload.path;
          uni.setClipboardData({
            data,
            success: () => uni.showToast({ title: '已复制', icon: 'none' }),
          });
        },
      });
    },
    resolveTypeLabel(type) {
      const option = this.typeOptions.find(opt => opt.value === type);
      return option ? option.label : '动态';
    },
    formatDistance(distanceKm) {
      if (!Number.isFinite(distanceKm)) return '距离未知';
      if (distanceKm < 0.1) return '100m内';
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
  min-height: 100%;
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
  &.disabled {
    opacity: 0.42;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255,255,255,0.52);
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

/* Comment Popup Specifics */
.comment-sheet {
  border-radius: 28rpx 28rpx 0 0;
  border-bottom: none;
  display: flex;
  flex-direction: column;
  height: 60vh;
}
.comment-scroll-area {
  flex: 1;
  min-height: 0;
  padding: 0 32rpx;
}
.comment-input-bar {
  padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: rgba(13, 27, 42, 0.6);
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

/* Current discover layout */
.discover-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: visible;
  box-sizing: border-box;
  padding: calc(12rpx + env(safe-area-inset-top)) 16rpx calc(16rpx + env(safe-area-inset-bottom));
  gap: 12rpx;
}

.discover-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 72rpx;
}

.header-title {
  font-size: 42rpx;
  font-weight: 700;
  color: #ffffff;
}

.header-action {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 0 20rpx;
  height: 64rpx;
  border-radius: 999rpx;
  color: #08131D;
  background: linear-gradient(135deg, #72E4C8, #88F1D8);
  font-size: 24rpx;
  font-weight: 600;
}

.discover-hero {
  @include glass-card(rgba(13, 27, 42, 0.72), 12px);
  border-radius: 24rpx;
  padding: 18rpx 20rpx;
  display: flex;
  gap: 12rpx;
  align-items: center;
  justify-content: space-between;
}

.hero-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.hero-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #ffffff;
}

.hero-metrics {
  display: flex;
  gap: 10rpx;
}

.hero-metric {
  min-width: 82rpx;
  @include fit-form-panel(12rpx, 14rpx);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
}

.hero-metric__value {
  font-size: 22rpx;
  font-weight: 700;
  color: #ffffff;
}

.hero-metric__label {
  font-size: 18rpx;
  color: rgba(255,255,255,0.48);
}

.discover-summary {
  display: flex;
  gap: 10rpx;
  align-items: stretch;
  justify-content: flex-end;
}

.summary-card {
  flex: 1;
  min-width: 0;
  @include fit-form-panel(12rpx, 14rpx);
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.summary-label {
  font-size: 18rpx;
  color: rgba(255,255,255,0.48);
}

.summary-value {
  font-size: 28rpx;
  font-weight: 700;
  color: #ffffff;
}

.summary-value.small {
  font-size: 24rpx;
  font-weight: 600;
}

.summary-link {
  @include fit-form-panel(12rpx, 14rpx);
  min-width: 98rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  font-size: 20rpx;
  color: #72E4C8;
}

.summary-link--ghost {
  color: rgba(255,255,255,0.82);
}

.filter-scroll {
  width: 100%;
}

.filter-row {
  display: flex;
  gap: 10rpx;
  padding-right: 14rpx;
}

.filter-chip {
  padding: 10rpx 18rpx;
  gap: 6rpx;
}

.filter-chip .filter-label {
  font-size: 18rpx;
  color: rgba(255,255,255,0.58);
}

.filter-chip .filter-value {
  font-size: 21rpx;
  color: rgba(255,255,255,0.9);
}

.filter-chip.active .filter-label,
.filter-chip.active .filter-value {
  color: #8DE8D5;
}

.mine-status-scroll {
  width: 100%;
}

.mine-status-row {
  display: flex;
  gap: 12rpx;
}

.mine-status-chip {
  @include fit-form-panel(12rpx, 16rpx);
  border-radius: 999rpx;
}

.mine-status-chip.active {
  border-color: rgba(114, 228, 200, 0.48);
  background: rgba(114, 228, 200, 0.14);
}

.mine-status-chip__text {
  font-size: 22rpx;
  color: rgba(255,255,255,0.82);
}

.status-banner {
  @include fit-form-panel(14rpx, 16rpx);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.status-banner__main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
}

.status-banner__text {
  font-size: 22rpx;
  color: rgba(255,255,255,0.76);
}

.status-banner__action {
  font-size: 22rpx;
  color: #72E4C8;
}

.status-banner--warn {
  border-color: rgba(243, 180, 90, 0.35);
  background: rgba(243, 180, 90, 0.10);
}

.status-banner--error {
  border-color: rgba(255, 143, 143, 0.35);
  background: rgba(255, 143, 143, 0.10);
}

.status-banner--info {
  border-color: rgba(114, 228, 200, 0.35);
  background: rgba(114, 228, 200, 0.10);
}

.discover-scroll--switching,
.feed-list--switching,
.empty-state--switching {
  opacity: 0.85;
}

.switch-shimmer {
  margin-bottom: 16rpx;
}

.discover-scroll {
  display: block;
  min-height: 40vh;
}

.feed-list {
  display: flex;
  flex-direction: column;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

.feed-item {
  display: flex;
  flex-direction: column;
}

.inline-comment-card {
  margin: 8rpx 8rpx 20rpx;
  padding: 14rpx 16rpx;
  border-radius: 18rpx;
  background: rgba(8, 19, 29, 0.58);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}

.inline-comment-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10rpx;
}

.inline-comment-title {
  font-size: 22rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.88);
}

.inline-comment-action {
  font-size: 20rpx;
  color: #72E4C8;
}

.inline-comment-hint {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.52);
  padding: 8rpx 0 14rpx;
}

.inline-comment-error {
  font-size: 22rpx;
  color: #FF9C9C;
  padding: 8rpx 0 14rpx;
}

.inline-comment-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.inline-comment-item {
  display: flex;
  gap: 12rpx;
}

.inline-comment-avatar {
  width: 42rpx;
  height: 42rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.inline-comment-body {
  flex: 1;
  min-width: 0;
}

.inline-comment-meta {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.inline-comment-name {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.88);
}

.inline-comment-time {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.42);
}

.inline-comment-content {
  margin-top: 2rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.4;
}

.inline-comment-more {
  margin-top: 8rpx;
  font-size: 20rpx;
  color: rgba(114, 228, 200, 0.92);
}

.inline-comment-input-row {
  margin-top: 12rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.inline-comment-input {
  flex: 1;
  min-width: 0;
  height: 66rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.92);
  font-size: 24rpx;
}

.inline-comment-placeholder {
  color: rgba(255, 255, 255, 0.42);
}

.inline-comment-send {
  width: 120rpx;
  height: 66rpx;
  line-height: 66rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #72E4C8, #88F1D8);
  color: #082233;
  font-size: 22rpx;
  font-weight: 700;
  border: none;
  padding: 0;
}

.inline-comment-send::after {
  border: none;
}

.feed-footer {
  min-height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
