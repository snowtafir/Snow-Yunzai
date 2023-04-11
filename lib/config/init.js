import setLog from './log.js'
import redisInit from './redis.js'
import { checkRun } from './check.js'

// 添加一些多余的标题内容
let title = 'TRSS-Yunzai'
/*
let qq = await fs.promises.readFile('./config/config/qq.yaml', 'UTF-8').then(yaml.parse).catch(() => null)
if (qq) {
    title += `@${qq.qq || '首次启动'}`
    switch (qq.platform) {
        case 1:
            title += ' 安卓手机'
            break
        case 2:
            title += ' 安卓手表'
            break
        case 3:
            title += ' MacOS'
            break
        case 4:
            title += ' 企点'
            break
        case 5:
            title += ' iPad'
            break
        case 6:
            title += ' 安卓平板'
    }
}
*/
/** 设置标题 */
process.title = title

/** 设置时区 */
process.env.TZ = 'Asia/Shanghai'

/** 捕获未处理的Promise错误 */
process.on('unhandledRejection', (error, promise) => {
  let err = error
  if (logger) {
    logger.error(err)
  } else {
    console.log(err)
  }
})

/** 退出事件 */
process.on('exit', async (code) => {
  if (typeof redis != 'undefined' && typeof test == 'undefined') {
    await redis.save()
  }
})

await checkInit()

/** 初始化事件 */
async function checkInit () {
  /** 日志设置 */
  setLog()

  logger.mark('TRSS-Yunzai 启动中...')

  await redisInit()

  checkRun()
}
