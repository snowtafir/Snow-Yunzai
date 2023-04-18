import { WebSocketServer } from "ws"
import { randomUUID } from "crypto"

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

function toBase64(file) {
  if (fs.existsSync(file.replace(/^file:\/\//, "")))
    return `base64://${fs.readFileSync(file.replace(/^file:\/\//, "")).toString("base64")}`
  return file
}

function makeLog(msg) {
  return toStr(msg).replace(/base64:\/\/.*?(,|]|")/g, "base64://...$1")
}

function sendApi(ws, action, params) {
  const echo = randomUUID()
  const msg = JSON.stringify({ action, params, echo })
  logger.debug(`发送 API 请求：${logger.cyan(makeLog(msg))}`)
  ws.send(msg)
  return new Promise(resolve =>
    Bot.once(echo, data =>
      resolve(Object.assign(data, data.data))
    )
  )
}

function makeMsg(msg) {
  if (Array.isArray(msg)) {
    const msgs = []
    for (const i of msg)
      if (typeof i == "string")
        msgs.push({ type: "text", data: { text: i }})
      else
        if (i.data)
          msgs.push(i)
        else
          msgs.push({ type: i.type, data: { ...i }})
    return msgs
  } else {
    return msg
  }
}

function sendFriendMsg(data, msg) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 发送好友消息：[${data.user_id}] ${makeLog(msg)}`)
  return data.sendApi("send_msg", {
    user_id: data.user_id,
    message: makeMsg(msg),
  })
}

function sendGroupMsg(data, msg) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 发送群消息：[${data.group_id}] ${makeLog(msg)}`)
  return data.sendApi("send_msg", {
    group_id: data.group_id,
    message: makeMsg(msg),
  })
}

function sendGuildMsg(data, msg) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 发送频道消息：[${data.guild_id}-${data.channel_id}] ${makeLog(msg)}`)
  return data.sendApi("send_guild_channel_msg", {
    guild_id: data.guild_id,
    channel_id: data.channel_id,
    message: makeMsg(msg),
  })
}

function getMsg(data, message_id) {
  return data.sendApi("get_msg", { message_id })
}

function recallMsg(data, message_id) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 撤回消息：${message_id}`)
  return data.sendApi("delete_msg", { message_id })
}

function getForwardMsg(data, message_id) {
  return data.sendApi("get_forward_msg", { message_id })
}

function makeForwardMsg(msg) {
  const messages = []
  for (const i of msg)
    messages.push({
      type: "node",
      data: {
        name: i.nickname || "匿名消息",
        uin: Number(i.user_id) || 80000000,
        content: makeMsg(i.message),
        time: i.time,
      },
    })
  return messages
}

async function makeFriendForwardMsg(data, msg) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 发送好友转发消息：[${data.user_id}] ${makeLog(msg)}`)
  msg = await data.sendApi("send_private_forward_msg", {
    user_id: data.user_id,
    messages: makeForwardMsg(msg),
  })
  msg.data = "好友转发消息"
  return msg
}

async function makeGroupForwardMsg(data, msg) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 发送群转发消息：[${data.group_id}] ${makeLog(msg)}`)
  msg = await data.sendApi("send_group_forward_msg", {
    group_id: data.group_id,
    messages: makeForwardMsg(msg),
  })
  msg.data = "群转发消息"
  return msg
}

async function makeGuildForwardMsg(data, msg) {
  const messages = []
  for (const i of msg)
    messages.push(await sendGuildMsg(data, i.message))
  messages.data = "频道消息"
  return messages
}

function getGroupInfo(data) {
  return data.sendApi("get_group_info", {
    group_id: data.group_id,
  })
}

async function getGroupMemberList(data) {
  return (await data.sendApi("get_group_member_list", {
    group_id: data.group_id,
  })).data
}

async function getGroupMemberMap(data) {
  const map = new Map()
  for (const i of (await getGroupMemberList(data)))
    map.set(i.user_id, i)
  return map
}

