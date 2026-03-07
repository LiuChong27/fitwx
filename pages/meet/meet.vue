<template>
  <view class="container">
    <uni-nav-bar fixed :status-bar="true" title="约练" :border="false" backgroundColor="rgba(10,22,40,0.85)" color="#ffffff" class="glass-nav"></uni-nav-bar>
    
    <!-- 顶部选项卡 -->
    <view class="tabs-container" role="tablist" aria-label="约练导航">
      <uni-segmented-control :current="current" :values="items" @clickItem="onClickItem" styleType="text" activeColor="#00E5FF"></uni-segmented-control>
    </view>

    <!-- 内容区域 -->
    <view class="content">
      <view v-if="current === 0">
        <!-- 找搭子内容 (发布的需求列表) -->
        <view class="filter-bar">
           <!-- 筛选栏 -->
           <picker mode="selector" :range="sortOptions" @change="onSortChange">
             <view class="filter-item" role="button" aria-label="排序方式">
               {{ currentSort }} <uni-icons type="arrowdown" size="14" color="rgba(255,255,255,0.8)"></uni-icons>
             </view>
           </picker>
           <picker mode="selector" :range="sportOptions" @change="onSportFilterChange">
             <view class="filter-item" role="button" aria-label="运动类型筛选">
               {{ currentSportFilter }} <uni-icons type="arrowdown" size="14" color="rgba(255,255,255,0.8)"></uni-icons>
             </view>
           </picker>
        </view>
        
        <scroll-view scroll-y class="list-scroll" role="list" aria-label="需求列表">
           <view class="needs-item" v-for="(item, index) in filteredNeedsList" :key="index" role="listitem" @click="openDetail(item)">
              <view class="item-header">
                  <image :src="item.avatar" class="avatar" mode="aspectFill"></image>
                  <view class="user-info">
                      <text class="name">{{item.nickname}}</text>
                      <text class="time">{{item.time}}</text>
                  </view>
                  <view class="price-tag">{{item.feeType}}</view>
				  <view class="op" v-if="hasLogin">
					  <button v-if="item.isMine" class="op-btn" size="mini" @click.stop="openEditNeed(item)">编辑</button>
					  <button v-if="item.isMine" class="op-btn danger" size="mini" @click.stop="deleteNeed(item)">删除</button>
					  <button v-else class="op-btn" size="mini" @click.stop="startChat(item)">联系TA</button>
				  </view>
              </view>
              <view class="item-body">
                  <view class="tag-row">
                      <view class="tag">#{{item.sport}}</view>
                      <view class="tag date">{{item.date}}</view>
                  </view>
                  <text class="desc">{{item.desc}}</text>
                  <view class="location-row">
                      <uni-icons type="location-filled" size="16" color="rgba(255,255,255,0.6)"></uni-icons>
                      <text class="location-text">{{item.location}} ({{item.distance}}km)</text>
                  </view>
              </view>
           </view>
        </scroll-view>
      </view>
      
      <view v-if="current === 1">
        <!-- 找教练内容 -->
        <scroll-view scroll-y class="list-scroll">
            <view class="coach-item" v-for="(coach, idx) in coachList" :key="idx" @click="openCoachDetail(coach)">
                <image :src="coach.avatar" class="coach-avatar" mode="aspectFill"></image>
                <view class="coach-info">
                    <view class="coach-header">
                        <text class="coach-name">{{coach.name}}</text>
                        <text class="coach-score">⭐ {{coach.score}}</text>
                    </view>
                    <text class="coach-title">{{coach.title}}</text>
                    <view class="coach-tags">
                        <text v-for="(tag, tIdx) in coach.tags" :key="tIdx" class="c-tag">{{tag}}</text>
                    </view>
                </view>
                <button class="book-btn" size="mini" aria-label="预约教练" @click.stop="openBookPopup(coach)">预约</button>
            </view>
        </scroll-view>
      </view>

            <view v-if="current === 2">
                <inbox-tab ref="inboxTab" @open-chat="openInboxChat" />
            </view>


    </view>
    
    <!-- 悬浮发布按钮 -->
    <view class="fab-btn" role="button" aria-label="发布需求" @click="openPublish">
        <uni-icons type="plusempty" size="30" color="#fff"></uni-icons>
    </view>

    <!-- 发布弹窗 -->
    <uni-popup ref="publishPopup" type="bottom" background-color="#132136">
        <view class="popup-box">
            <view class="popup-bar">
				<text class="popup-title">{{ editingNeedId ? '编辑需求' : '发布需求' }}</text>
                <uni-icons type="closeempty" size="24" color="rgba(255,255,255,0.6)" role="button" aria-label="关闭弹窗" @click="closePublish"></uni-icons>
            </view>
            <scroll-view scroll-y class="popup-scroll">
                <publish-card ref="publishCard" @submit="onPublishSubmit" @chooseLocation="onChooseLocation"></publish-card>
            </scroll-view>
        </view>
    </uni-popup>

    <!-- 详情弹窗 (搭子) -->
    <need-detail-modal ref="detailModal" :item="currentItem" @edit="openEditNeed" @delete="deleteNeed" @chat="startChat" />

    <!-- 预约弹窗 (教练) -->
    <book-coach-popup ref="bookPopupComp" :coach="currentCoach" @confirm="onBookConfirm" />


  </view>
