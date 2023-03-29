import cfg from "../config/config.js";
import PluginsLoader from "../plugins/loader.js";
import { WebSocketServer } from "ws";

function encodeMsg(msg) {
  switch (typeof msg) {
    case "string":
      break;
    case "number":
      return String(msg);
      break;
    case "object":
      if (Buffer.isBuffer(msg))
        msg = Buffer.from(msg, "utf8").toString();
      else if (Array.isArray(msg))
        msg = msg.join("");
      else
        msg = JSON.stringify(msg);
  }

  if (msg.match(/^\[CQ:/))
    return msg

  return msg
    .replace(/&/g, "&amp;")
    .replace(/\[/g, "&#91;")
    .replace(/\]/g, "&#93;")
    .replace(/,/g, "&#44;")
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
  if (Array.isArray(msg))
    msg = msg.join("")
  return msg.replace(/base64:\/\/.*(,|\])/g, "base64://...$1")
}

function sendFriendMsg(data, msg) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 发送好友消息：[${data.user_id}] ${makeLog(msg)}`);
  msg = JSON.stringify({
    action: "send_msg",
    params: {
      user_id: data.user_id,
      message: makeMsg(msg),
    },
  });
  return data.ws.send(msg);
}

function sendGroupMsg(data, msg) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 发送群消息：[${data.group_id}] ${makeLog(msg)}`);
  msg = JSON.stringify({
    action: "send_group_msg",
    params: {
      group_id: data.group_id,
      message: makeMsg(msg),
    },
  });
  return data.ws.send(msg);
}

function sendGuildMsg(data, msg) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 发送频道消息：[${data.guild_id}-${data.channel_id}] ${makeLog(msg)}`);
  msg = JSON.stringify({
    action: "send_guild_channel_msg",
    params: {
      guild_id: data.guild_id,
      channel_id: data.channel_id,
      message: makeMsg(msg),
    },
  });
  return data.ws.send(msg);
}

function recallMsg(data, message_id) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 撤回消息：${message_id}`);
  msg = JSON.stringify({
    action: "delete_msg",
    params: {
      message_id,
    },
  });
  return data.ws.send(msg);
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
  msg = JSON.stringify({
    action: "send_private_forward_msg",
    params: {
      user_id: data.user_id,
      messages: makeForwardMsg(data, msg),
    },
  });
  data.ws.send(msg);
  return { type: "text", data: "好友转发消息" };
}

function makeGroupForwardMsg(data, msg) {
  logger.info(`${logger.blue(`[${data.self_id}]`)} 发送群转发消息：[${data.group_id}] ${makeLog(msg)}`);
  msg = JSON.stringify({
    action: "send_group_forward_msg",
    params: {
      group_id: data.group_id,
      messages: makeForwardMsg(data, msg),
    },
  });
  data.ws.send(msg);
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

    pickFriend: function pickFriend(user_id) {
      data.user_id = user_id
      return {
        sendMsg: function sendMsg(msg) {
          return sendFriendMsg(data, msg)
        }
      }
    },

    pickGroup: function pickGroup(group_id) {
      data.group_id = group_id
      return {
        sendMsg: function sendMsg(msg) {
          return sendGroupMsg(data, msg)
        }
      }
    },

    pickGuild: function pickGuild(guild_id, channel_id) {
      data.guild_id = guild_id
      data.channel_id = channel_id
      return {
        sendMsg: function sendMsg(msg) {
          return sendGuildMsg(data, msg)
        }
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
    sendMsg: function sendMsg(msg) {
      return sendFriendMsg(data, msg)
    },

    recallMsg: function recallMsg(message_id) {
      return recallMsg(data, message_id)
    },

    makeForwardMsg: function makeForwardMsg(msg) {
      return makeFriendForwardMsg(data, msg)
    },
  };

  if (data.message_type == "group") {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 收到群消息：[${data.group_id}][${data.sender.card||data.sender.nickname}(${data.user_id})] ${data.raw_message}`);
    data.group = {
      sendMsg: function sendMsg(msg) {
        return sendGroupMsg(data, msg)
      },

      recallMsg: data.friend.recallMsg,

      makeForwardMsg: function makeForwardMsg(msg) {
        return makeGroupForwardMsg(data, msg)
      },
    };
  } else if (data.message_type == "guild") {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 收到频道消息：[${data.guild_id}-${data.channel_id}][${data.sender.nickname}(${data.user_id})] ${JSON.stringify(data.message)}`);
    data.guild = {
      sendMsg: function sendMsg(msg) {
        return sendGuildMsg(data, msg)
      },

      recallMsg: data.friend.recallMsg,

      makeForwardMsg: function makeForwardMsg(msg) {
        return makeGuildForwardMsg(data, msg)
      }
    };

    data.friend = data.guild
    data.group = data.guild
    data.group_id = `${data.guild_id}${data.channel_id}`
  } else {
    logger.info(`${logger.blue(`[${data.self_id}]`)} 收到消息：[${data.sender.nickname}(${data.user_id})] ${data.raw_message}`);
  }

  return data;
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
      default:
        logger.info(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.red(JSON.stringify(data))}`);
    }
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
