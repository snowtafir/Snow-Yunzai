import cfg from "../config/config.js";
import PluginsLoader from "../plugins/loader.js";
import { WebSocketServer } from "ws";

function toOICQ(data, ws) {
  let message = [];
  for (const i of data.message) {
    message.push({
      type: i.type,
      ...i.data,
    });
  }
  data.message = message;

  if (data.message_type == "group") {
    data.group = {
      sendMsg: function sendMsg(msg) {
        if (Array.isArray(msg)) msg = msg.join("")
        msg = JSON.stringify({
          action: "send_group_msg",
          params: {
            group_id: data.group_id,
            message: msg,
          },
        });
        logger.debug(`${logger.blue(`[${data.self_id}]`)} 发送群消息：${logger.cyan(msg)}`);
        return ws.send(msg);
      },
    };
  } else if (data.message_type == "guild") {
    data.group_id = `${data.guild_id}${data.channel_id}`;
    data.group = {
      sendMsg: function sendMsg(msg) {
        if (Array.isArray(msg)) msg = msg.join("")
        msg = JSON.stringify({
          action: "send_guild_channel_msg",
          params: {
            guild_id: data.guild_id,
            channel_id: data.channel_id,
            message: msg,
          },
        });
        logger.debug(`${logger.blue(`[${data.self_id}]`)} 发送频道消息：${logger.cyan(msg)}`);
        return ws.send(msg);
      },
    };
  }

  data.friend = {
    sendMsg: function sendMsg(msg) {
      if (Array.isArray(msg)) msg = msg.join("")
      msg = JSON.stringify({
        action: "send_msg",
        params: {
          user_id: data.user_id,
          message: msg,
        },
      });
      logger.debug(`${logger.blue(`[${data.self_id}]`)} 发送好友消息：${logger.cyan(msg)}`);
      return ws.send(msg);
    },
  };
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