</template>

<script>
import PublishCard from './components/publish-card.vue';
import NeedDetailModal from './components/need-detail-modal.vue';
import BookCoachPopup from './components/book-coach-popup.vue';
import InboxTab from './components/inbox-tab.vue';
import { MEET_SPORT_FILTER_OPTIONS } from './meet.constants.js';
import apiService from '@/services/apiService.js';
import { callFunctionWithToken } from '@/services/cloudCall.js';
import { checkLogin } from '@/common/auth.js';
import chatService from '@/services/chatService.js';
import { store } from '@/uni_modules/uni-id-pages/common/store.js';
import tabCacheMixin from '@/common/tabCacheMixin.js';

const TENCENT_MAP_KEY = 'IRKBZ-VLFLQ-RZQ5U-2Z7YA-KCPTZ-HFBVI';

export default {
  mixins: [tabCacheMixin],
  tabCacheKeys: ['current', 'rawNeedsList', 'coachList', 'currentSort', 'currentSportFilter'],
  components: {
    PublishCard,
    NeedDetailModal,
    BookCoachPopup,
    InboxTab,
  },
  data() {
    return {
      current: 0,
    items: ['找搭子', '找教练', '私信'],
      sortOptions: ['离我最近', '最新发布'],
      currentSort: '离我最近',
    sportOptions: MEET_SPORT_FILTER_OPTIONS,
    currentSportFilter: MEET_SPORT_FILTER_OPTIONS[0],
      
      myLocation: {
          latitude: null,
          longitude: null,
          accuracy: null,
          updatedAt: null
      },
      selectedLocation: null,

      currentItem: null,
      currentCoach: null,

      rawNeedsList: [],
      coachList: [],
      publishing: false, // 防重复提交
      _prevLoginState: false, // 登录态变化检测
	  editingNeedId: '',
    };
  },
  computed: {
      /** 从 store 获取当前用户信息（响应式） */
      userInfo() {
          return store.userInfo || {};
      },
      /** 是否已登录（响应式） */
      hasLogin() {
          return store.hasLogin;
      },
      /** 当前用户显示名 */
      currentNickname() {
          const u = this.userInfo;
          return u.nickname || u.username || u.mobile || '微信用户';
      },
      /** 当前用户头像 */
      currentAvatar() {
          const u = this.userInfo;
          return (u.avatar_file && u.avatar_file.url) || u.avatar || '';
      },
      filteredNeedsList() {
          let list = [...this.rawNeedsList];
          
          if (this.currentSportFilter !== '全部类型') {
              list = list.filter(item => item.sport === this.currentSportFilter || (this.currentSportFilter === '球类' && item.sport.includes('球')));
          }
          
          if (this.currentSort === '离我最近') {
              list.sort((a, b) => (a.distance || 0) - (b.distance || 0));
          } else if (this.currentSort === '最新发布') {
              list.sort((a, b) => b.create_date - a.create_date);
          }
          
          return list;
      }
  },
  onLoad() {
      this.requestLocation();

      this.syncLoginCache();
      this._prevLoginState = this.hasLogin;

      // 监听登录成功事件（uni-id-pages 登录流程完成后触发）
      uni.$on('uni-id-pages-login-success', () => {
          this._prevLoginState = true;
          this.syncLoginCache();
          this.refreshData();
      });

      // 监听退出登录事件
      uni.$on('uni-id-pages-logout', () => {
          this._prevLoginState = false;
          this.refreshData();
      });
  },
  onUnload() {
      uni.$off('uni-id-pages-login-success');
      uni.$off('uni-id-pages-logout');
  },
  onShow() {
      // tabBar 页面每次显示时检测登录态变化
      this.syncLoginCache();
      const lastUpdated = Number(this.myLocation.updatedAt);
      if (!lastUpdated || Date.now() - lastUpdated > 5 * 60 * 1000) {
          this.requestLocation();
      }
      const nowLogin = this.hasLogin;
      if (nowLogin !== this._prevLoginState) {
          this._prevLoginState = nowLogin;
          this.refreshData();
      }

      // 私信自动刷新（在私信 tab 时）
      if (this.current === 2 && this.$refs.inboxTab) {
          this.$refs.inboxTab.refresh();
          this.$refs.inboxTab.startPolling();
      } else if (this.$refs.inboxTab) {
          this.$refs.inboxTab.stopPolling();
      }
  },
  onHide() {
      if (this.$refs.inboxTab) this.$refs.inboxTab.stopPolling();
  },
  methods: {
    requestLocation() {
        // #ifdef H5
        this.requestLocationByTencentSdk().catch(() => this.requestLocationByUni());
        // #endif
        // #ifndef H5
        this.requestLocationByUni();
        // #endif
    },
    requestLocationByUni() {
        uni.getLocation({
            type: 'gcj02',
            isHighAccuracy: true,
            highAccuracyExpireTime: 3000,
            timeout: 8000,
            success: (res) => {
                this.applyLocation(res);
                this.refreshData();
            },
            fail: (err) => {
                this.handleLocationError(err);
                this.refreshData();
            }
        });
    },
    requestLocationByTencentSdk() {
        return this.loadTencentMapSdk().then(() => new Promise((resolve, reject) => {
            if (!window.qq || !window.qq.maps || !window.qq.maps.Geolocation) {
                reject(new Error('Tencent map sdk not available'));
                return;
            }
            const geolocation = new window.qq.maps.Geolocation(TENCENT_MAP_KEY, 'fitmeet');
            geolocation.getLocation(
                (pos) => resolve(pos),
                (err) => reject(err),
                { timeout: 8000 }
            );
        })).then((pos) => {
            this.applyLocation({
                latitude: pos.lat,
                longitude: pos.lng,
                accuracy: pos.accuracy
            });
            this.refreshData();
        }).catch((err) => {
            this.handleLocationError(err);
            return Promise.reject(err);
        });
    },
    loadTencentMapSdk() {
        if (this._tencentMapPromise) return this._tencentMapPromise;
        this._tencentMapPromise = new Promise((resolve, reject) => {
            if (window.qq && window.qq.maps) {
                resolve(window.qq);
                return;
            }
            const script = document.createElement('script');
            script.src = `https://map.qq.com/api/js?v=2.exp&key=${TENCENT_MAP_KEY}`;
            script.async = true;
            script.onload = () => resolve(window.qq);
            script.onerror = () => reject(new Error('Tencent map sdk load failed'));
            document.head.appendChild(script);
        });
        return this._tencentMapPromise;
    },
    applyLocation(res) {
        this.myLocation.latitude = res.latitude;
        this.myLocation.longitude = res.longitude;
        const accuracy = Number(res.accuracy);
        this.myLocation.accuracy = Number.isFinite(accuracy) ? accuracy : null;
        this.myLocation.updatedAt = Date.now();
    },
    handleLocationError(err) {
        console.error('Location fail:', err);
        const errMsg = err && err.errMsg ? err.errMsg : '未知错误';
        if (errMsg.indexOf('auth') !== -1) {
            uni.showToast({ title: '请授权定位权限', icon: 'none' });
        }
    },
    getLocationParams() {
        const lat = Number(this.myLocation.latitude);
        const lng = Number(this.myLocation.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
            lat,
            lng,
            location_geo: {
                type: 'Point',
                coordinates: [lng, lat]
            }
        };
    },
    /**
     * 将登录态持久化到本地，避免页面跳转后 token / uid 丢失
     */
    syncLoginCache() {
        try {
            const { useUserStore } = require('@/store/user.js');
            const userStore = useUserStore();
            userStore.syncFromLogin();
        } catch (e) {
            console.warn('[meet] syncLoginCache failed:', e);
        }
    },
    decorateOwnership(list) {
        const uid = this.hasLogin ? this.userInfo._id : '';
        return (list || []).map(item => {
            const ownerUid = item.uid || item.userId || item.user_id || '';
            return {
                ...item,
                isMine: !!uid && ownerUid === uid
            };
        });
    },
    onClickItem(e) {
        if (this.current !== e.currentIndex) {
            this.current = e.currentIndex;
            this.refreshData();
        }
    },
    
    refreshData() {
        if (this.current === 0) {
            this.getNeedsList();
        } else if (this.current === 1) {
            this.getCoachList();
        } else if (this.current === 2) {
            this.$refs.inboxTab && this.$refs.inboxTab.refresh();
        }
    },

    async getNeedsList() {
        uni.showLoading({ title: '加载中...' });
        try {
            const params = {
                sportType: this.currentSportFilter
            };
            const locationParams = this.getLocationParams();
            if (locationParams) {
                Object.assign(params, locationParams);
            }
            const res = await callFunctionWithToken({
                name: 'fit-meet-api',
                data: {
                    action: 'getNeedsList',
                    params
                }
            });
            if (res.result.code === 0) {
                // 数据映射，适配前端字段
                const mapped = res.result.data.map(item => ({
                    ...item,
                    nickname: item.nickname || '用户',
                    avatar: item.avatar || 'https://via.placeholder.com/100',
                    sport: item.sport_type,
                    feeType: item.fee_type,
                    desc: item.desc,
                    date: item.date_str,
                    location: item.location_name,
                    distance: item.distance || item.distance_km || item.distanceKm,
                    time: this.formatTime(item.create_date)
                }));
                this.rawNeedsList = this.decorateOwnership(mapped);
            }
        } catch (e) {
            console.error(e);
            uni.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            uni.hideLoading();
        }
    },

    async getCoachList() {
        uni.showLoading({ title: '加载中...' });
        try {
            const res = await callFunctionWithToken({
                name: 'fit-meet-api',
                data: {
                    action: 'getCoachList',
                    params: {}
                }
            });
            if (res.result.code === 0) {
                this.coachList = res.result.data;
            }
        } catch (e) {
            console.error(e);
            uni.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            uni.hideLoading();
        }
    },
    
    // 简单的时间格式化
    formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
        return (date.getMonth() + 1) + '月' + date.getDate() + '日';
    },

    // 筛选排序逻辑
    onSortChange(e) {
        this.currentSort = this.sortOptions[e.detail.value];
    },
    onSportFilterChange(e) {
        this.currentSportFilter = this.sportOptions[e.detail.value];
        this.getNeedsList(); // 重新请求后端筛选
    },

    // 详情逻辑
    openDetail(item) {
        this.currentItem = item;
        this.$refs.detailModal.open();
    },
    startChat(item) {
        if (!this.requireLogin('发起聊天')) return;
        this.$refs.detailModal && this.$refs.detailModal.close();
        const targetUserId = item.uid || item.userId || item.user_id || '';
        if (!targetUserId) {
            uni.showToast({ title: '用户不存在', icon: 'none' });
            return;
        }
        const nickname = item.nickname ? encodeURIComponent(item.nickname) : '';
        const nicknameParam = nickname ? `&nickname=${nickname}` : '';
        
        const context = {
            type: 'meet',
            id: item._id || item.id,
            title: item.desc ? item.desc.slice(0, 15) : '约练'
        };
        const contextParam = `&context=${encodeURIComponent(JSON.stringify(context))}`;

        uni.navigateTo({ url: `/pages/chat/chat?userId=${targetUserId}${nicknameParam}${contextParam}` });
    },

    async loadInbox() {
        // Delegated to InboxTab component
        this.$refs.inboxTab && this.$refs.inboxTab.refresh();
    },

    openInboxChat(conv) {
        if (!conv || !conv.targetUserId) return;
        if (!this.requireLogin('发私信')) return;
        try {
            const storageModule = require('@/common/storage.js');
            storageModule.default.set(`user_${conv.targetUserId}`, {
                userId: conv.targetUserId,
                nickname: conv.nickname,
                avatar: conv.avatar,
            });
        } catch (_) { /* ignore */ }

        const url = `/pages/chat/chat?conversationId=${conv.conversationId}&userId=${conv.targetUserId}&nickname=${encodeURIComponent(conv.nickname || '')}`;
        uni.navigateTo({ url });
    },
    
    // 教练详情与预约
    openCoachDetail(coach) {
        uni.showToast({ title: '查看教练详情: ' + coach.name, icon: 'none' });
    },
    /** 登录守卫：统一的未登录引导 */
    requireLogin(actionName) {
        if (this.hasLogin) return true;
        uni.showModal({
            title: '请先登录',
            content: `${actionName}需要登录后使用`,
            confirmText: '去登录',
            success: (res) => {
                if (res.confirm) {
                    uni.navigateTo({ url: '/pages/login/login-withoutpwd' });
                }
            },
        });
        return false;
    },

    openBookPopup(coach) {
        if (!this.requireLogin('预约教练')) return;
        this.currentCoach = coach;
        this.$refs.bookPopupComp.open();
    },
    async onBookConfirm({ tag, note, coach }) {
        uni.showLoading({ title: '提交中...' });
        try {
            const res = await callFunctionWithToken({
                name: 'fit-meet-api',
                data: {
                    action: 'bookCoach',
                    params: {
                        coach_id: coach._id,
                        coach_name: coach.name,
                        project: tag,
                        note: note
                    }
                }
            });
            if (res.result.code === 0) {
                uni.showToast({ title: '预约申请已发送', icon: 'success' });
                this.$refs.bookPopupComp.close();
            } else {
                 uni.showToast({ title: res.result.msg || '预约失败', icon: 'none' });
            }
        } catch (e) {
             uni.showToast({ title: '网络错误', icon: 'none' });
        } finally {
            uni.hideLoading();
        }
    },

    openPublish() {
        checkLogin(() => {
			this.$refs.publishPopup.open();
		});
    },
    closePublish() {
        this.$refs.publishPopup.close();
        this.editingNeedId = '';
        try {
            this.$refs.publishCard && this.$refs.publishCard.resetForm && this.$refs.publishCard.resetForm();
        } catch (_) { /* ignore */ }
    },

    openEditNeed(item) {
        if (!item || !item.isMine) return;
        checkLogin(() => {
            this.editingNeedId = item._id || item.id || '';
            this.$refs.detailModal && this.$refs.detailModal.close && this.$refs.detailModal.close();
            this.$refs.publishPopup.open();
            this.$nextTick(() => {
                if (!this.$refs.publishCard || !this.$refs.publishCard.setDraft) return;
                const draft = {
                    sportType: item.sport || item.sport_type || '',
                    date: (item.date || item.date_str || '').split(' ')[0] || '',
                    time: (item.date || item.date_str || '').split(' ')[1] || '08:00-10:00',
                    level: item.level || '大众',
                    fee: (String(item.feeType || '').match(/\d+/) || [])[0] || '',
                    location: item.location || item.location_name || '',
                    address: item.location_address || '',
                    latitude: item.location_geo && item.location_geo.coordinates ? item.location_geo.coordinates[1] : null,
                    longitude: item.location_geo && item.location_geo.coordinates ? item.location_geo.coordinates[0] : null,
                    note: item.desc || '',
                };
                this.$refs.publishCard.setDraft(draft);
            });
        });
    },

    deleteNeed(item) {
        if (!item || !item.isMine) return;
        checkLogin(() => {
            const needId = item._id || item.id;
            if (!needId) {
                uni.showToast({ title: '需求ID缺失', icon: 'none' });
                return;
            }
            uni.showModal({
                title: '确认删除',
                content: '删除后不可恢复，确认继续？',
                success: async (res) => {
                    if (!res.confirm) return;
                    uni.showLoading({ title: '删除中...' });
                    try {
                        const r = await callFunctionWithToken({
                            name: 'fit-meet-api',
                            data: { action: 'removeNeed', params: { needId } }
                        });
                        if (r.result && r.result.code === 0) {
                            uni.showToast({ title: '已删除', icon: 'success' });
                            this.$refs.detailModal && this.$refs.detailModal.close && this.$refs.detailModal.close();
                            this.getNeedsList();
                        } else {
                            uni.showToast({ title: r.result?.msg || '删除失败', icon: 'none' });
                        }
                    } catch (e) {
                        console.error('[meet] removeNeed failed:', e);
                        uni.showToast({ title: '网络异常', icon: 'none' });
                    } finally {
                        uni.hideLoading();
                    }
                }
            });
        });
    },
    
    async onPublishSubmit(form) {
        checkLogin(async () => {
            if (this.publishing) return; // 防重复提交
            this.publishing = true;

            const feeNum = Number(form.fee);
            const feeType = Number.isFinite(feeNum) && feeNum > 0 ? `${feeNum}元/次` : '免费';
            const dateStr = `${form.date || ''} ${form.time || ''}`.trim();
            const desc = String(form.note || '').trim();

            uni.showLoading({ title: '发布中...' });
            try {
                const action = this.editingNeedId ? 'updateNeed' : 'publishNeed';
                const params = {
                    sport_type: form.sportType,
                    fee_type: feeType,
                    date_str: dateStr,
                    desc: desc,
                    location_name: form.location || '未知',
                    location_address: form.address || '',
                    location_geo: (form.longitude && form.latitude) ? {
                        type: 'Point',
                        coordinates: [form.longitude, form.latitude]
                    } : null,
                };
                const { useUserStore } = require('@/store/user.js');
                const userStore = useUserStore();
                const uid = this.userInfo._id || userStore.userId;
                if (uid) {
                    params.uid = uid;
                }
                if (this.editingNeedId) params.needId = this.editingNeedId;

                const res = await callFunctionWithToken({
                    name: 'fit-meet-api',
                    data: { action, params }
                });

                if (res.result.code === 0) {
                    uni.showToast({ title: this.editingNeedId ? '已更新' : '发布成功', icon: 'success' });
                    this.closePublish();
                    this.getNeedsList();
                } else {
                    const errMsg = res.result.msg || '发布失败';
                    console.error('[meet] publishNeed failed:', errMsg);
                    uni.showToast({ title: errMsg, icon: 'none', duration: 3000 });
                }
            } catch (e) {
                console.error('[meet] publishNeed exception:', e);
                uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
            } finally {
                uni.hideLoading();
                this.publishing = false;
            }
        });
    },
    onChooseLocation() {
        uni.chooseLocation({
            success: (res) => {
                // 确保组件引用存在
                if(this.$refs.publishCard) {
                    // 传递给组件，优先使用 POI 名称，没有则使用详细地址
                    const locationName = res.name || res.address || '已选位置';
                    this.$refs.publishCard.setFormData ? 
                        this.$refs.publishCard.setFormData({
                            location: locationName,
                            address: res.address,
                            latitude: res.latitude,
                            longitude: res.longitude
                        }) :
                        this.$refs.publishCard.setLocation(locationName, {
                            address: res.address,
                            latitude: res.latitude,
                            longitude: res.longitude
                        });
                } else {
                    console.error('publishAnswer ref not found');
                }
            },
            fail: (err) => {
                console.error('Choose location failed:', err);
                const errMsg = err.errMsg || '';
                // 常见错误提示优化
                if (errMsg.includes('cancel')) return; // 用户取消不提示
                
                let content = '无法打开地图选择。';
                // #ifdef H5
                if (errMsg.includes('key')) {
                    content += '请检查 manifest.json 中 H5 地图配置的 Key 是否正确，以及 Key 是否开启了 Web端(JSAPI) 权限。';
                } else if (errMsg.includes('referer') || errMsg.includes('security')) {
                     content += '请检查 Key 的安全域名设置是否包含当前域名。';
                }
                // #endif
                
                uni.showModal({
                    title: '地图错误',
                    content: content + '\n详细信息: ' + errMsg,
                    showCancel: false
                });
            }
        });
    },
  }
};
</script>