function getGroupMemberInfo(data, user_id) {
  return data.sendApi("get_group_member_info", {
    group_id: data.group_id,
    user_id,
  })
}

function getGuildInfo(data) {
  return data.sendApi("get_guild_meta_by_guest", {
    guild_id: data.guild_id,
  })
}

async function getGuildChannelList(data) {
  return (await data.sendApi("get_guild_channel_list", {
    guild_id: data.guild_id,
  })).data
}

async function getGuildChannelMap(data) {
  const map = new Map()
  for (const i of (await getGuildChannelList(data)))
    map.set(i.channel_id, i)
  return map
}

async function getGuildMemberList(data, next_token) {
  return (await data.sendApi("get_guild_member_list", {
    guild_id: data.guild_id,
    next_token,
  })).data
}

async function getGuildMemberMap(data) {
  const map = new Map()
  let next_token = ""
  while (true) {
    const list = await getGuildMemberList(data, next_token)
    for (const i of list.members)
      map.set(i.tiny_id, i)
    if (list.finished) break
    next_token = list.next_token
  }
  return map
}

function getGuildMemberInfo(data, user_id) {
  return data.sendApi("get_guild_member_profile", {
    guild_id: data.guild_id,
    user_id,
  })
}

function setGroupName(data, group_name) {
  return data.sendApi("set_group_name", {
    group_id: data.group_id,
    group_name,
  })
}

function setGroupAvatar(data, file) {
  return data.sendApi("set_group_portrait", {
    group_id: data.group_id,
    file: toBase64(file),
  })
}

function setGroupAdmin(data, user_id, enable) {
  return data.sendApi("set_group_admin", {
    group_id: data.group_id,
    user_id,
    enable,
  })
}

function setGroupCard(data, user_id, card) {
  return data.sendApi("set_group_card", {
    group_id: data.group_id,
    user_id,
    card,
  })
}

function setGroupTitle(data, user_id, special_title, duration) {
  return data.sendApi("set_group_special_title", {
    group_id: data.group_id,
    user_id,
    special_title,
    duration,
  })
}

