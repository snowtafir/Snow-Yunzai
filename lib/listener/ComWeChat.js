import { WebSocketServer } from "ws"
import { randomUUID } from "crypto"
import PluginsLoader from "../plugins/loader.js"

function Message(data, ws) {
  try {
    data = JSON.parse(data)
  } catch (err) {
    logger.error(err)
  }

  if (data.detail_type == "heartbeat") return

  logger.info(`${logger.blue(`[${data.id}]`)} 未知消息：${logger.red(JSON.stringify(data))}`)
}

let wss = new WebSocketServer({ noServer: true })
wss.on("connection", ws => {
  ws.on("error", logger.error)
  ws.on("message", data => Message(data, ws))
})

export default wss