<style lang="scss">
/* 引入全局样式 */
@import "@/uni.scss";

.container {
  min-height: 100vh;
  background-color: $neu-dark-bg;
  color: #ffffff;
  /* 适配底部安全区 */
  padding-bottom: calc(30rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
}

.tabs-container {
    padding: 20rpx;
    position: sticky;
    top: 44px;
    z-index: 10;
    background-color: rgba(10, 22, 40, 0.88);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1rpx solid rgba(255,255,255,0.04);
}

.content {
    padding: 20rpx;
}

/* 筛选栏 */
.filter-bar {
    display: flex;
    justify-content: space-around;
    padding: 24rpx 0;
    margin-bottom: 30rpx;
    @include sl-card;
}
.filter-item {
    font-size: 28rpx;
    color: rgba(255,255,255,0.9);
    display: flex;
    align-items: center;
    gap: 12rpx;
}

/* 需求列表样式 */
.needs-item {
    @include sl-card;
    padding: 30rpx;
    margin-bottom: 30rpx;
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                border-color 0.25s ease;
    animation: cardFadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
    &:active {
        transform: scale(0.985);
        border-color: rgba(0, 229, 255, 0.12);
    }
}
@keyframes cardFadeIn {
    from { opacity: 0; transform: translateY(16rpx); }
    to   { opacity: 1; transform: translateY(0); }
}
/* 卡片交错动画延迟 */
.needs-item:nth-child(1) { animation-delay: 0s; }
.needs-item:nth-child(2) { animation-delay: 0.06s; }
.needs-item:nth-child(3) { animation-delay: 0.12s; }
.needs-item:nth-child(4) { animation-delay: 0.18s; }
.needs-item:nth-child(5) { animation-delay: 0.24s; }
.item-header {
    display: flex;
    align-items: center;
    margin-bottom: 24rpx;
}
.avatar {
    width: 88rpx;
    height: 88rpx;
    border-radius: 50%;
    margin-right: 24rpx;
    border: 2rpx solid rgba(0, 229, 255, 0.15);
    box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.2);
}
.user-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.name {
    font-size: 32rpx;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 8rpx;
}
.time {
    font-size: 24rpx;
    color: rgba(255,255,255,0.45);
}
.price-tag {
    font-size: 24rpx;
    color: #FFB74D;
    background: rgba(255, 183, 77, 0.12);
    padding: 6rpx 16rpx;
    border-radius: 12rpx;
    margin-right: 16rpx;
    border: 1px solid rgba(255, 183, 77, 0.15);
}

