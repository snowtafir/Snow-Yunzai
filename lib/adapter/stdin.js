import fs from "node:fs"

export default class stdinAdapter {
  async makeBuffer(file) {
    if (file.match(/^base64:\/\//))
      return Buffer.from(file.replace(/^base64:\/\//, ""), "base64")
    else if (file.match(/^https?:\/\//))
      return Buffer.from(await (await fetch(file)).arrayBuffer())
    else
      return file
  }

  async sendMsg(msg) {
    if (!Array.isArray(msg))
      msg = [msg]
    for (let i of msg) {
      if (typeof i != "object")
        i = { type: "text", data: { text: i }}
      else if (!i.data)
        i = { type: i.type, data: { ...i, type: undefined }}
      switch (i.type) {
        case "text":
          logger.info(`${logger.blue(`[stdin]`)} 发送文本：\n${i.data.text}`)
          break
        case "image":
          i.file = `${process.cwd()}/data/${Date.now()}.png`
          logger.info(`${logger.blue(`[stdin]`)} 发送图片：${i.data.file.replace(/^base64:\/\/.*/, "base64://...")}\n文件已保存到：${logger.cyan(i.file)}`)
          fs.writeFileSync(i.file, await this.makeBuffer(i.data.file))
          break
        case "record":
          i.file = `${process.cwd()}/data/${Date.now()}.mp3`
          logger.info(`${logger.blue(`[stdin]`)} 发送音频：${i.data.file.replace(/^base64:\/\/.*/, "base64://...")}\n文件已保存到：${logger.cyan(i.file)}`)
          fs.writeFileSync(i.file, await this.makeBuffer(i.data.file))
          break
        case "video":
          i.file = `${process.cwd()}/data/${Date.now()}.mp4`
          logger.info(`${logger.blue(`[stdin]`)} 发送视频：${i.data.file.replace(/^base64:\/\/.*/, "base64://...")}\n文件已保存到：${logger.cyan(i.file)}`)
          fs.writeFileSync(i.file, await this.makeBuffer(i.data.file))
          break
        case "reply":
          break
        case "at":
          break
        default:
          i = JSON.stringify(i)
          logger.info(`${logger.blue(`[stdin]`)} 发送消息：\n${i}`)
      }
    }
    return { message_id: Date.now() }
  }

  recallMsg(message_id) {
    logger.info(`${logger.blue(`[stdin]`)} 撤回消息：${message_id}`)
  }

  makeForwardMsg(msg) {
    const messages = []
    for (const i of msg)
      messages.push(this.sendMsg(i.message))
    messages.data = "系统消息"
    return messages
  }

  Message(msg) {
    const data = {
      bot: Bot.stdin,
      self_id: Bot.stdin.uin,
      user_id: Bot.stdin.uin,
      post_type: "message",
      message_type: "private",
      sender: { nickname: Bot.stdin.nickname },
      message: [{ type: "text", text: msg }],
      raw_message: msg,
      friend: Bot.stdin.pickFriend(),
    }
    logger.info(`${logger.blue(`[${data.self_id}]`)} 系统消息：[${data.sender.nickname}(${data.user_id})] ${data.raw_message}`)

    Bot.emit(`${data.post_type}.${data.message_type}`, data)
    Bot.emit(`${data.post_type}`, data)
  }

  load() {
    Bot.stdin = {
      uin: "stdin",
      nickname: "标准输入",
      stat: { start_time: Date.now()/1000 },
      version: { impl: "stdin" },
      pickFriend: () => ({
        sendMsg: msg => this.sendMsg(msg),
        recallMsg: message_id => this.recallMsg(message_id),
        makeForwardMsg: msg => this.makeForwardMsg(msg),
      }),
      fl: new Map().set("stdin", {}),
    }
    Bot.stdin.pickUser = Bot.stdin.pickFriend
    Bot.stdin.pickGroup = Bot.stdin.pickFriend
    Bot.stdin.pickMember = Bot.stdin.pickFriend
    Bot.stdin.gl = Bot.stdin.fl

    if (Array.isArray(Bot.uin)) {
      if (!Bot.uin.includes("stdin"))
        Bot.uin.push("stdin")
    } else {
      Bot.uin = ["stdin"]
    }

    process.stdin.on("data", data => this.Message(data.toString().trim()))

    logger.mark(`${logger.blue(`[stdin]`)} 标准输入 已连接`)
    Bot.emit(`connect.stdin`, Bot.stdin)
    Bot.emit(`connect`, Bot.stdin)
  }
}