import cfg from "../config/config.js";
import PluginsLoader from "../plugins/loader.js";
import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";

function toStr(data) {
  switch (typeof data) {
    case "string":
      return data
      break;
    case "number":
      return String(data);
      break;
    case "object":
      if (Buffer.isBuffer(data))
        return Buffer.from(data, "utf8").toString();
      else
        return JSON.stringify(data);
  }
}

function encodeMsg(msg) {
  msg = toStr(msg)

  if (msg.match(/^\[CQ:/))
    return msg

  return msg
    .replace(/&/g, "&amp;")
    .replace(/\[/g, "&#91;")
    .replace(/\]/g, "&#93;")
}

function makeMsg(msg) {
  if (Array.isArray(msg)) {
    let data = ""
    for (const i of msg) {
      data += encodeMsg(i)
    }
    return data
  } else {
    return encodeMsg(msg)
  }
}

function makeLog(msg) {
  return toStr(msg).replace(/base64:\/\/.*?(,|\])/g, "base64://...$1")
}

function sendApi(ws, action, params) {
  let echo = randomUUID()
  let msg = JSON.stringify({
    action,
    params,
    echo,
  });
  logger.debug(`发送 API 请求：${logger.cyan(makeLog(msg))}`)
  ws.send(msg)
  return new Promise(resolve => {
    Bot.once(echo, data => resolve(
      Object.assign(data, data.data)
    ))
  })
}

function sendFriendMsg(data, msg) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 发送好友消息：[${data.user_id}] ${makeLog(msg)}`);
  return sendApi(
    data.ws, "send_msg", {
      user_id: data.user_id,
      message: makeMsg(msg),
    });
}

function sendGroupMsg(data, msg) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 发送群消息：[${data.group_id}] ${makeLog(msg)}`);
  return sendApi(
    data.ws, "send_group_msg", {
      group_id: data.group_id,
      message: makeMsg(msg),
    });
}

function sendGuildMsg(data, msg) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 发送频道消息：[${data.guild_id}-${data.channel_id}] ${makeLog(msg)}`);
  return sendApi(
    data.ws, "send_guild_channel_msg", {
      guild_id: data.guild_id,
      channel_id: data.channel_id,
      message: makeMsg(msg),
    });
}

function recallMsg(data, message_id) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 撤回消息：${message_id}`);
  return sendApi(
    data.ws, "delete_msg", {
      message_id,
    });
}

function makeForwardMsg(data, msg) {
  let messages = [];
  for (const i of msg) {
    messages.push({
      type: "node",
      data: {
        name: i.nickname ? i.nickname : String(data.user_id),
        uin: i.user_id ? i.user_id : data.user_id,
        content: makeMsg(i.message),
        time: i.time,
      },
    });
  }
  return messages
}

function makeFriendForwardMsg(data, msg) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 发送好友转发消息：[${data.user_id}] ${makeLog(msg)}`);
  sendApi(
    data.ws, "send_private_forward_msg", {
      user_id: data.user_id,
      messages: makeForwardMsg(data, msg),
    });
  return { type: "text", data: "好友转发消息" };
}

function makeGroupForwardMsg(data, msg) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 发送群转发消息：[${data.group_id}] ${makeLog(msg)}`);
  sendApi(
    data.ws, "send_group_forward_msg", {
      group_id: data.group_id,
      messages: makeForwardMsg(data, msg),
    });
  return { type: "text", data: "群转发消息" };
}

function makeGuildForwardMsg(data, msg) {
  for (const i of msg) {
    sendGuildMsg(data, i.message)
  }
  return { type: "text", data: "频道消息" };
}

async function connectBot(data) {
  logger.mark(`${logger.blue(`[${data.self_id}]`)} 已连接`);

  Bot[data.self_id] = {
    ws: data.ws,
    uin: data.self_id,

    stat: {
      start_time: data.time
    },

    pickFriend: user_id => {
      data.user_id = user_id
      return {
        sendMsg: msg => sendFriendMsg(data, msg)
      }
    },

    pickGroup: group_id => {
      data.group_id = group_id
      return {
        sendMsg: msg => sendGroupMsg(data, msg)
      }
    },

    pickGuild: (guild_id, channel_id) => {
      data.guild_id = guild_id
      data.channel_id = channel_id
      return {
        sendMsg: msg => sendGuildMsg(data, msg)
      }
    }
  }

  Bot[data.self_id].pickUser = Bot[data.self_id].pickFriend
  Bot[data.self_id].pickMember = Bot[data.self_id].pickFriend

  let key = `Yz:loginMsg:${data.self_id}`;
  if (!await redis.get(key)) {
    let msg = `欢迎使用【TRSS-Yunzai v${cfg.package.version}】\n【#帮助】查看指令说明\n【#状态】查看运行状态\n【#日志】查看运行日志\n【#更新】拉取 Github 更新\n【#全部更新】更新全部插件\n【#更新日志】查看更新日志\n【#重启】重新启动\n【#配置ck】配置公共查询 Cookie`;
    redis.set(key, "1", { EX: cfg.bot.online_msg_exp });
    data.user_id = cfg.masterQQ[0]
    sendFriendMsg(data, msg)
  }
}

