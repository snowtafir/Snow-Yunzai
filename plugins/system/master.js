import fs from "fs"
import { randomUUID } from "crypto"
let code = {}
let file = "./config/config/other.yaml"
export class master extends plugin {
  constructor () {
    super({
      name: "设置主人",
      dsc: "设置主人",
      event: "message",
      rule: [
        {
          reg: "^#设置主人$",
          fnc: "master"
        }
      ]
    })
  }

  async master () {
    if (this.e.isMaster) {
      await this.reply(`账号：${this.e.user_id} 已经为主人`, true)
      return false
    }

    code[this.e.user_id] = randomUUID()
    logger.mark(`${logger.cyan(`[${this.e.user_id}]`)} 设置主人验证码：${logger.green(code[this.e.user_id])}`)
    this.setContext("verify")
    await this.reply(`账号：${this.e.user_id} 请输入验证码`, true)
  }

  async verify () {
    this.finish("verify")
    if (this.e.msg.trim() == code[this.e.user_id]) {
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/masterQQ:/g, `masterQQ:\n  - ${this.e.user_id}`), "utf8")
      await this.reply(`账号：${this.e.user_id} 设置主人成功`, true)
    } else {
      await this.reply("验证码错误", true)
      return false
    }
  }
}