async function connectBot(data) {
  logger.mark(`${logger.blue(`[${data.self_id}]`)} go-cqhttp 已连接`)

  Bot[data.self_id] = {
    sendApi: data.sendApi,

    getMsg: message_id => getMsg(data, message_id),
    recallMsg: message_id => recallMsg(data, message_id),
    getForwardMsg: message_id => getForwardMsg(data, message_id),

    pickFriend: user_id => {
      const i = { ...data, user_id }
      return {
        sendMsg: msg => sendFriendMsg(i, msg),
        recallMsg: message_id => recallMsg(i, message_id),
        makeForwardMsg: msg => makeFriendForwardMsg(i, msg),
        getAvatarUrl: () => `https://q1.qlogo.cn/g?b=qq&s=0&nk=${i.user_id}`,
      }
    },

    getFriendList: () => Bot[data.self_id].fl,

    pickMember: (group_id, user_id) => {
      if (typeof group_id == "string" && group_id.match("-")) {
        group_id = group_id.split("-")
        const i = { ...data, guild_id: group_id[0], channel_id: group_id[1] }
        return Bot[data.self_id].pickGuildMember(i.guild_id, i.channel_id, user_id)
      } else {
        const i = { ...data, group_id, user_id }
        return {
          ...Bot[data.self_id].pickFriend(user_id),
          poke: () => sendGroupMsg(i, segment.poke(i.user_id)),
        }
      }
    },

    pickGroup: group_id => {
      if (typeof group_id == "string" && group_id.match("-")) {
        group_id = group_id.split("-")
        const i = { ...data, guild_id: group_id[0], channel_id: group_id[1] }
        return Bot[data.self_id].pickGuild(i.guild_id, i.channel_id)
      } else {
        const i = { ...data, group_id }
        return {
          sendMsg: msg => sendGroupMsg(i, msg),
          recallMsg: message_id => recallMsg(i, message_id),
          makeForwardMsg: msg => makeGroupForwardMsg(i, msg),
          getInfo: () => getGroupInfo(i),
          getMemberList: () => getGroupMemberList(i),
          getMemberMap: () => getGroupMemberMap(i),
          pickMember: user_id => Bot[data.self_id].pickMember(i.group_id, user_id),
          getMemberInfo: user_id => getGroupMemberInfo(i, user_id),
          pokeMember: user_id => sendGroupMsg(i, segment.poke(user_id)),
          setName: group_name => setGroupName(i, group_name),
          setAvatar: file => setGroupAvatar(i, file),
          setAdmin: (user_id, enable) => setGroupAdmin(i, user_id, enable),
          setCard: (user_id, card) => setGroupCard(i, user_id, card),
          setTitle: (user_id, special_title, duration) => setGroupTitle(i, user_id, special_title, duration),
        }
      }
    },

    getGroupList: () => Bot[data.self_id].gl,
    getGroupInfo: group_id => Bot[data.self_id].pickGroup(group_id).getInfo(),
    getGroupMemberList: group_id => Bot[data.self_id].pickGroup(group_id).getMemberList(),
    getGroupMemberMap: group_id => Bot[data.self_id].pickGroup(group_id).getMemberMap(),
    getGroupMemberInfo: (group_id, user_id) => Bot[data.self_id].pickGroup(group_id).getMemberInfo(user_id),
    setGroupName: (group_id, group_name) => Bot[data.self_id].pickGroup(group_id).setName(group_name),
    setGroupAvatar: (group_id, file) => Bot[data.self_id].pickGroup(group_id).setAvatar(file),
    setGroupAdmin: (group_id, user_id, enable) => Bot[data.self_id].pickGroup(group_id).setAdmin(user_id, enable),
    setGroupCard: (group_id, user_id, card) => Bot[data.self_id].pickGroup(group_id).setCard(user_id, card),
    setGroupTitle: (group_id, user_id, special_title, duration) => Bot[data.self_id].pickGroup(group_id).setTitle(user_id, special_title, duration),

    pickGuildMember: (guild_id, channel_id, user_id) => {
      const i = { ...data, guild_id, channel_id, user_id }
      return {
        sendMsg: msg => sendGuildMsg(i, msg),
        recallMsg: message_id => recallMsg(i, message_id),
        makeForwardMsg: msg => makeGuildForwardMsg(i, msg),
        getInfo: () => getGuildMemberInfo(i, i.user_id),
        getAvatarUrl: async () => (await getGuildMemberInfo(i, i.user_id)).avatar_url,
      }
    },

    pickGuild: (guild_id, channel_id) => {
      const i = { ...data, guild_id, channel_id }
      return {
        sendMsg: msg => sendGuildMsg(i, msg),
        recallMsg: message_id => recallMsg(i, message_id),
        makeForwardMsg: msg => makeGuildForwardMsg(i, msg),
        getInfo: () => getGuildInfo(i),
        getChannelList: () => getGuildChannelList(i),
        getChannelMap: () => getGuildChannelMap(i),
        getMemberList: () => getGuildMemberList(i),
        getMemberMap: () => getGuildMemberMap(i),
        getMemberInfo: user_id => getGuildMemberInfo(i, user_id),
        pickMember: user_id => Bot[data.self_id].pickGuildMember(i.guild_id, i.channel_id, user_id),
      }
    },

    getGuildList: () => Bot[data.self_id].tl,
    getGuildInfo: guild_id => Bot[data.self_id].pickGuild(guild_id).getInfo(),
    getGuildChannelList: guild_id => Bot[data.self_id].pickGuild(guild_id).getChannelList(),
    getGuildChannelMap: guild_id => Bot[data.self_id].pickGuild(guild_id).getChannelMap(),
    getGuildMemberList: guild_id => Bot[data.self_id].pickGuild(guild_id).getMemberList(),
    getGuildMemberMap: guild_id => Bot[data.self_id].pickGuild(guild_id).getMemberMap(),
    getGuildMemberInfo: (guild_id, channel_id, user_id) => Bot[data.self_id].pickGuild(guild_id, channel_id).getMemberInfo(user_id),
  }
  Bot[data.self_id].pickUser = Bot[data.self_id].pickFriend

  Bot[data.self_id].login_info = (await data.sendApi("get_login_info")).data
  Bot[data.self_id].uin = Bot[data.self_id].login_info.user_id
  Bot[data.self_id].nickname = Bot[data.self_id].login_info.nickname

  Bot[data.self_id].guild_info = (await data.sendApi("get_guild_service_profile")).data
  Bot[data.self_id].tiny_id = Bot[data.self_id].guild_info.tiny_id
  Bot[data.self_id].guild_nickname = Bot[data.self_id].guild_info.nickname

  Bot[data.self_id].model = "TRSS-Yunzai"
  data.sendApi("_set_model_show", {
    model: Bot[data.self_id].model,
    model_show: Bot[data.self_id].model,
  })

  Bot[data.self_id].clients = (await data.sendApi("get_online_clients")).clients
  Bot[data.self_id].version = (await data.sendApi("get_version_info")).data

  Bot[data.self_id].stat = (await data.sendApi("get_status")).stat
  Bot[data.self_id].stat = {
    ...Bot[data.self_id].stat,
    lost_pkt_cnt: Bot[data.self_id].stat.packet_lost,
    recv_msg_cnt: Bot[data.self_id].stat.message_received,
    recv_pkt_cnt: Bot[data.self_id].stat.packet_received,
    sent_msg_cnt: Bot[data.self_id].stat.message_sent,
    sent_pkt_cnt: Bot[data.self_id].stat.packet_sent,
    start_time: data.time,
  }

  Bot[data.self_id].fl = new Map()
  for (const i of (await data.sendApi("get_friend_list")).data)
    Bot[data.self_id].fl.set(i.user_id, i)

  Bot[data.self_id].gl = new Map()
  for (const i of (await data.sendApi("get_group_list")).data)
    Bot[data.self_id].gl.set(i.group_id, i)

  Bot[data.self_id].tl = new Map()
  for (const i of (await data.sendApi("get_guild_list")).data)
    Bot[data.self_id].tl.set(i.guild_id, i)

  if (Array.isArray(Bot.uin)) {
    if (!Bot.uin.includes(data.self_id))
      Bot.uin.push(data.self_id)
  } else {
    Bot.uin = [data.self_id]
  }
}

