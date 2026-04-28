<template>
  <view class="state-panel" :class="[`state-panel--${tone}`, { 'state-panel--compact': compact }]" role="status">
    <view class="state-scene" :class="[`state-scene--${scene}`, `state-scene--${tone}`]" aria-hidden="true">
      <view class="state-scene__halo"></view>
      <view class="state-scene__card state-scene__card--back"></view>
      <view class="state-scene__card state-scene__card--front"></view>
      <view class="state-scene__chip" v-if="sceneTag">{{ sceneTag }}</view>
      <text class="state-scene__icon">{{ iconGlyph }}</text>
    </view>

    <text v-if="resolvedKicker" class="state-kicker">{{ resolvedKicker }}</text>
    <text class="state-title">{{ resolvedTitle }}</text>
    <text v-if="resolvedDescription" class="state-desc">{{ resolvedDescription }}</text>

    <view v-if="resolvedActionText || resolvedSecondaryActionText" class="state-actions">
      <button v-if="resolvedSecondaryActionText" class="state-btn ghost" @click="$emit('secondary-action')">{{ resolvedSecondaryActionText }}</button>
      <button v-if="resolvedActionText" class="state-btn" :class="tone === 'error' ? 'danger' : 'primary'" @click="$emit('action')">{{ resolvedActionText }}</button>
    </view>
  </view>
</template>

<script>
const SCENE_ICON_MAP = {
  discover: '🏋️',
  meet: '🤝',
  coach: '🏅',
  inbox: '📭',
  chat: '💬',
  income: '💹',
  members: '👥',
  profile: '🖼️',
  default: '✨',
  error: '!' 
}

export default {
  name: 'FitStatePanel',
  emits: ['action', 'secondary-action'],
  props: {
    tone: {
      type: String,
      default: 'empty'
    },
    scene: {
      type: String,
      default: 'default'
    },
    kicker: {
      type: String,
      default: ''
    },
    title: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    actionText: {
      type: String,
      default: ''
    },
    secondaryActionText: {
      type: String,
      default: ''
    },
    compact: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    normalizedScene() {
      if (this.tone === 'error') {
        return 'error'
      }
      return this.scene || 'default'
    },
    iconGlyph() {
      return SCENE_ICON_MAP[this.normalizedScene] || SCENE_ICON_MAP.default
    },
    sceneTag() {
      return this.$t(`state.sceneTags.${this.normalizedScene}`)
    },
    resolvedKicker() {
      return this.kicker || ''
    },
    resolvedTitle() {
      return this.title || this.$t('state.generic.emptyTitle')
    },
    resolvedDescription() {
      return this.description || ''
    },
    resolvedActionText() {
      return this.actionText || ''
    },
    resolvedSecondaryActionText() {
      return this.secondaryActionText || ''
    }
  }
}
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.state-panel {
  @include fit-empty-block(96rpx 36rpx 80rpx);
}

.state-panel--compact {
  padding: 40rpx 26rpx;
}

.state-scene {
  @include fit-state-scene;
}

.state-scene__halo {
  position: absolute;
  width: 160rpx;
  height: 160rpx;
  left: 30rpx;
  top: 8rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(114, 228, 200, 0.18), rgba(114, 228, 200, 0));
}

.state-scene__card {
  position: absolute;
  width: 92rpx;
  height: 118rpx;
  border-radius: 26rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.025));
  box-shadow: 0 10rpx 22rpx rgba(0, 0, 0, 0.20);
}

.state-scene__card--back {
  left: 34rpx;
  top: 42rpx;
  transform: rotate(-12deg);
}

.state-scene__card--front {
  right: 34rpx;
  top: 34rpx;
  transform: rotate(10deg);
}

.state-scene__icon {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -42%);
  font-size: 54rpx;
}

.state-scene__chip {
  position: absolute;
  left: 50%;
  bottom: 18rpx;
  transform: translateX(-50%);
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  line-height: 1;
  color: #08131D;
  background: linear-gradient(135deg, rgba(114, 228, 200, 0.94), rgba(141, 232, 213, 0.92));
  white-space: nowrap;
}

.state-scene--error .state-scene__halo {
  background: radial-gradient(circle, rgba(255, 107, 107, 0.24), rgba(255, 107, 107, 0));
}

.state-scene--error .state-scene__chip {
  background: rgba(255, 107, 107, 0.18);
  color: #FFB0B0;
  border: 1rpx solid rgba(255, 107, 107, 0.22);
}

.state-kicker {
  font-size: 22rpx;
  line-height: 1.2;
  letter-spacing: 4rpx;
  text-transform: uppercase;
  color: rgba(141, 232, 213, 0.72);
}

.state-title {
  margin-top: 10rpx;
  font-size: 32rpx;
  line-height: 1.35;
  font-weight: 650;
  color: #FFFFFF;
}

.state-desc {
  margin-top: 12rpx;
  max-width: 580rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.54);
}

.state-actions {
  margin-top: 30rpx;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16rpx;
}

.state-btn {
  @include fit-pill-button('primary', 84rpx, 999rpx);
  min-width: 220rpx;
}

.state-btn.ghost {
  @include fit-pill-button('ghost', 84rpx, 999rpx);
}

.state-btn.danger {
  @include fit-pill-button('danger', 84rpx, 999rpx);
  color: #FFD0D0;
}

.state-panel--compact .state-scene {
  width: 180rpx;
  height: 148rpx;
  margin-bottom: 22rpx;
}

.state-panel--compact .state-title {
  font-size: 30rpx;
}

.state-panel--compact .state-desc {
  font-size: 24rpx;
}

.state-panel--compact .state-btn {
  min-width: 188rpx;
}
</style>
