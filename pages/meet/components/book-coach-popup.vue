<template>
  <!-- 教练预约弹窗 -->
  <uni-popup ref="popup" type="bottom" background-color="#1e1e1e">
    <view class="popup-box">
      <view class="popup-bar fit-popup-enter fit-popup-enter--1">
        <text class="popup-title">预约教练{{ coach?.name ? ` · ${coach.name}` : '' }}</text>
        <uni-icons type="closeempty" size="24" color="rgba(255,255,255,0.6)" @click="close" />
      </view>
      <view class="book-form">
        <fit-state-panel
          v-if="!coach"
          class="form-state fit-popup-enter fit-popup-enter--2"
          compact
          tone="error"
          scene="coach"
          :kicker="$t('state.meet.bookNoCoach.kicker')"
          :title="$t('state.meet.bookNoCoach.title')"
          :description="$t('state.meet.bookNoCoach.description')"
        />

        <fit-state-panel
          v-else-if="!coach?.tags || !coach?.tags?.length"
          class="form-state fit-popup-enter fit-popup-enter--2"
          compact
          tone="error"
          scene="coach"
          :kicker="$t('state.meet.bookNoTag.kicker')"
          :title="$t('state.meet.bookNoTag.title')"
          :description="$t('state.meet.bookNoTag.description')"
        />

        <view v-else class="form-item fit-popup-enter fit-popup-enter--2">
          <text class="label">预约项目</text>
          <view class="tags-select">
            <view
              v-for="(tag, idx) in (coach && coach.tags) || []"
              :key="idx"
              class="tag-opt"
              :class="{ active: selectedTag === tag }"
              @click="selectedTag = tag"
            >{{ tag }}</view>
          </view>
        </view>
        <view class="form-item fit-popup-enter fit-popup-enter--3">
          <text class="label">备注信息</text>
          <input v-model="note" class="uni-input" placeholder="请输入您的具体需求或时间偏好" />
        </view>
        <button class="submit-btn fit-popup-enter fit-popup-enter--4" :disabled="!coach || !selectedTag" @click="confirm">提交预约</button>
      </view>
    </view>
  </uni-popup>
</template>

<script>
import FitStatePanel from '@/components/fit-state-panel.vue'

export default {
  name: 'BookCoachPopup',
  components: {
    FitStatePanel,
  },
  props: {
    coach: { type: Object, default: null },
  },
  emits: ['confirm'],
  data() {
    return {
      selectedTag: '',
      note: '',
    }
  },
  watch: {
    coach(val) {
      if (val) {
        this.selectedTag = val.tags?.[0] || ''
        this.note = ''
      }
    },
  },
  methods: {
    open() {
      this.$refs.popup.open()
    },
    close() {
      this.$refs.popup.close()
    },
    confirm() {
      if (!this.selectedTag) {
        uni.showToast({ title: '请选择预约项目', icon: 'none' })
        return
      }
      this.$emit('confirm', {
        tag: this.selectedTag,
        note: this.note,
        coach: this.coach,
      })
    },
  },
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

@include fit-popup-enter-classes(4);

.popup-box {
  @include fit-bottom-sheet(30rpx);
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  padding: 30rpx;
}
.form-item {
  margin-bottom: 40rpx;
}

.form-state {
  margin-bottom: 32rpx;
}
.form-item .label {
  display: block;
  font-size: 30rpx;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 24rpx;
  font-weight: 600;
}
.tags-select {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
}
.tag-opt {
  @include fit-pill-button('ghost', 64rpx, 40rpx);
  padding: 0 34rpx;
  color: rgba(255, 255, 255, 0.68);
  font-size: 28rpx;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.tag-opt.active {
  background: rgba(114, 228, 200, 0.12);
  color: #72E4C8;
  border-color: rgba(114, 228, 200, 0.3);
  box-shadow: 0 0 12rpx rgba(114, 228, 200, 0.15);
  transform: scale(1.03);
}
.uni-input {
  @include fit-form-surface(24rpx, 20rpx);
  font-size: 28rpx;
  color: #ffffff;
}

.submit-btn {
  @include fit-pill-button('primary', 84rpx, 42rpx);
  width: 100%;
  font-size: 28rpx;

  &[disabled] {
    opacity: 0.42;
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.32);
    box-shadow: none;
  }
}
</style>