function makeMessage(data) {
  const message = []
  for (const i of data.message)
    message.push({
      type: i.type,
      ...i.data,
    })
  data.message = message

  switch (data.message_type) {
    case "private":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 好友消息：[${data.sender.nickname}(${data.user_id})] ${data.raw_message}`)
      data.friend = data.bot.pickFriend(data.user_id)
      break
    case "group":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群消息：[${data.group_id}, ${data.sender.card||data.sender.nickname}(${data.user_id})] ${data.raw_message}`)
      data.friend = data.bot.pickFriend(data.user_id)
      data.group = data.bot.pickGroup(data.group_id)
      data.member = data.group.pickMember(data.user_id)
      break
    case "guild":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 频道消息：[${data.guild_id}-${data.channel_id}, ${data.sender.nickname}(${data.user_id})] ${JSON.stringify(data.message)}`)
      data.guild = data.bot.pickGuild(data.guild_id, data.channel_id)
      data.member = data.guild.pickMember(data.user_id)
      data.friend = data.member
      data.group = data.guild
      data.group_id = `${data.guild_id}-${data.channel_id}`
      break
    default:
      logger.info(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.red(JSON.stringify(data))}`)
  }

  Bot.emit(`${data.post_type}.${data.message_type}`, data)
  Bot.emit(`${data.post_type}`, data)
}

