import cfg from "../config/config.js"
import PluginsLoader from "../plugins/loader.js"
import express from "express"
import http from "http"

class EventListener {
  async load() {
    Bot.pickFriend = user_id => {
      user_id = Number(user_id)
      for (const i of Bot.uin)
        if (Bot[i].fl.get(user_id))
          return Bot[i].pickFriend(user_id)
      logger.error(`获取用户对象失败：找不到用户 ${logger.red(user_id)}`)
      return false
    }
    Bot.pickUser = Bot.pickFriend

    Bot.pickGroup = group_id => {
      if (typeof group_id == "string" && group_id.match("-")) {
        group_id = group_id.split("-")
        let guild_id = group_id[0]
        let channel_id = group_id[1]
        for (const i of Bot.uin)
          if (Bot[i].tl.get(guild_id))
            return Bot[i].pickGuild(guild_id, channel_id)
        logger.error(`获取频道对象失败：找不到频道 ${logger.red(guild_id)}`)
      } else {
        group_id = Number(group_id)
        for (const i of Bot.uin)
          if (Bot[i].gl.get(group_id))
            return Bot[i].pickGroup(group_id)
        logger.error(`获取群对象失败：找不到群 ${logger.red(group_id)}`)
      }
      return false
    }

    Bot.pickMember = (group_id, user_id) => Bot.pickGroup(group_id).pickMember(user_id)

    Bot.pickGuild = (guild_id, channel_id) => {
      guild_id = String(guild_id)
      for (const i of Bot.uin)
        if (Bot[i].tl.get(guild_id))
          return Bot[i].pickGuild(guild_id, channel_id)
      logger.error(`获取频道对象失败：找不到频道 ${logger.red(guild_id)}`)
      return false
    }

    Bot.pickGuildMember = (guild_id, channel_id, user_id) => Bot.pickGuild(guild_id, channel_id).pickMember(user_id)

    Bot.getGroupInfo = group_id => Bot.pickGroup(group_id).getInfo()
    Bot.getGroupMemberInfo = (group_id, user_id) => Bot.pickGroup(group_id).getMemberInfo(user_id)
    Bot.getGuildMemberInfo = (guild_id, channel_id, user_id) => Bot.pickGuild(guild_id, channel_id).getMemberInfo(user_id)

    const wss = {
      "go-cqhttp": (await import("./go-cqhttp.js")).default,
      "ComWeChat": (await import("./ComWeChat.js")).default,
    }

    const app = express()
    app.get("/", (req, res) => res.redirect("https://github.com/TimeRainStarSky/Yunzai"))
    const server = http.createServer(app)

    server.on("upgrade", (req, socket, head) => {
      for (const i of Object.keys(wss))
        if (req.url === `/${i}`) {
          wss[i].handleUpgrade(req, socket, head, (conn) => wss[i].emit("connection", conn, req))
          return true
        }
      Object.values(wss)[0].handleUpgrade(req, socket, head, (conn) => Object.values(wss)[0].emit("connection", conn, req))
    })

    server.listen(cfg.bot.port, () => {
      const host = server.address().address
      const port = server.address().port
      logger.mark(`启动 WebSocket 服务器：${logger.green(`ws://[${host}]:${port}`)}`)
      for (const i of Object.keys(wss))
        logger.info(`本机 ${i} 连接地址：${logger.blue(`ws://localhost:${port}/${i}`)}`)
    })

    Bot.on("message", data => PluginsLoader.deal(data))
  }
}
export default new EventListener()
