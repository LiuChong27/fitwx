<template>
    <view class="badges">
        <view class="badge" v-for="item in badges" :key="item.title">
            <text class="badge-icon">{{ item.icon }}</text>
            <view class="badge-info">
                <text class="badge-title">{{ item.title }}</text>
                <text class="badge-desc">{{ item.desc }}</text>
            </view>
        </view>
    </view>
</template>

<script>
export default {
    data() {
        return {
            badges: [
                { icon: '🛡️', title: '身份审核', desc: '教练需通过实名认证与资质审核' },
                { icon: '📍', title: '行程分享', desc: '约练前可一键分享实时位置' },
                { icon: '⚠️', title: '异常提醒', desc: '异常情况快速呼叫平台客服' }
            ]
        };
    }
};
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.badges {
    margin-top: 32rpx;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200rpx, 1fr));
    gap: 16rpx;
}
.badge {
    display: flex;
    gap: 12rpx;
    @include sl-card;
    padding: 16rpx;
}
.badge-icon {
    font-size: 34rpx;
}
.badge-title {
    font-size: 24rpx;
    color: #fff;
}
.badge-desc {
    display: block;
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.5);
}
</style>