function toOICQ(data) {
  let message = [];
  for (const i of data.message) {
    message.push({
      type: i.type,
      ...i.data,
    });
  }
  data.message = message;

  data.friend = {
    sendMsg: msg => sendFriendMsg(data, msg),
    recallMsg: message_id => recallMsg(data, message_id),
    makeForwardMsg: msg => makeFriendForwardMsg(data, msg),
  };

  if (data.message_type == "group") {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 群消息：[${data.group_id}, ${data.sender.card||data.sender.nickname}(${data.user_id})] ${data.raw_message}`);
    data.group = {
      sendMsg: msg => sendGroupMsg(data, msg),
      recallMsg: data.friend.recallMsg,
      makeForwardMsg: msg => makeGroupForwardMsg(data, msg),
    };
  } else if (data.message_type == "guild") {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 频道消息：[${data.guild_id}-${data.channel_id}, ${data.sender.nickname}(${data.user_id})] ${JSON.stringify(data.message)}`);
    data.guild = {
      sendMsg: msg => sendGuildMsg(data, msg),
      recallMsg: data.friend.recallMsg,
      makeForwardMsg: msg => makeGuildForwardMsg(data, msg),
    };

    data.friend = data.guild
    data.group = data.guild
    data.group_id = `${data.guild_id}${data.channel_id}`
  } else {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 好友消息：[${data.sender.nickname}(${data.user_id})] ${data.raw_message}`);
  }

  return data;
}

function makeNotice(data) {
  switch (data.notice_type) {
    case "friend_recall":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 好友消息撤回：[${data.user_id}] ${data.message_id}`);
      break;
    case "group_recall":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群消息撤回：[${data.group_id}, ${data.operator_id}=>${data.user_id}] ${data.message_id}`);
      break;
    case "group_increase":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群成员增加：[${data.group_id}, ${data.operator_id}=>${data.user_id}] ${data.sub_type}`);
      break;
    case "group_decrease":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群成员减少：[${data.group_id}, ${data.operator_id}=>${data.user_id}] ${data.sub_type}`);
      break;
    case "group_admin":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群管理员变动：[${data.group_id}, ${data.user_id}] ${data.sub_type}`);
      data.set = data.sub_type == "set"
      break;
    case "group_upload":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群文件上传：[${data.group_id}, ${data.user_id}] ${JSON.stringify(data.file)}`);
      break;
    case "group_ban":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群禁言：[${data.group_id}, ${data.operator_id}=>${data.user_id}] ${data.sub_type} ${data.duration}秒`);
      break;
    case "friend_add":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 好友添加：[${data.user_id}]`);
      break;
    case "notify":
      if (data.group_id)
        data.notice_type = "group"
      else
        data.notice_type = "friend"
      switch (data.sub_type) {
        case "poke":
          if (data.group_id)
            logger.info(`${logger.blue(`[${data.self_id}]`)} 群戳一戳：[${data.group_id}, ${data.user_id}=>${data.target_id}]`);
          else
            logger.info(`${logger.blue(`[${data.self_id}]`)} 好友戳一戳：[${data.user_id}=>${data.target_id}]`);
          data.operator_id = data.user_id
          break;
        case "honor":
          logger.info(`${logger.blue(`[${data.self_id}]`)} 群荣誉：[${data.group_id}, ${data.user_id}] ${data.honor_type}`);
          break;
        case "title":
          logger.info(`${logger.blue(`[${data.self_id}]`)} 群头衔：[${data.group_id}, ${data.user_id}] ${data.title}`);
          break;
        default:
          logger.info(`${logger.blue(`[${data.self_id}]`)} 未知通知：${logger.red(JSON.stringify(data))}`);
      }
      break;
    case "group_card":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群名片更新：[${data.group_id}, ${data.user_id}] ${data.card_old}=>${data.card_new}`);
      break;
    case "offline_file":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 离线文件：[${data.user_id}] ${JSON.stringify(data.file)}`);
      break;
    case "client_status":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 客户端：[${data.client}] ${data.online ? "上线" : "下线"}`);
      break;
    case "essence":
      data.notice_type = "group_essence"
      logger.info(`${logger.blue(`[${data.self_id}]`)} 群精华消息：[${data.group_id}, ${data.operator_id}=>${data.sender_id}] ${data.sub_type} ${data.message_id}`);
      break;
    case "message_reactions_updated":
      data.notice_type = "guild_message_reactions_updated"
      logger.info(`${logger.blue(`[${data.self_id}]`)} 频道消息表情贴：[${data.guild_id}-${data.channel_id}, ${data.user_id}] ${data.message_id} ${JSON.stringify(data.current_reactions)}`);
      break;
    case "channel_updated":
      data.notice_type = "guild_channel_updated"
      logger.info(`${logger.blue(`[${data.self_id}]`)} 子频道更新：[${data.guild_id}-${data.channel_id}, ${data.user_id}] ${data.old_info}=>${data.new_info}`);
      break;
    case "channel_created":
      data.notice_type = "guild_channel_created"
      logger.info(`${logger.blue(`[${data.self_id}]`)} 子频道创建：[${data.guild_id}-${data.channel_id}, ${data.user_id}] ${data.channel_info}`);
      break;
    default:
      logger.info(`${logger.blue(`[${data.self_id}]`)} 未知通知：${logger.red(JSON.stringify(data))}`);
  }

  let notice = data.notice_type.split("_")
  data.notice_type = notice.shift()
  notice = notice.join("_")
  if (notice)
    data.sub_type = notice

  if (data.user_id)
    data.friend = Bot[data.self_id].pickFriend(data.user_id)
  if (data.group_id)
    data.group = Bot[data.self_id].pickGroup(data.group_id)

  if (data.sub_type)
    Bot.emit(`${data.post_type}.${data.notice_type}.${data.sub_type}`, data)
  Bot.emit(`${data.post_type}.${data.notice_type}`, data)
  Bot.emit(`${data.post_type}`, data)
}

