<template>
  <!-- 编辑资料弹窗 -->
  <uni-popup ref="popup" type="center" background-color="rgba(0,0,0,0.5)">
    <view class="edit-box">
      <view class="edit-header">
        <text class="edit-title">编辑资料</text>
        <view class="edit-close" @click="close">
          <uni-icons type="closeempty" size="20" color="rgba(255,255,255,0.6)" />
        </view>
      </view>
      <view class="edit-row">
        <text class="edit-label">头像</text>
        <view class="edit-avatar-wrap" @click="$emit('choose-avatar')">
          <image v-if="avatarSrc" class="edit-avatar-preview" :src="avatarSrc" mode="aspectFill" />
          <view v-else class="edit-avatar-preview edit-avatar-empty">
            <uni-icons type="camera-filled" size="20" color="rgba(255,255,255,0.4)" />
          </view>
          <text class="edit-avatar-tip">更换</text>
        </view>
      </view>
      <view class="edit-row">
        <text class="edit-label">昵称</text>
        <input v-model="form.nickname" class="edit-input" placeholder="输入昵称" maxlength="20" />
      </view>
      <view class="edit-row">
        <text class="edit-label">性别</text>
        <picker mode="selector" :range="genderOptions" @change="onGenderChange">
          <view class="edit-input picker">{{ form.gender || '请选择' }}</view>
        </picker>
      </view>
      <view class="edit-row">
        <text class="edit-label">年龄</text>
        <input v-model="form.age" class="edit-input" type="number" placeholder="18" />
      </view>
      <view class="edit-row">
        <text class="edit-label">城市</text>
        <input v-model="form.city" class="edit-input" placeholder="所在城市" maxlength="20" />
      </view>
      <view class="edit-row">
        <text class="edit-label">健身房</text>
        <input v-model="form.gymsText" class="edit-input" placeholder="多个用逗号分隔" />
      </view>
      <view class="edit-row">
        <text class="edit-label">单身认证</text>
        <switch :checked="form.singleCert" color="#00E5FF" @change="onSingleChange" />
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
  name: 'EditProfilePopup',
  props: {
    profile: { type: Object, default: () => ({}) },
    avatarSrc: { type: String, default: '' },
  },
  emits: ['saved', 'choose-avatar'],
  data() {
    return {
      genderOptions: ['男', '女'],
      saving: false,
      form: {
        nickname: '',
        gender: '男',
        age: 18,
        city: '',
        singleCert: false,
        gymsText: '',
      },
    }
  },
  methods: {
    open() {
      this.form = {
        nickname: this.profile.nickname || '',
        gender: this.profile.gender || '男',
        age: this.profile.age || 18,
        city: this.profile.city || '',
        singleCert: !!this.profile.singleCert,
        gymsText: (this.profile.gyms || []).join(', '),
      }
      this.$refs.popup.open()
    },
    close() {
      this.$refs.popup.close()
    },
    onGenderChange(e) {
      this.form.gender = this.genderOptions[e.detail.value]
    },
    onSingleChange(e) {
      this.form.singleCert = e.detail.value
    },
    async save() {
      if (this.saving) return
      const { nickname, age: ageStr, city, singleCert, gymsText, gender } = this.form
      const age = Number(ageStr)

      if (!nickname?.trim()) return uni.showToast({ title: '请输入昵称', icon: 'none' })
      if (nickname.trim().length < 2) return uni.showToast({ title: '昵称至少2个字符', icon: 'none' })
      if (!age || age < 12 || age > 80) return uni.showToast({ title: '年龄应在12~80之间', icon: 'none' })
      if (city && city.length > 20) return uni.showToast({ title: '城市名过长', icon: 'none' })

      const gyms = gymsText.split(/[,，]/).map(g => g.trim()).filter(Boolean).slice(0, 6)
      const payload = { nickname: nickname.trim(), gender, age, city: city || this.profile.city, singleCert, gyms }

      this.saving = true
      try {
        const res = await apiService.updateProfile(payload)
        this.$emit('saved', { ...(res || payload), gyms })
        this.close()
        uni.showToast({ title: '资料已更新', icon: 'success' })
      } catch (e) {
        console.error('[editProfile] save failed:', e)
        uni.showModal({
          title: '操作失败',
          content: '保存失败，是否重试？',
          confirmText: '重试',
          cancelText: '取消',
          success: (r) => { if (r.confirm) this.save() },
        })
      } finally {
        this.saving = false
      }
    },
  },
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.edit-box {
  width: 620rpx;
  @include glass-card(rgba(13, 27, 42, 0.96));
  border-radius: 30rpx;
  padding: 40rpx;
  box-shadow: 0 16rpx 60rpx rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(0, 229, 255, 0.08);
}
.edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}
.edit-title {
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
  &.picker {
    padding-right: 8rpx;
  }
}
.edit-avatar-wrap {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.edit-avatar-preview {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  border: 1px solid rgba(0, 229, 255, 0.15);
}
.edit-avatar-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
}
.edit-avatar-tip {
  font-size: 24rpx;
  color: $sl-cyan;
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
