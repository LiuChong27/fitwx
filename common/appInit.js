import uniStarterConfig from '@/uni-starter.config.js';
//应用初始化页
// #ifdef APP
import checkUpdate from '@/uni_modules/uni-upgrade-center-app/utils/check-update';
import callCheckVersion from '@/uni_modules/uni-upgrade-center-app/utils/call-check-version';

// 实现，路由拦截。当应用无访问摄像头/相册权限，引导跳到设置界面 https://ext.dcloud.net.cn/plugin?id=5095
import interceptorChooseImage from '@/uni_modules/json-interceptor-chooseImage/js_sdk/main.js';
interceptorChooseImage()

// #endif
const db = uniCloud.database()
export default async function() {
	const debug = uniStarterConfig.debug;

	// uniStarterConfig挂载到getApp().globalData.config
	setTimeout(() => {
		getApp({
			allowDefault: true
		}).globalData.config = uniStarterConfig;
	}, 1)


	// 初始化appVersion（仅app生效）
	initAppVersion();

	//clientDB的错误提示
	function onDBError({
		code, // 错误码详见https://uniapp.dcloud.net.cn/uniCloud/clientdb?id=returnvalue
		message
	}) {
		// 仅保留 error 级别日志，避免生产环境信息泄漏
		console.error('[clientDB]', code, message);
	}
	// 绑定clientDB错误事件
	db.on('error', onDBError)


	//拦截云对象请求
	uniCloud.interceptObject({
		async invoke({
			objectName, // 云对象名称
			methodName, // 云对象的方法名称
			params // 参数列表
		}) {
			// console.log('interceptObject',{
			// 	objectName, // 云对象名称
			// 	methodName, // 云对象的方法名称
			// 	params // 参数列表
			// });
			if(objectName == "uni-id-co" && (methodName.includes('loginBy') ||  ['login','registerUser'].includes(methodName) )){
				params[0].inviteCode = await new Promise((callBack) => {
					uni.getClipboardData({
						success: function(res) {
							const clipData = (res.data || '').trim();
							if (clipData.slice(0, 18) == 'uniInvitationCode:') {
								let uniInvitationCode = clipData.slice(18, 38)
								callBack(uniInvitationCode)
							} else {
								callBack()
							}
						},
						fail() {
							callBack()
						},
						complete() {
							// no-op
						}
					});
				})
				// console.log(params);
			}
			// console.log(params);
		},
		success(e) {
			// 生产环境不输出云对象返回值，避免数据泄漏
		},
		complete() {

		},
		fail(e){
			console.error(e);
			const errMsg = (e && (e.message || e.errMsg)) || JSON.stringify(e);
			if (errMsg.includes('resource exhausted') || errMsg.includes('资源耗尽')) {
				uni.showModal({
					title: '服务繁忙',
					content: '当前服务器资源紧张，请稍后再试。如持续出现请联系管理员升级云服务套餐。',
					showCancel: false
				});
			} else if (debug) {
				uni.showModal({
					content: errMsg,
					showCancel: false
				});
			}
		}
	})


	// #ifdef APP
	// 监听并提示设备网络状态变化
	uni.onNetworkStatusChange(res => {
		if (res.networkType != 'none') {
			uni.showToast({
				title: '当前网络类型：' + res.networkType,
				icon: 'none',
				duration: 3000
			})
		} else {
			uni.showToast({
				title: '网络类型：' + res.networkType,
				icon: 'none',
				duration: 3000
			})
		}
	});
	// #endif

}
/**
 * // 初始化appVersion
 */
function initAppVersion() {
	// #ifdef APP-PLUS
	let appid = plus.runtime.appid;
	plus.runtime.getProperty(appid, (wgtInfo) => {
		let appVersion = plus.runtime;
		let currentVersion = appVersion.versionCode > wgtInfo.versionCode ? appVersion : wgtInfo;
		getApp({
			allowDefault: true
		}).appVersion = {
			...currentVersion,
			appid,
			hasNew: false
		}
		// 检查更新小红点
		callCheckVersion().then(res => {
			// console.log('检查是否有可以更新的版本', res);
			if (res.result.code > 0) {
				// 有新版本
				getApp({
					allowDefault: true
				}).appVersion.hasNew = true;
				checkUpdate();
			}
		})
	});
	// 检查更新
	// #endif
}