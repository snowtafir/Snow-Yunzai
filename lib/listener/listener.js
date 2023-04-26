import cfg from "../config/config.js"
import PluginsLoader from "../plugins/loader.js"
import express from "express"
import http from "http"

class EventListener {
  async load() {
    Bot.pickFriend = user_id => {
      user_id = Number(user_id) || String(user_id)
      for (const i of Bot.uin)
        if (Bot[i].fl?.has(user_id))
          return Bot[i].pickFriend(user_id)
      logger.error(`获取用户对象失败：找不到用户 ${logger.red(user_id)}`)
      return false
    }
    Bot.pickUser = Bot.pickFriend

    Bot.pickGroup = group_id => {
      if (typeof group_id == "string" && group_id.match("-")) {
        const guild = Bot.pickGuild(group_id.split("-")[0], group_id.split("-")[1])
        if (guild)
          return guild
      }
      group_id = Number(group_id) || String(group_id)
      for (const i of Bot.uin)
        if (Bot[i].gl?.has(group_id))
          return Bot[i].pickGroup(group_id)
      logger.error(`获取群对象失败：找不到群 ${logger.red(group_id)}`)
      return false
    }

    Bot.pickMember = (group_id, user_id) => Bot.pickGroup(group_id).pickMember(user_id)

    Bot.pickGuild = (guild_id, channel_id) => {
      guild_id = String(guild_id)
      for (const i of Bot.uin)
        if (Bot[i].tl?.has(guild_id))
          return Bot[i].pickGuild(guild_id, channel_id)
      logger.error(`获取频道对象失败：找不到频道 ${logger.red(guild_id)}`)
      return false
    }

    Bot.pickGuildMember = (guild_id, channel_id, user_id) => Bot.pickGuild(guild_id, channel_id).pickMember(user_id)

    Bot.getFriendInfo = group_id => Bot.pickFriend(group_id).getInfo()
    Bot.getGroupInfo = group_id => Bot.pickGroup(group_id).getInfo()
    Bot.getGroupMemberInfo = (group_id, user_id) => Bot.pickMember(group_id, user_id).getInfo()
    Bot.getGuildMemberInfo = (guild_id, channel_id, user_id) => Bot.pickGuild(guild_id, channel_id, user_id).getInfo()

    Bot.sendMasterMsg = msg => {
      for (const id in cfg.master)
        for (const i of cfg.master[id])
          try {
            Bot[id].pickFriend(i).sendMsg(msg)
          } catch (err) {
            logger.error(`发送主人消息失败：${err}`)
          }
    }
    Bot.getMasterMsg = async () => {
      while (true) {
        const msg = await new Promise(resolve => {
          Bot.once("message", data => {
            if (cfg.master[data.self_id]?.includes(Number(data.user_id) || String(data.user_id)) && data.message) {
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
        if (msg)
          return msg
      }
    }

    Bot.on("message", data => PluginsLoader.deal(data))
    Bot.on("notice", data => PluginsLoader.deal(data))
    Bot.on("request", data => PluginsLoader.deal(data))

    if (cfg.bot.online_msg)
      Bot.on("connect", async bot => {
        const key = `Yz:loginMsg:${bot.uin}`
        if (await redis.get(key)) return
        redis.set(key, "1", { EX: cfg.bot.online_msg_exp })
        for (const i of cfg.master[bot.uin] ?? [])
          bot.pickFriend(i).sendMsg(`欢迎使用【TRSS-Yunzai v${cfg.package.version}】\n【#帮助】查看指令说明\n【#状态】查看运行状态\n【#日志】查看运行日志\n【#更新】拉取 Git 更新\n【#全部更新】更新全部插件\n【#更新日志】查看更新日志\n【#重启】重新启动\n【#安装插件】查看可安装插件`)
      })

    const bot = {
      stdin: await import("./stdin.js"),
      "go-cqhttp": await import("./go-cqhttp.js"),
      ComWeChat: await import("./ComWeChat.js"),
    }

    const wss = {
      "go-cqhttp": bot["go-cqhttp"].wss,
      ComWeChat: bot.ComWeChat.wss,
    }

    const app = express()
    app.get("*", (req, res) => res.redirect("https://github.com/TimeRainStarSky/Yunzai"))
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

    Bot.emit("online")
  }
}
export default new EventListener()