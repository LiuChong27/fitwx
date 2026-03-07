import App from './App'
import i18n from './lang/i18n'


// #ifndef VUE3
import Vue from 'vue'
Vue.config.productionTip = false
App.mpType = 'app'
const app = new Vue({
	i18n,
	...App
})
app.$mount()
// #endif


// #ifdef VUE3
import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import { setupErrorMonitor } from '@/common/errorMonitor.js'
import pageTrackerMixin from '@/common/pageTrackerMixin.js'

export function createApp() {
	const app = createSSRApp(App)
	app.use(createPinia())
	app.use(i18n)
	setupErrorMonitor(app)
	app.mixin(pageTrackerMixin)
	return { app }
}
// #endif
