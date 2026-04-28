<template>
  <!-- 学员管理弹窗 -->
  <uni-popup ref="popup" type="bottom">
    <view class="sheet-box">
      <view class="sheet-header">
        <text class="sheet-title">学员管理</text>
        <view class="edit-close" @click="close">
          <uni-icons type="closeempty" size="20" color="rgba(255,255,255,0.6)" />
        </view>
      </view>
      <view class="student-list" v-if="students.length">
        <view class="student-item" v-for="s in students" :key="s.id">
          <image class="student-avatar" :src="s.avatar" mode="aspectFill" />
          <view class="student-info">
            <text class="student-name">{{ s.name }}</text>
            <text class="student-meta">{{ s.level }} · 最近{{ s.lastActive }}</text>
          </view>
          <button class="btn-ghost btn-sm" @click="$emit('chat', s)">私聊</button>
        </view>
      </view>
      <fit-state-panel
        v-else
        compact
        scene="members"
        :kicker="$t('state.profile.studentsEmpty.kicker')"
        :title="$t('state.profile.studentsEmpty.title')"
        :description="$t('state.profile.studentsEmpty.description')"
      />
    </view>
  </uni-popup>
</template>

<script>
  import FitStatePanel from '@/components/fit-state-panel.vue'

export default {
  name: 'StudentsPopup',
    components: {
      FitStatePanel,
    },
  props: {
    students: { type: Array, default: () => [] },
  },
  emits: ['chat'],
  methods: {
    open() {
      this.$refs.popup.open()
    },
    close() {
      this.$refs.popup.close()
    },
  },
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.sheet-box {
  background-color: $sl-card-bg-solid;
  border-radius: 30rpx 30rpx 0 0;
  padding: 40rpx;
  max-height: 70vh;
  overflow-y: auto;
  box-shadow: 0 -8rpx 40rpx rgba(0, 0, 0, 0.4);
}
.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}
.sheet-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #ffffff;
}
.edit-close {
  padding: 8rpx;
}
.student-list {
  max-height: 55vh;
  overflow-y: auto;
}
.student-item {
  @include sl-card;
  padding: 24rpx;
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
}
.student-avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  margin-right: 20rpx;
  border: 1px solid rgba(0, 229, 255, 0.1);
}
.student-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.student-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #ffffff;
}
.student-meta {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.5);
}
.btn-ghost {
  @include neu-btn;
  color: $sl-cyan;
  border: 1px solid rgba(0, 229, 255, 0.2);
  background: transparent;
}
.btn-sm {
  padding: 0 20rpx;
  height: 56rpx;
  line-height: 56rpx;
  font-size: 24rpx;
}
</style>