.op {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12rpx;
    margin-left: auto;
}

.op-btn {
    @include neu-btn;
    font-size: 24rpx;
    padding: 0 24rpx;
    height: 56rpx;
    line-height: 56rpx;
    border-radius: 28rpx;
    color: #ffffff;
    background: transparent; 
}

.op-btn.danger {
  color: #FF5252;
  box-shadow: 3px 3px 6px rgba(0,0,0,0.3), -3px -3px 6px rgba(255,255,255,0.02);
}

.item-body {
    padding-left: 0;
}
.tag-row {
    display: flex;
    gap: 16rpx;
    margin-bottom: 20rpx;
}
.tag {
    font-size: 24rpx;
    color: #00E5FF;
    background: rgba(0, 229, 255, 0.1);
    padding: 6rpx 16rpx;
    border-radius: 16rpx;
    border: 1px solid rgba(0, 229, 255, 0.15);
    transition: background 0.2s ease;
}
.tag.date {
    color: rgba(255,255,255,0.8);
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
}
.desc {
    font-size: 28rpx;
    color: rgba(255,255,255,0.85);
    line-height: 1.6;
    margin-bottom: 24rpx;
    display: block;
}
.location-row {
    display: flex;
    align-items: center;
    gap: 10rpx;
}
.location-text {
    font-size: 24rpx;
    color: rgba(255,255,255,0.5);
}