async function makeNotice(data) {
  switch (data.notice_type) {
    case "friend_recall":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 好友消息撤回：[${data.user_id}] ${data.message_id}`)
      break
    case "group_recall":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群消息撤回：[${data.group_id}, ${data.operator_id}=>${data.user_id}] ${data.message_id}`)
      break
    case "group_increase":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群成员增加：[${data.group_id}, ${data.operator_id}=>${data.user_id}] ${data.sub_type}`)
      const gli = new Map()
      for (const i of (await data.sendApi("get_group_list")).data)
        gli.set(i.group_id, i)
      Bot[data.self_id].gl = gli
      break
    case "group_decrease":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群成员减少：[${data.group_id}, ${data.operator_id}=>${data.user_id}] ${data.sub_type}`)
      const gld = new Map()
      for (const i of (await data.sendApi("get_group_list")).data)
        gld.set(i.group_id, i)
      Bot[data.self_id].gl = gld
      break
    case "group_admin":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群管理员变动：[${data.group_id}, ${data.user_id}] ${data.sub_type}`)
      data.set = data.sub_type == "set"
      break
    case "group_upload":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群文件上传：[${data.group_id}, ${data.user_id}] ${JSON.stringify(data.file)}`)
      break
    case "group_ban":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群禁言：[${data.group_id}, ${data.operator_id}=>${data.user_id}] ${data.sub_type} ${data.duration}秒`)
      break
    case "friend_add":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 好友添加：[${data.user_id}]`)
      const fl = new Map()
      for (const i of (await data.sendApi("get_friend_list")).data)
        fl.set(i.user_id, i)
      Bot[data.self_id].fl = fl
      break
    case "notify":
      if (data.group_id)
        data.notice_type = "group"
      else
        data.notice_type = "friend"
      switch (data.sub_type) {
        case "poke":
          if (data.group_id)
            logger.info(`${logger.blue(`[${data.self_id}]`)} 群戳一戳：[${data.group_id}, ${data.user_id}=>${data.target_id}]`)
          else
            logger.info(`${logger.blue(`[${data.self_id}]`)} 好友戳一戳：[${data.user_id}=>${data.target_id}]`)
          data.operator_id = data.user_id
          break
        case "honor":
          logger.info(`${logger.blue(`[${data.self_id}]`)} 群荣誉：[${data.group_id}, ${data.user_id}] ${data.honor_type}`)
          break
        case "title":
          logger.info(`${logger.blue(`[${data.self_id}]`)} 群头衔：[${data.group_id}, ${data.user_id}] ${data.title}`)
          break
        default:
          logger.info(`${logger.blue(`[${data.self_id}]`)} 未知通知：${logger.red(JSON.stringify(data))}`)
      }
      break
    case "group_card":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群名片更新：[${data.group_id}, ${data.user_id}] ${data.card_old}=>${data.card_new}`)
      break
    case "offline_file":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 离线文件：[${data.user_id}] ${JSON.stringify(data.file)}`)
      break
    case "client_status":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 客户端：[${data.client}] ${data.online ? "上线" : "下线"}`)
      data.clients = (await data.sendApi("get_online_clients")).clients
      Bot[data.self_id].clients = data.clients
      break
    case "essence":
      data.notice_type = "group_essence"
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群精华消息：[${data.group_id}, ${data.operator_id}=>${data.sender_id}] ${data.sub_type} ${data.message_id}`)
      break
    case "guild_channel_recall":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 频道消息撤回：[${data.guild_id}-${data.channel_id}, ${data.operator_id}=>${data.user_id}] ${data.message_id}`)
      break
    case "message_reactions_updated":
      data.notice_type = "guild_message_reactions_updated"
      logger.info(`${logger.blue(`[${data.self_id}]`)} 频道消息表情贴：[${data.guild_id}-${data.channel_id}, ${data.user_id}] ${data.message_id} ${JSON.stringify(data.current_reactions)}`)
      break
    case "channel_updated":
      data.notice_type = "guild_channel_updated"
      logger.info(`${logger.blue(`[${data.self_id}]`)} 子频道更新：[${data.guild_id}-${data.channel_id}, ${data.user_id}] ${data.old_info}=>${data.new_info}`)
      break
    case "channel_created":
      data.notice_type = "guild_channel_created"
      logger.info(`${logger.blue(`[${data.self_id}]`)} 子频道创建：[${data.guild_id}-${data.channel_id}, ${data.user_id}] ${data.channel_info}`)
      break
    default:
      logger.info(`${logger.blue(`[${data.self_id}]`)} 未知通知：${logger.red(JSON.stringify(data))}`)
  }

  let notice = data.notice_type.split("_")
  data.notice_type = notice.shift()
  notice = notice.join("_")
  if (notice)
    data.sub_type = notice

  if (data.user_id)
    data.friend = data.bot.pickFriend(data.user_id)
  if (data.group_id) {
    data.group = data.bot.pickGroup(data.group_id)
    data.member = data.group.pickMember(data.user_id)
  } else if (data.guild_id && data.channel_id){
    data.guild = data.bot.pickGuild(data.guild_id, data.channel_id)
    data.member = data.guild.pickMember(data.user_id)
    data.friend = data.member
    data.group = data.guild
    data.group_id = `${data.guild_id}-${data.channel_id}`
  }

  if (data.sub_type)
    Bot.emit(`${data.post_type}.${data.notice_type}.${data.sub_type}`, data)
  Bot.emit(`${data.post_type}.${data.notice_type}`, data)
  Bot.emit(`${data.post_type}`, data)
}

function makeRequest(data) {
  switch (data.request_type) {
    case "friend":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 加好友请求：[${data.user_id}] ${data.comment} ${data.flag}`)
      data.friend = data.bot.pickFriend(data.user_id)
      break
    case "group":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 加群请求：[${data.group_id}, ${data.user_id}] ${data.sub_type} ${data.comment} ${data.flag}`)
      data.friend = data.bot.pickFriend(data.user_id)
      data.group = data.bot.pickGroup(data.group_id)
      data.member = data.group.pickMember(data.user_id)
      break
    default:
      logger.info(`${logger.blue(`[${data.self_id}]`)} 未知请求：${logger.red(JSON.stringify(data))}`)
  }

  if (data.sub_type)
    Bot.emit(`${data.post_type}.${data.request_type}.${data.sub_type}`, data)
  Bot.emit(`${data.post_type}.${data.request_type}`, data)
  Bot.emit(`${data.post_type}`, data)
}

function makeMeta(data) {
  switch (data.meta_event_type) {
    case "lifecycle":
      connectBot(data)
      break
    default:
      logger.mark(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.red(JSON.stringify(data))}`)
  }
}

function Message(data, ws) {
  try {
    data = JSON.parse(data)
  } catch (err) {
    logger.error(err)
  }

  if (data.meta_event_type == "heartbeat") return

  data.sendApi = (action, params) => sendApi(ws, action, params)
  if (data.post_type) {
    data.bot = Bot[data.self_id]
    switch (data.post_type) {
      case "message":
        makeMessage(data)
        break
      case "notice":
        makeNotice(data)
        break
      case "request":
        makeRequest(data)
        break
      case "message_sent":
        data.post_type = "message"
        makeMessage(data)
        break
      case "meta_event":
        makeMeta(data)
        break
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

const wss = new WebSocketServer({ noServer: true })
wss.on("connection", ws => {
  ws.on("error", logger.error)
  ws.on("message", data => Message(data, ws))
})

export default wss