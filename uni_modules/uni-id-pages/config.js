export default {
  // 调试模式
  debug: false,
  /*
		登录类型 未列举到的或运行环境不支持的，将被自动隐藏。
		如果需要在不同平台有不同的配置，直接用条件编译即可
	*/
  isAdmin: false, // 区分管理端与用户端
  loginTypes: [
    // #ifdef APP
    'univerify',
    // #endif
    // #ifndef MP-HARMONY
    'weixin',
    // #endif
    // #ifdef MP-WEIXIN
    'weixinMobile',
    // #endif
    'smsCode',
    'username',
    // #ifdef APP
    'apple',
    // #endif
    // #ifdef APP-HARMONY || MP-HARMONY
    'huawei',
    'huaweiMobile'
    // #endif
  ],
  // 政策协议
  agreements: {
    serviceUrl: '/pages/uni-agree/uni-agree?type=service', // 用户服务协议链接
    privacyUrl: '/pages/uni-agree/uni-agree?type=privacy', // 隐私政策条款链接
    huaweiConsumerPrivacyUrl: 'https://privacy.consumer.huawei.com/legal/id/authentication-terms.htm?code=CN&language=zh-CN',
    scope: [
      'register', 'login', 'realNameVerify'
    ]
  },
  // 提供各类服务接入（如微信登录服务）的应用id
  appid: {
    weixin: {
      // 微信开放平台的 appid（用于 H5/Web 微信扫码登录）
      // 需在 https://open.weixin.qq.com 创建网站应用后获取
      // 如果暂不需要 H5/Web 端微信登录，可留空
      h5: '',
      web: ''
    }
  },
  /**
	 * 密码强度
	 * super（超强：密码必须包含大小写字母、数字和特殊符号，长度范围：8-16位之间）
	 * strong（强: 密密码必须包含字母、数字和特殊符号，长度范围：8-16位之间）
	 * medium (中：密码必须为字母、数字和特殊符号任意两种的组合，长度范围：8-16位之间)
	 * weak（弱：密码必须包含字母和数字，长度范围：6-16位之间）
	 * 为空或false则不验证密码强度
	 */
  passwordStrength: 'medium',
  /**
	 * 登录后允许用户设置密码（只针对未设置密码得用户）
	 * 开启此功能将 setPasswordAfterLogin 设置为 true 即可
	 * "setPasswordAfterLogin": false
	 *
	 * 如果允许用户跳过设置密码 将 allowSkip 设置为 true
	 * "setPasswordAfterLogin": {
	 *   "allowSkip": true
	 * }
	 * */
  setPasswordAfterLogin: false
}