function makeRequest(data) {
  switch (data.request_type) {
    case "friend":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 加好友请求：[${data.user_id}] ${data.comment} ${data.flag}`);
      break;
    case "group":
      logger.info(`${logger.blue(`[${data.self_id}]`)} 加群请求：[${data.group_id}, ${data.user_id}] ${data.sub_type} ${data.comment} ${data.flag}`);
      break;
    default:
      logger.info(`${logger.blue(`[${data.self_id}]`)} 未知请求：${logger.red(JSON.stringify(data))}`);
  }

  if (data.sub_type)
    Bot.emit(`${data.post_type}.${data.request_type}.${data.sub_type}`, data)
  Bot.emit(`${data.post_type}.${data.request_type}`, data)
  Bot.emit(`${data.post_type}`, data)
}

function Message(data, ws) {
  try {
    data = JSON.parse(data);
  } catch (err) {
    logger.error(err);
  }

  if (data.meta_event_type) {
    switch (data.meta_event_type) {
      case "heartbeat":
        break;
      case "lifecycle":
        data.ws = ws
        connectBot(data);
        break;
      default:
        logger.mark(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.red(JSON.stringify(data))}`);
    }
  } else if (data.post_type) {
    switch (data.post_type) {
      case "message":
        data.ws = ws
        PluginsLoader.deal(toOICQ(data));
        break;
      case "notice":
        data.ws = ws
        makeNotice(data);
        break;
      case "request":
        data.ws = ws
        makeRequest(data);
        break;
      default:
        logger.info(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.red(JSON.stringify(data))}`);
    }
  } else if (data.echo) {
    logger.debug(`请求 API 返回：${logger.cyan(JSON.stringify(data))}`);
    Bot.emit(data.echo, data)
  } else {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.red(JSON.stringify(data))}`);
  }
}

class EventListener {
  async load() {
    logger.mark(`启动 WebSocket 服务器：${logger.green(`ws://${cfg.bot.host}:${cfg.bot.port}`)}`);
    const wss = new WebSocketServer({ host: cfg.bot.host, port: cfg.bot.port });
    wss.on("connection", function connection(ws) {
      ws.on("error", logger.error);
      ws.on("message", function message(data) {
        Message(data, ws);
      });
    });
  }
}
export default new EventListener();