/* 教练列表样式 */
.coach-item {
    @include sl-card;
    padding: 30rpx;
    margin-bottom: 30rpx;
    display: flex;
    align-items: center;
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    animation: cardFadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
    &:active {
        transform: scale(0.985);
    }
}
.coach-avatar {
    width: 110rpx;
    height: 110rpx;
    border-radius: 20rpx;
    margin-right: 24rpx;
    border: 1px solid rgba(0, 229, 255, 0.1);
    box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.2);
}
.coach-info {
    flex: 1;
}
.coach-header {
    display: flex;
    align-items: center;
    gap: 16rpx;
    margin-bottom: 10rpx;
}
.coach-name {
    font-size: 32rpx;
    font-weight: 600;
    color: #ffffff;
}
.coach-score {
    font-size: 24rpx;
    color: #FFB74D;
}
.coach-title {
    font-size: 26rpx;
    color: rgba(255,255,255,0.6);
    margin-bottom: 12rpx;
    display: block;
}
.coach-tags {
    display: flex;
    gap: 12rpx;
}
.c-tag {
    font-size: 22rpx;
    color: rgba(255,255,255,0.55);
    border: 1px solid rgba(255,255,255,0.1);
    padding: 4rpx 10rpx;
    border-radius: 8rpx;
}
.book-btn {
    @include sl-btn-primary;
    font-size: 26rpx;
    margin: 0;
    padding: 0 30rpx;
    height: 64rpx;
    line-height: 64rpx;
    border-radius: 32rpx;
}

