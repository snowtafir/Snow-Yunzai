import { WebSocketServer } from "ws"
import { randomUUID } from "crypto"
import PluginsLoader from "../plugins/loader.js"

function toStr(data) {
  switch (typeof data) {
    case "string":
      return data
    case "number":
      return String(data)
    case "object":
      if (Buffer.isBuffer(data))
        return Buffer.from(data, "utf8").toString()
      else
        return JSON.stringify(data)
  }
}

function makeLog(msg) {
  return toStr(msg)
    .replace(/base64:\/\/.*?(,|]|")/g, "base64://...$1")
    .replace(/"\\\\x.*?"/g, '"bytes://..."')
}

function sendApi(ws, action, params) {
  let echo = randomUUID()
  let msg = JSON.stringify({
    action,
    params,
    echo,
  })
  logger.debug(`发送 API 请求：${logger.cyan(makeLog(msg))}`)
  ws.send(msg)
  return new Promise(resolve =>
    Bot.once(echo, data =>
      resolve(Object.assign(data, data.data))
    )
  )
}

function uploadFile(data, file) {
  return data.sendApi("upload_file", {
    type: "data",
    name: randomUUID(),
    data: file.replace(/^base64:\/\//, ""),
  })
}

async function makeMsg(data, msg) {
  if (Array.isArray(msg)) {
    let data = []
    for (let i of msg)
      if (typeof i == "string") {
        data.push({ type: "text", data: { text: i }})
      } else {
        if (!i.data) {
          i = { type: i.type, data: { ...i }}
        }
        if (i.data.file)
          i.data = { file_id: (await uploadFile(data, i.data.file)).file_id }
        data.push(i)
      }
    return data
  } else {
    if (msg.data?.file)
      msg.data = { file_id: (await uploadFile(data, msg.data.file)).file_id }
    return msg
  }
}

async function sendFriendMsg(data, msg) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 发送好友消息：[${data.user_id}] ${makeLog(msg)}`)
  return data.sendApi("send_message", {
    detail_type: "private",
    user_id: data.user_id,
    message: await makeMsg(data, msg),
  })
}

async function sendGroupMsg(data, msg) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 发送群消息：[${data.group_id}] ${makeLog(msg)}`)
  return data.sendApi("send_message", {
    detail_type: "group",
    group_id: data.group_id,
    message: await makeMsg(data, msg),
  })
}

async function connectBot(data) {
  let status = await data.sendApi("get_status", {})
  for (const i of status.bots) {
    data.self_id = i.self.user_id
    logger.mark(`${logger.blue(`[${data.self_id}]`)} ComWeChat 已连接`)
    Bot[data.self_id] = {
      version: data.version,

      pickFriend: user_id => {
        let i = { ...data, user_id }
        return {
          sendMsg: msg => sendFriendMsg(i, msg),
        }
      }
    }

    Bot[data.self_id].pickUser = Bot[data.self_id].pickFriend
    Bot[data.self_id].pickMember = (group_id, user_id) => Bot[data.self_id].pickFriend(user_id)

    Bot[data.self_id].pickGroup = group_id => {
      let i = { ...data, group_id }
      return {
        sendMsg: msg => sendGroupMsg(i, msg),
        pickMember: user_id => Bot[data.self_id].pickMember(i.group_id, user_id),
      }
    }
  }
}

function makeMessage(data) {
  data.post_type = data.type
  data.message_type = data.detail_type
  data.raw_message = data.alt_message

  let message = []
  for (const i of data.message)
    message.push({
      type: i.type,
      ...i.data,
    })
  data.message = message

  switch (data.message_type) {
    case "private":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 好友消息：[${data.user_id}] ${data.raw_message}`)
      data.friend = Bot[data.self_id].pickFriend(data.user_id)
      break
    case "group":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群消息：[${data.group_id}, ${data.user_id}] ${data.raw_message}`)
      data.friend = Bot[data.self_id].pickFriend(data.user_id)
      data.group = Bot[data.self_id].pickGroup(data.group_id)
      data.member = data.group.pickMember(data.user_id)
      break
    default:
      logger.info(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.red(JSON.stringify(data))}`)
  }

  Bot.emit(`${data.post_type}.${data.message_type}`, data)
  Bot.emit(`${data.post_type}`, data)
  PluginsLoader.deal(data)
}

function Message(data, ws) {
  try {
    data = JSON.parse(data)
  } catch (err) {
    logger.error(err)
  }

  if (data.detail_type == "heartbeat") return

  data.sendApi = (action, params) => sendApi(ws, action, params)
  if (data.self?.user_id)
    data.self_id = data.self.user_id
  else
    data.self_id = data.id

  if (data.type) {
    switch (data.type) {
      case "meta":
        switch (data.detail_type) {
          case "connect":
            connectBot(data)
            break
          default:
            logger.mark(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.red(JSON.stringify(data))}`)
        }
        break
      case "message":
        makeMessage(data)
        break
/*
      case "notice":
        makeNotice(data)
        break
      case "request":
        makeRequest(data)
        break
*/
      default:
        logger.info(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.red(JSON.stringify(data))}`)
    }
  } else if (data.echo) {
    logger.debug(`请求 API 返回：${logger.cyan(JSON.stringify(data))}`)
    Bot.emit(data.echo, data)
  } else {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.red(JSON.stringify(data))}`)
  }
}

let wss = new WebSocketServer({ noServer: true })
wss.on("connection", ws => {
  ws.on("error", logger.error)
  ws.on("message", data => Message(data, ws))
})

export default wss