<template>
    <view class="publish-card">
        <view class="card-header">
            <text class="title">{{ actionLabel }}需求</text>
            <text class="subtitle">完善以下信息，我们会为你匹配合适的搭档</text>
        </view>

        <view class="form-grid">
            <view class="form-item">
                <text class="label">运动类型</text>
                <picker mode="selector" :range="sportOptions" @change="onSelectSport">
                    <view class="picker-value">{{ form.sportType || '选择类型' }}</view>
                </picker>
            </view>
            <view class="form-item">
                <text class="label">日期</text>
                <picker mode="date" :value="form.date" @change="onDateChange">
                    <view class="picker-value">{{ form.date }}</view>
                </picker>
            </view>
            <view class="form-item">
                <text class="label">时间段</text>
                <picker mode="selector" :range="timeSlots" @change="onTimeChange">
                    <view class="picker-value">{{ form.time }}</view>
                </picker>
            </view>
            <view class="form-item">
                <text class="label">运动强度</text>
                <picker mode="selector" :range="levelOptions" @change="onLevelChange">
                    <view class="picker-value">{{ form.level }}</view>
                </picker>
            </view>
            <view class="form-item">
                <text class="label">预算 (¥/次, 可选)</text>
                <input class="input" type="number" placeholder="免费留空" v-model.number="form.fee" />
            </view>
            <view class="form-item full">
                <text class="label">地点</text>
                <view class="location-row" @click="emitChooseLocation">
                    <text class="location-text">{{ form.location || '点击选择地点' }}</text>
                    <text class="choose-btn">选择</text>
                </view>
            </view>
            <view class="form-item full">
                <text class="label">备注</text>
                <textarea class="textarea" v-model="form.note" maxlength="80" placeholder="可填写期望、配速、擅长项目等" />
            </view>
        </view>

        <view class="action-row">
            <button class="ghost-btn" @click="emitChooseLocation">地图选点</button>
            <button class="primary-btn" @click="handleSubmit">发布{{ actionLabel }}</button>
        </view>
    </view>
</template>

<script>
import { MEET_SPORT_OPTIONS } from '../meet.constants.js';
export default {
    props: {
        identity: {
            type: String,
            default: 'findCoach'
        }
    },
    data() {
        const today = this.formatDate(new Date());
        return {
            _today: today,
            form: {
                sportType: '',
                date: today,
                time: '08:00-10:00',
                level: '大众',
                fee: '',
                location: '',
                latitude: null,
                longitude: null,
                note: ''
            },
            sportOptions: MEET_SPORT_OPTIONS,
            timeSlots: ['06:00-08:00', '08:00-10:00', '12:00-14:00', '18:00-20:00', '20:00-22:00'],
            levelOptions: ['大众', '进阶', '专业']
        };
    },
    computed: {
        actionLabel() {
            return this.identity === 'iLead' ? '代练' : '约练';
        }
    },
    methods: {
        formatDate(date) {
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${date.getFullYear()}-${m}-${d}`;
        },
        onSelectSport(e) {
            this.form.sportType = this.sportOptions[e.detail.value];
        },
        onDateChange(e) {
            this.form.date = e.detail.value;
        },
        onTimeChange(e) {
            this.form.time = this.timeSlots[e.detail.value];
        },
        onLevelChange(e) {
            this.form.level = this.levelOptions[e.detail.value];
        },
        emitChooseLocation() {
            this.$emit('chooseLocation');
        },
        // 更通用的数据设置方法
        setFormData(data) {
            this.form.location = data.location || data.name || this.form.location;
            this.form.address = data.address || this.form.address;
            this.form.latitude = data.latitude || this.form.latitude;
            this.form.longitude = data.longitude || this.form.longitude;
        },
        resetForm() {
            this.form = {
                sportType: '',
                date: this._today || this.formatDate(new Date()),
                time: '08:00-10:00',
                level: '大众',
                fee: '',
                location: '',
                latitude: null,
                longitude: null,
                note: ''
            };
        },
        /** 编辑预填（与 handleSubmit payload 同结构） */
        setDraft(draft = {}) {
            this.form = {
                ...this.form,
                sportType: draft.sportType ?? this.form.sportType,
                date: draft.date ?? this.form.date,
                time: draft.time ?? this.form.time,
                level: draft.level ?? this.form.level,
                fee: draft.fee ?? this.form.fee,
                location: draft.location ?? this.form.location,
                address: draft.address ?? this.form.address,
                latitude: draft.latitude ?? this.form.latitude,
                longitude: draft.longitude ?? this.form.longitude,
                note: draft.note ?? this.form.note,
            };
        },
        setLocation(name, locationData) {
            this.form.location = name;
            // 兼容直接传参或对象传参，确保 latitude/longitude 存在
            if (locationData && locationData.latitude) {
                this.form.latitude = locationData.latitude;
                this.form.longitude = locationData.longitude;
                this.form.address = locationData.address;
            } else if (arguments.length > 2) {
                // 兼容旧调用 setLocation(name, lat, lng)
                this.form.latitude = arguments[1];
                this.form.longitude = arguments[2];
            }
        },
        handleSubmit() {
            if (!this.form.sportType) {
                uni.showToast({ title: '请选择运动类型', icon: 'none' });
                return;
            }
            if (!this.form.location) {
                uni.showToast({ title: '请选择地点', icon: 'none' });
                return;
            }
            if (!this.form.note || !this.form.note.trim()) {
                uni.showToast({ title: '请填写备注信息', icon: 'none' });
                return;
            }
            const payload = {
                sportType: this.form.sportType,
                date: this.form.date,
                time: this.form.time,
                level: this.form.level,
                fee: Number(this.form.fee) || 0,
                location: this.form.location,
                address: this.form.address,
                latitude: this.form.latitude,
                longitude: this.form.longitude,
                note: this.form.note.trim()
            };
            this.$emit('submit', payload);
        }
    }
};
</script>

<style lang="scss" scoped>
@import "@/uni.scss";

.publish-card {
    padding: 24rpx 32rpx ;
    color: #fff;
    /* 不设独立背景/圆角——由外层 popup-box 提供 */
}
.card-header {
    margin-bottom: 24rpx;
}
.title {
    font-size: 34rpx;
    font-weight: 600;
}
.subtitle {
    display: block;
    margin-top: 8rpx;
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.55);
}
.form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20rpx;
    margin-top: 40rpx;
}
.form-item {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 16rpx;
    padding: 20rpx;
    border: 1px solid $glass-border;
}
.form-item.full {
    grid-column: span 2;
}
.label {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.55);
}
.picker-value,
.input,
.textarea,
.location-row {
    margin-top: 12rpx;
    font-size: 28rpx;
    color: #fff;
}
.input,
.textarea {
    width: 100%;
    border: none;
    background: transparent;
}
.location-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.location-text {
    flex: 1;
    color: rgba(255, 255, 255, 0.85);
}
.choose-btn {
    color: #00E5FF;
    font-size: 26rpx;
}
.textarea {
    min-height: 120rpx;
}
.action-row {
    margin-top: 28rpx;
    padding-bottom: 16rpx;
    display: flex;
    gap: 16rpx;
}
.ghost-btn,
.primary-btn {
    flex: 1;
    height: 84rpx;
    border-radius: 42rpx;
    border: none;
    font-size: 28rpx;
    &::after { border: none; }
}
.ghost-btn {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.9);
    border: 1px solid $glass-border;
}
.primary-btn {
    @include sl-btn-primary;
    height: 84rpx;
    line-height: 84rpx;
    font-size: 28rpx;
}
</style>