/* 悬浮按钮 */
.fab-btn {
    position: fixed;
    right: 40rpx;
    bottom: 150rpx;
    width: 112rpx;
    height: 112rpx;
    background: $sl-gradient-primary;
    box-shadow: 0 8rpx 32rpx rgba(0, 229, 255, 0.35);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    border: none;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    animation: fabBreath 3s ease-in-out infinite;
    
    &:active {
      transform: scale(0.9) rotate(90deg);
      box-shadow: 0 4rpx 16rpx rgba(0, 229, 255, 0.25);
    }
}
@keyframes fabBreath {
    0%, 100% { box-shadow: 0 8rpx 32rpx rgba(0, 229, 255, 0.3); }
    50%      { box-shadow: 0 8rpx 48rpx rgba(0, 229, 255, 0.5); }
}

/* 底部弹窗样式 */
.popup-box {
    background-color: $sl-card-bg-solid;
    border-radius: 30rpx 30rpx 0 0;
    padding-bottom: constant(safe-area-inset-bottom);
    padding-bottom: env(safe-area-inset-bottom);
    border-top: 1px solid rgba(0, 229, 255, 0.08);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 -8rpx 40rpx rgba(0,0,0,0.3);
}
.popup-scroll {
    flex: 1;
    max-height: calc(80vh - 100rpx);
}
.popup-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 30rpx;
    border-bottom: 1px solid rgba(255,255,255,0.06);
}
.popup-title {
    font-size: 34rpx;
    font-weight: 600;
    color: #ffffff;
}

