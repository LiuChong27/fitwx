<template>
  <!-- 教练预约弹窗 -->
  <uni-popup ref="popup" type="bottom" background-color="#1e1e1e">
    <view class="popup-box">
      <view class="popup-bar">
        <text class="popup-title">预约教练 - {{ coach?.name }}</text>
        <uni-icons type="closeempty" size="24" color="rgba(255,255,255,0.6)" @click="close" />
      </view>
      <view class="book-form">
        <view class="form-item">
          <text class="label">预约项目</text>
          <view class="tags-select">
            <view
              v-for="(tag, idx) in coach?.tags"
              :key="idx"
              class="tag-opt"
              :class="{ active: selectedTag === tag }"
              @click="selectedTag = tag"
            >{{ tag }}</view>
          </view>
        </view>
        <view class="form-item">
          <text class="label">备注信息</text>
          <input class="uni-input" v-model="note" placeholder="请输入您的具体需求或时间偏好" />
        </view>
        <button type="primary" @click="confirm">提交预约</button>
      </view>
    </view>
  </uni-popup>
</template>

<script>
export default {
  name: 'BookCoachPopup',
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

.popup-box {
  background-color: $sl-card-bg-solid;
  border-radius: 30rpx 30rpx 0 0;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  border-top: 1px solid rgba(0, 229, 255, 0.08);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -8rpx 40rpx rgba(0, 0, 0, 0.3);
}
.popup-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.popup-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #ffffff;
}
.book-form {
  padding: 30rpx;
}
.form-item {
  margin-bottom: 40rpx;
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
  padding: 12rpx 34rpx;
  border-radius: 40rpx;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.55);
  font-size: 28rpx;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.tag-opt.active {
  background: rgba(0, 229, 255, 0.12);
  color: #00e5ff;
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
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}
.uni-input:focus {
  border-color: rgba(0, 229, 255, 0.35);
  box-shadow: 0 0 0 4rpx rgba(0, 229, 255, 0.08);
}
</style>
