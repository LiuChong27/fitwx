<template>
  <!-- 教练接单设置弹窗 -->
  <uni-popup ref="popup" type="bottom">
    <view class="sheet-box">
      <view class="sheet-header">
        <text class="sheet-title">接单设置</text>
        <view class="edit-close" @click="close">
          <uni-icons type="closeempty" size="20" color="rgba(255,255,255,0.6)" />
        </view>
      </view>
      <view class="edit-row">
        <text class="edit-label">接单状态</text>
        <switch :checked="form.available" @change="form.available = $event.detail.value" color="#00E5FF" />
      </view>
      <view class="edit-row">
        <text class="edit-label">价格(元/次)</text>
        <input class="edit-input" type="number" v-model="form.price" />
      </view>
      <view class="edit-row">
        <text class="edit-label">擅长项目</text>
        <input class="edit-input" v-model="form.skillsText" placeholder="如:增肌,减脂" />
      </view>
      <view class="edit-row">
        <text class="edit-label">自我介绍</text>
        <textarea class="edit-textarea" v-model="form.intro" placeholder="介绍你的经验" maxlength="200" />
      </view>
      <view class="edit-actions">
        <button class="btn-cancel" @click="close">取消</button>
        <button class="btn-submit" :loading="saving" @click="save">保存</button>
      </view>
    </view>
  </uni-popup>
</template>

<script>
import apiService from '@/services/apiService.js'

export default {
  name: 'CoachSettingsPopup',
  props: {
    settings: { type: Object, default: () => ({}) },
  },
  emits: ['saved'],
  data() {
    return {
      saving: false,
      form: {
        available: true,
        price: 120,
        skillsText: '',
        intro: '',
      },
    }
  },
  methods: {
    open() {
      this.form = {
        available: this.settings.available !== false,
        price: this.settings.price || 120,
        skillsText: this.settings.skillsText || '',
        intro: this.settings.intro || '',
      }
      this.$refs.popup.open()
    },
    close() {
      this.$refs.popup.close()
    },
    async save() {
      if (this.saving) return
      const price = Number(this.form.price)
      if (!price || price < 0 || price > 99999) {
        return uni.showToast({ title: '请输入合理价格', icon: 'none' })
      }
      this.saving = true
      try {
        const res = await apiService.updateCoachSettings(this.form)
        this.$emit('saved', { ...this.form, ...(res || {}) })
        this.close()
        uni.showToast({ title: '接单设置已保存', icon: 'success' })
      } catch (e) {
        console.error('[coachSettings] save failed:', e)
        uni.showToast({ title: '保存失败', icon: 'none' })
      } finally {
        this.saving = false
      }
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
  max-height: 80vh;
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
.edit-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.edit-label {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.7);
  min-width: 140rpx;
}
.edit-input {
  flex: 1;
  text-align: right;
  color: #ffffff;
  font-size: 28rpx;
  background: transparent;
}
.edit-textarea {
  flex: 1;
  color: #ffffff;
  font-size: 26rpx;
  min-height: 120rpx;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12rpx;
  padding: 16rpx;
}
.edit-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 30rpx;
}
.btn-cancel {
  flex: 1;
  @include neu-btn;
  color: rgba(255, 255, 255, 0.6);
}
.btn-submit {
  flex: 1;
  @include neu-btn;
  background: linear-gradient(135deg, $sl-cyan, #00b8d4);
  color: #0a1628;
  font-weight: 600;
}
</style>