/* 详情弹窗样式 */
.detail-card {
  width: 600rpx;
  @include glass-card(rgba(13, 27, 42, 0.95));
  border-radius: 30rpx;
  padding: 40rpx;
  box-shadow: 0 16rpx 60rpx rgba(0,0,0,0.4);
  border: 1px solid rgba(0, 229, 255, 0.08);
}
.d-header {
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding-bottom: 30rpx;
  margin-bottom: 30rpx;
}
.d-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  margin-right: 24rpx;
  border: 1px solid rgba(0, 229, 255, 0.15);
}
.d-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.d-name {
  font-size: 34rpx;
  font-weight: 600;
  color: #ffffff;
}
.d-time {
  font-size: 24rpx;
  color: rgba(255,255,255,0.45);
  margin-top: 6rpx;
}
.d-price {
  font-size: 26rpx;
  color: #FFB74D;
  background: rgba(255, 183, 77, 0.1);
  padding: 8rpx 20rpx;
  border-radius: 30rpx;
  border: 1px solid rgba(255, 183, 77, 0.15);
}
.d-body {
  margin-bottom: 40rpx;
}
.d-row {
  display: flex;
  margin-bottom: 20rpx;
  font-size: 30rpx;
  color: rgba(255,255,255,0.85);
}
.d-row .label {
  color: rgba(255,255,255,0.45);
  width: 110rpx;
}
.d-desc {
  background: rgba(0, 229, 255, 0.04);
  padding: 24rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  color: rgba(255,255,255,0.75);
  line-height: 1.6;
  margin-top: 24rpx;
  border: 1px solid rgba(0, 229, 255, 0.06);
}
.d-footer {
  display: flex;
  justify-content: flex-end;
  gap: 20rpx;
}

