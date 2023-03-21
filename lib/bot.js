logger.mark('----^_^----')
logger.mark(logger.yellow(`TRSS-Yunzai v${cfg.package.version} 加载中...`))
logger.mark(logger.cyan('https://github.com/TimeRainStarSky/Yunzai'))

import './config/init.js'
import cfg from './config/config.js'
import PluginsLoader from './plugins/loader.js'
import EventListener from './listener/listener.js'

export default class Yunzai {
  static async run () {
    global.Bot = this
    await PluginsLoader.load()
    await EventListener.load()
  }
}
