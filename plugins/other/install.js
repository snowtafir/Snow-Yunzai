import { exec, execSync } from 'child_process'
import plugin from '../../lib/plugins/plugin.js'
import fs from 'node:fs'
import { Restart } from './restart.js'

let insing = false
const list = {
  'Atlas'             :'https://gitee.com/Nwflower/atlas',
  'TRSS-Plugin'       :'https://Yunzai.TRSS.me',
  'yenai-plugin'      :'https://gitee.com/yeyang52/yenai-plugin',
  'expand-plugin'     :'https://gitee.com/SmallK111407/expand-plugin',
  'flower-plugin'     :'https://gitee.com/Nwflower/flower-plugin',
  'earth-k-plugin'    :'https://gitee.com/SmallK111407/earth-k-plugin',
  'xiaofei-plugin'    :'https://gitee.com/xfdown/xiaofei-plugin',
  'xiaoyao-cvs-plugin':'https://gitee.com/Ctrlcvs/xiaoyao-cvs-plugin',
  'Telegram-Plugin'   :'https://gitee.com/TimeRainStarSky/Yunzai-Telegram-Plugin',
  'Discord-Plugin'    :'https://gitee.com/TimeRainStarSky/Yunzai-Discord-Plugin',
  'ICQQ-Plugin'       :'https://gitee.com/TimeRainStarSky/Yunzai-ICQQ-Plugin',
}

export class install extends plugin {
  constructor () {
    super({
      name: '安装插件',
      dsc: '#安装TRSS-Plugin #插件列表',
      event: 'message',
      rule: [
        {
          reg: `^#安装(插件|${Object.keys(list).join('|')})$`,
          fnc: 'install',
          permission: 'master'
        }
      ]
    })
  }

  async install () {
    if (insing) {
      await this.reply('已有命令安装中..请勿重复操作')
      return false
    }

    const name = this.e.msg.replace(/^#安装/, '').trim()
    if (name == '插件') {
      await this.reply(`插件列表：\n${Object.keys(list).join('\n')}\n发送 #安装[插件名] 进行安装`)
      return true
    }

    const path = `plugins/${name}`
    if (fs.existsSync(path)) {
      await this.reply(`${name} 插件已安装`)
      return false
    }
    await this.runInstall(name, list[name], path)
    this.restart()
  }

  async execSync (cmd) {
    return new Promise(resolve => {
      exec(cmd, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr })
      })
    })
  }

  async runInstall (name, url, path) {
    this.isNowUp = false

    let cm = `git clone --depth 1 --single-branch '${url}' '${path}'`

    logger.mark(`${this.e.logFnc} 开始安装：${name} 插件`)

    await this.reply(`开始安装：${name} 插件`)
    insing = true
    let ret = await this.execSync(cm)
    if (fs.existsSync(`${path}/package.json`))
      await this.execSync('pnpm install')
    insing = false

    if (ret.error) {
      logger.mark(`${this.e.logFnc} 插件安装失败：${name}`)
      this.gitErr(ret.error, ret.stdout)
      return false
    }

    return true
  }

  async gitErr (err, stdout) {
    let msg = '安装失败！'
    let errMsg = err.toString()
    stdout = stdout.toString()

    if (errMsg.includes('Timed out')) {
      let remote = errMsg.match(/'(.+?)'/g)[0].replace(/'/g, '')
      await this.reply(msg + `\n连接超时：${remote}`)
      return
    }

    if (/Failed to connect|unable to access/g.test(errMsg)) {
      let remote = errMsg.match(/'(.+?)'/g)[0].replace(/'/g, '')
      await this.reply(msg + `\n连接失败：${remote}`)
      return
    }

    await this.reply([errMsg, stdout])
  }

  restart () {
    new Restart(this.e).restart()
  }
}
