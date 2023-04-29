import './config/init.js'
import cfg from './config/config.js'
import PluginsLoader from './plugins/loader.js'
import ListenerLoader from './listener/loader.js'
import { EventEmitter } from 'events'

export default class Yunzai extends EventEmitter {
  static async run() {
    global.Bot = new Yunzai()
    await PluginsLoader.load()
    await ListenerLoader.load(Bot)
    Bot.emit("online")
  }

  pickUser(user_id) {
    return this.pickFriend(user_id)
  }

  pickFriend(user_id) {
    user_id = Number(user_id) || String(user_id)
    for (const i of Bot.uin)
      if (Bot[i].fl?.has(user_id))
        return Bot[i].pickFriend(user_id)
    logger.error(`获取用户对象失败：找不到用户 ${logger.red(user_id)}`)
    return false
  }

  pickGroup(group_id) {
    group_id = Number(group_id) || String(group_id)
    for (const i of Bot.uin)
      if (Bot[i].gl?.has(group_id))
        return Bot[i].pickGroup(group_id)
    logger.error(`获取群对象失败：找不到群 ${logger.red(group_id)}`)
    return false
  }

  pickMember(group_id, user_id) {
    return this.pickGroup(group_id)?.pickMember(user_id)
  }

  sendMasterMsg(msg) {
    for (const id in cfg.master)
      for (const i of cfg.master[id])
        try {
          Bot[id].pickFriend(i).sendMsg(msg)
        } catch (err) {
          logger.error(`发送主人消息失败：${err}`)
        }
  }

  async getMasterMsg() {
    while (true) {
      const msg = await new Promise(resolve => {
        Bot.once("message", data => {
          if (cfg.master[data.self_id]?.includes(String(data.user_id)) && data.message) {
            data.msg = ""
            for (let i of data.message)
              if (i.type = "text")
                data.msg += i.text.trim()
            resolve(data.msg)
          } else {
            resolve(false)
          }
        })
      })
      if (msg) return msg
    }
  }
}