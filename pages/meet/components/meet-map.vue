<template>
    <view class="map-box">
        <view class="marker-list" v-if="visibleMarkers.length">
            <view class="marker-card" v-for="marker in visibleMarkers" :key="marker.id">
                <view class="marker-row">
                    <text class="marker-title">{{ marker.title }}</text>
                    <text class="marker-type">{{ marker.type }}</text>
                </view>
                <text class="marker-desc">{{ marker.snippet }}</text>
                <text class="marker-desc">{{ marker.extra?.address }}</text>
            </view>
        </view>
        <view class="empty" v-else>
            暂无标记点，发布一条信息试试~
        </view>
    </view>
</template>

<script>
export default {
    props: {
        showOnlyMyMarkers: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            markersByType: {
                my: [],
                activity: [],
                coach: []
            }
        };
    },
    computed: {
        visibleMarkers() {
            if (this.showOnlyMyMarkers) {
                return this.markersByType.my || [];
            }
            return [
                ...(this.markersByType.activity || []),
                ...(this.markersByType.my || [])
            ];
        }
    },
    methods: {
        setMarkersByType(type, markers = []) {
            this.$set(this.markersByType, type, markers.map(item => ({ ...item })));
        }
    }
};
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.map-box {
    background: rgba(10, 22, 40, 0.5);
    border-radius: 24rpx;
    padding: 24rpx;
    border: 1px solid $glass-border;
}
.marker-list {
    margin-top: 20rpx;
    display: flex;
    flex-direction: column;
    gap: 16rpx;
}
.marker-card {
    @include sl-card;
    padding: 16rpx;
    color: rgba(255, 255, 255, 0.85);
}
.marker-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8rpx;
}
.marker-title {
    font-size: 26rpx;
    font-weight: 600;
    color: #fff;
}
.marker-type {
    font-size: 22rpx;
    color: #00E5FF;
}
.marker-desc {
    display: block;
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.5);
}
.empty {
    text-align: center;
    color: rgba(255, 255, 255, 0.35);
    padding: 24rpx 0;
}
</style>
