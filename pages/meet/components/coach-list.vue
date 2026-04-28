<template>
    <view class="coach-list">
        <view class="coach-card" v-for="coach in coaches" :key="coach.id">
            <view class="coach-header">
                <image class="avatar" :src="coach.avatar" mode="aspectFill" />
                <view class="meta">
                    <text class="name">{{ coach.nickname }}</text>
                    <text class="desc">{{ coach.years }}年 · {{ coach.skill }}</text>
                </view>
                <view class="rating">
                    ⭐ {{ coach.rating.toFixed(1) }}
                </view>
            </view>
            <view class="tags">
                <text class="tag" v-for="tag in coach.tags" :key="tag">#{{ tag }}</text>
            </view>
            <view class="price-row">
                <text class="price">¥{{ coach.price }}/次</text>
                <text class="distance">{{ coach.distance }}km · {{ coach.city }}</text>
            </view>
            <view class="actions">
                <button class="ghost-btn" @click="$emit('chat', coach)">私聊</button>
                <button class="primary-btn" @click="$emit('accept', coach)">约他</button>
            </view>
        </view>
            <fit-state-panel
                v-if="!coaches.length"
                class="empty"
                compact
                scene="coach"
                :kicker="$t('state.meet.coachListEmpty.kicker')"
                :title="$t('state.meet.coachListEmpty.title')"
                :description="$t('state.meet.coachListEmpty.description')"
            />
    </view>
</template>

<script>
    import FitStatePanel from '@/components/fit-state-panel.vue'

export default {
        components: {
            FitStatePanel,
        },
    data() {
        return {
            coaches: [
                {
                    id: 'coach_1',
                    nickname: 'Ethan',
                    avatar: '/static/tabbar/grid.png',
                    years: 5,
                    skill: '力量 · 减脂',
                    tags: ['ACE认证', '增肌', '塑形'],
                    price: 168,
                    distance: 1.3,
                    city: '朝阳CBD',
                    rating: 4.9
                },
                {
                    id: 'coach_2',
                    nickname: 'Luna',
                    avatar: '/static/tabbar/home.png',
                    years: 3,
                    skill: '瑜伽 · 普拉提',
                    tags: ['孕产恢复', '柔韧提升'],
                    price: 138,
                    distance: 2.6,
                    city: '望京',
                    rating: 4.8
                },
                {
                    id: 'coach_3',
                    nickname: 'Stone',
                    avatar: '/static/tabbar/user.png',
                    years: 7,
                    skill: '跑步 · 马拉松',
                    tags: ['配速陪跑', '专项拉练'],
                    price: 158,
                    distance: 0.9,
                    city: '蓝港',
                    rating: 5.0
                }
            ]
        };
    }
};
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.coach-card {
    @include sl-card;
    padding: 24rpx;
    margin-bottom: 20rpx;
}
.coach-header {
    display: flex;
    align-items: center;
    gap: 16rpx;
}
.avatar {
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
    border: 2rpx solid rgba(0, 229, 255, 0.3);
}
.meta {
    flex: 1;
    color: #fff;
}
.name {
    font-size: 30rpx;
    font-weight: 600;
}
.desc {
    display: block;
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.55);
}
.rating {
    font-size: 24rpx;
    color: #FFB74D;
}
.tags {
    margin: 16rpx 0;
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
}
.tag {
    padding: 6rpx 16rpx;
    border-radius: 999rpx;
    background: rgba(0, 229, 255, 0.1);
    color: #00E5FF;
    font-size: 22rpx;
}
.price-row {
    display: flex;
    justify-content: space-between;
    font-size: 26rpx;
    color: rgba(255, 255, 255, 0.6);
}
.price {
    color: #00E676;
    font-size: 30rpx;
    font-weight: 600;
}
.actions {
    display: flex;
    gap: 16rpx;
    margin-top: 20rpx;
}
.ghost-btn,
.primary-btn {
    flex: 1;
    height: 72rpx;
    border-radius: 36rpx;
    border: none;
    font-size: 26rpx;
    &::after { border: none; }
}
.ghost-btn {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.85);
    border: 1px solid $glass-border;
}
.primary-btn {
    @include sl-btn-primary;
    height: 72rpx;
    line-height: 72rpx;
    font-size: 26rpx;
}
.empty {
    padding-top: 12rpx;
}
</style>