/* 预约弹单样式 */
.book-form {
  padding: 30rpx;
}
.form-item {
  margin-bottom: 40rpx;
}
.form-item .label {
  display: block;
  font-size: 30rpx;
  color: rgba(255,255,255,0.85);
  margin-bottom: 24rpx;
  font-weight: 600;
}
.tags-select {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
}
.tag-opt {
  padding: 12rpx 34rpx;
  border-radius: 40rpx;
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.55);
  font-size: 28rpx;
  border: 1px solid rgba(255,255,255,0.08);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.tag-opt.active {
  background: rgba(0, 229, 255, 0.12);
  color: #00E5FF;
  border-color: rgba(0, 229, 255, 0.3);
  box-shadow: 0 0 12rpx rgba(0, 229, 255, 0.15);
  transform: scale(1.03);
}
.uni-input {
  background: rgba(0, 229, 255, 0.03);
  padding: 24rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  color: #ffffff;
  border: 1px solid rgba(255,255,255,0.08);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}
.uni-input:focus {
    border-color: rgba(0, 229, 255, 0.35);
    box-shadow: 0 0 0 4rpx rgba(0, 229, 255, 0.08);
}

/* 私信列表 */
.inbox-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20rpx;
    padding: 10rpx 4rpx;
}
.section-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #ffffff;
}
.refresh-btn {
    @include neu-btn;
    padding: 0 24rpx;
    height: 56rpx;
    line-height: 56rpx;
    font-size: 24rpx;
    color: #00E5FF;
}
.conv-item {
    @include sl-card;
    padding: 24rpx;
    margin-bottom: 20rpx;
    display: flex;
    align-items: center;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                border-color 0.2s ease;
    &:active {
        transform: scale(0.985);
        border-color: rgba(0, 229, 255, 0.12);
    }
}
.conv-avatar {
    width: 92rpx;
    height: 92rpx;
    border-radius: 50%;
    margin-right: 20rpx;
    border: 1px solid rgba(0, 229, 255, 0.1);
    box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.2);
}
.conv-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8rpx;
}
.conv-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12rpx;
}
.conv-name {
    font-size: 30rpx;
    font-weight: 600;
    color: #ffffff;
}
.conv-time {
    font-size: 24rpx;
    color: rgba(255,255,255,0.45);
}
.conv-last {
    flex: 1;
    font-size: 26rpx;
    color: rgba(255,255,255,0.7);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.badge {
    min-width: 34rpx;
    padding: 4rpx 12rpx;
    background: linear-gradient(135deg, #FF5252, #FF1744);
    color: #fff;
    border-radius: 20rpx;
    font-size: 22rpx;
    text-align: center;
    margin-left: 12rpx;
    box-shadow: 0 4rpx 12rpx rgba(255, 82, 82, 0.3);
    animation: badgeAppear 0.3s ease-out;
}
@keyframes badgeAppear {
    from { opacity: 0; transform: scale(0.5); }
    to   { opacity: 1; transform: scale(1); }
}
.empty-hint {
    @include sl-card;
    padding: 40rpx;
    text-align: center;
    color: rgba(255,255,255,0.65);
    font-size: 26rpx;
}
</style>
