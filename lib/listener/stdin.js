function sendMsg(msg) {
  if (!Array.isArray(msg))
    msg = [msg]
  for (let i of msg)
    switch (i.type) {
      case "text":
        logger.info(`${logger.blue(`[stdin]`)} 发送文本：${i.data.text}`)
        break
      case "image":
        logger.info(`${logger.blue(`[stdin]`)} 发送图片：${i.data.file.replace(/^base64:\/\/.*/, "base64://...")}`)
        break
      case "record":
        logger.info(`${logger.blue(`[stdin]`)} 发送音频：${i.data.file.replace(/^base64:\/\/.*/, "base64://...")}`)
        break
      case "video":
        logger.info(`${logger.blue(`[stdin]`)} 发送视频：${i.data.file.replace(/^base64:\/\/.*/, "base64://...")}`)
        break
      case "reply":
        break
      case "at":
        break
      default:
        if (typeof i == "object")
          i = JSON.stringify(i)
        logger.info(`${logger.blue(`[stdin]`)} 发送消息：${i}`)
    }
  return { message_id: 0 }
}

function recallMsg(message_id) {
  logger.info(`${logger.blue(`[stdin]`)} 撤回消息：${message_id}`)
}

function makeForwardMsg(msg) {
  const messages = []
  for (const i of msg)
    messages.push(sendMsg(i.message))
  messages.data = "系统消息"
  return messages
}

function Message(msg) {
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

Bot.stdin = {
  uin: "stdin",
  nickname: "标准输入",
  stat: { start_time: Date.now()/1000 },
  version: { impl: "stdin" },
  pickFriend: () => { return { sendMsg, recallMsg, makeForwardMsg }},
}
Bot.stdin.pickUser = Bot.stdin.pickFriend
Bot.stdin.pickGroup = Bot.stdin.pickFriend
Bot.stdin.pickMember = Bot.stdin.pickFriend

if (Array.isArray(Bot.uin)) {
  if (!Bot.uin.includes("stdin"))
    Bot.uin.push("stdin")
} else {
  Bot.uin = ["stdin"]
}

process.stdin.on("data", data => Message(data.toString().trim()))

logger.mark(`${logger.blue(`[stdin]`)} 标准输入 已连接`)
Bot.emit(`connect.stdin`, Bot.stdin)
Bot.emit(`connect`, Bot.stdin)

export {}