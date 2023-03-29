logger.mark('----^_^----')
logger.mark(logger.yellow(`TRSS-Yunzai v${cfg.package.version} 加载中...`))
logger.mark(logger.cyan('https://github.com/TimeRainStarSky/Yunzai'))

import './config/init.js'
import cfg from './config/config.js'
import PluginsLoader from './plugins/loader.js'
import EventListener from './listener/listener.js'
import { EventEmitter } from "events"

export default class Yunzai extends EventEmitter {
  static async run () {
    global.Bot = new Yunzai()
    await PluginsLoader.load()
    await EventListener.load()
  }
}