import cfg from "../config/config.js";
import PluginsLoader from "../plugins/loader.js";
import { WebSocketServer } from "ws";

function encodeMsg(msg) {
  if (msg.match(/^\[CQ:/)) {
    return msg
  } else {
    return msg
      .replace(/&/g, "&amp;")
      .replace(/\[/g, "&#91;")
      .replace(/\]/g, "&#93;")
      .replace(/,/g, "&#44;")
  }
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

function toOICQ(data, ws) {
  data.ws = ws

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
      msg = JSON.stringify({
        action: "send_msg",
        params: {
          user_id: data.user_id,
          message: makeMsg(msg),
        },
      });
      logger.debug(`${logger.blue(`[${data.self_id}]`)} 发送好友消息：${logger.cyan(msg)}`);
      return ws.send(msg);
    },

    recallMsg: function recallMsg(message_id) {
      msg = JSON.stringify({
        action: "delete_msg",
        params: {
          message_id,
        },
      });
      logger.debug(`${logger.blue(`[${data.self_id}]`)} 撤回消息：${logger.cyan(msg)}`);
      return ws.send(msg);
    },

    makeForwardMsg: function makeForwardMsg(msg) {
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

      msg = JSON.stringify({
        action: "send_private_forward_msg",
        params: {
          user_id: data.user_id,
          messages,
        },
      });
      logger.debug(`${logger.blue(`[${data.self_id}]`)} 发送好友转发消息：${logger.cyan(msg)}`);
      return ws.send(msg);
    },
  };

  if (data.message_type == "group") {
    data.group = {
      sendMsg: function sendMsg(msg) {
        msg = JSON.stringify({
          action: "send_group_msg",
          params: {
            group_id: data.group_id,
            message: makeMsg(msg),
          },
        });
        logger.debug(`${logger.blue(`[${data.self_id}]`)} 发送群消息：${logger.cyan(msg)}`);
        return ws.send(msg);
      },

      recallMsg: data.friend.recallMsg,

      makeForwardMsg: function makeForwardMsg(msg) {
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

        msg = JSON.stringify({
          action: "send_group_forward_msg",
          params: {
            group_id: data.group_id,
            messages,
          },
        });
        logger.debug(`${logger.blue(`[${data.self_id}]`)} 发送群转发消息：${logger.cyan(msg)}`);
        return ws.send(msg);
      },
    };
  } else if (data.message_type == "guild") {
    data.group_id = `${data.guild_id}${data.channel_id}`;
    data.group = {
      sendMsg: function sendMsg(msg) {
        msg = JSON.stringify({
          action: "send_guild_channel_msg",
          params: {
            guild_id: data.guild_id,
            channel_id: data.channel_id,
            message: makeMsg(msg),
          },
        });
        logger.debug(`${logger.blue(`[${data.self_id}]`)} 发送频道消息：${logger.cyan(msg)}`);
        return ws.send(msg);
      },

      recallMsg: data.friend.recallMsg,

      makeForwardMsg: function makeForwardMsg(msg) {
        for (const i of msg) {
          message = JSON.stringify({
            action: "send_guild_channel_msg",
            params: {
              guild_id: data.guild_id,
              channel_id: data.channel_id,
              message: makeMsg(i.message),
            },
          });
          logger.debug(`${logger.blue(`[${data.self_id}]`)} 发送频道消息：${logger.cyan(message)}`);
          ws.send(message)
        }
        return true;
      }
    };
    data.friend = data.group
  }

  return data;
}

async function Message(data, ws) {
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
        logger.mark(`${logger.blue(`[${data.self_id}]`)} 已连接`);
        let key = `Yz:loginMsg:${data.self_id}`;
        if (!await redis.get(key)) {
          let msg = `欢迎使用【TRSS-Yunzai v${cfg.package.version}】\n【#帮助】查看指令说明\n【#状态】查看运行状态\n【#日志】查看运行日志\n【#更新】拉取 Github 更新\n【#全部更新】更新全部插件\n【#更新日志】查看更新日志\n【#重启】重新启动\n【#配置ck】配置公共查询 Cookie`;
          redis.set(key, "1", { EX: cfg.bot.online_msg_exp });
          ws.send(
            JSON.stringify({
              action: "send_msg",
              params: {
                user_id: cfg.masterQQ[0],
                message: msg,
              },
            })
          );
        }
        break;
      default:
        logger.mark(`${logger.blue(`[${data.self_id}]`)} 未知消息：${logger.red(JSON.stringify(data))}`);
    }
  } else if (data.post_type) {
    switch (data.post_type) {
      case "message":
        logger.info(`${logger.blue(`[${data.self_id}]`)} 收到消息：${logger.cyan(JSON.stringify(data))}`);
        PluginsLoader.deal(toOICQ(data, ws));
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
