export default function(){
	const userprotocol = uni.getStorageSync('userprotocol');
	if(!userprotocol){
		uni.navigateTo({
			url:'/pages/uni-agree/uni-agree',
			animationType:"none"
		})
	}
}
