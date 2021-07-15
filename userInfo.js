const md5 = require('md5')
const pino = require('pino');
const NodeCache = require("node-cache")
const http = require('./utils/http')
const util = require('./utils/index')

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const roleIdCache = new NodeCache({ stdTTL: 60 * 60 * 24 * 365 });
const cardCache = new NodeCache({ stdTTL: 60 * 60 * 24 });

const __API = {
  FETCH_ROLE_ID: 'https://api-takumi.mihoyo.com/game_record/card/wapi/getGameRecordCard',
  FETCH_ROLE_INDEX: 'https://api-takumi.mihoyo.com/game_record/genshin/api/index'
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) miHoYoBBS/2.4.0',
  'Referer': 'https://webstatic.mihoyo.com/',
  'Cookie': process.env.COOKIE,
  'x-rpc-app_version': '2.3.0',
  'x-rpc-client_type': 5,
  'DS': ''
}

const getDS = () => {
  // v2.3.0-web
  n = 'h8w582wxwgqvahcdkpvdhbh2w9casgfl'
  i = Date.now() / 1000 | 0
  r = util.randomStr(6)
  c = md5(`salt=${n}&t=${i}&r=${r}`)

  return `${i},${r},${c}`
}

const getRoleInfo = (uid) => {
  const key = `__uid__${uid}`

  return new Promise((resolve, reject) => {
    let cachedData = roleIdCache.get(key)
    if (cachedData) {
      const { game_role_id, nickname, region, region_name } = cachedData
      logger.info('从缓存中获取角色信息, uid %s, game_role_id %s, nickname %s, region %s, region_name %s', uid, game_role_id, nickname, region, region_name)
      resolve(cachedData)
    } else {
      http({
        method: "GET",
        url: __API.FETCH_ROLE_ID,
        qs: { uid },
        headers: {
          ...HEADERS,
          'DS': getDS()
        }
      })
        .then(resp => {
          resp = JSON.parse(resp)
          if (resp.retcode === 0) {
            if (resp.data.list && resp.data.list.length > 0) {
              const roleInfo = resp.data.list.find(_ => _.game_id === 2)

              if(!roleInfo) {
                logger.warn('无角色数据, uid %s', uid)
                reject('无角色数据，请检查输入的米哈游通行证ID是否有误（非游戏内的UID）和是否设置了公开角色信息，若操作无误则可能是被米哈游屏蔽，请第二天再试')
              }

              const { game_role_id, nickname, region, region_name } = roleInfo

              logger.info('首次获取角色信息, uid %s, game_role_id %s, nickname %s, region %s, region_name %s', uid, game_role_id, nickname, region, region_name)

              roleIdCache.set(key, roleInfo)

              resolve(roleInfo)
            } else {
              logger.warn('无角色数据, uid %s', uid)
              reject('无角色数据，请检查输入的米哈游通行证ID是否有误（非游戏内的UID）和是否设置了公开角色信息，若操作无误则可能是被米哈游屏蔽，请第二天再试')
            }
          } else {
            logger.error('获取角色ID接口报错 %s', resp.message)
            reject(resp.message)
          }
        })
        .catch(err => {
          logger.error('获取角色ID接口请求报错 %o', err)
        })
    }
  })
}

const userInfo = ({uid, detail=false}) => {
  const key = `__uid__${uid}_${detail ? 'detail' : 'lite'}`

  return new Promise((resolve, reject) => {
    let cachedBody = cardCache.get(key)
    if (cachedBody) {
      if(cachedBody.retcode === 10101){
        reject(cachedBody.message)
      } else {
        resolve(cachedBody)
      }
      return
    } else {

      getRoleInfo(uid)
        .then(roleInfo => {
          const { game_role_id, region } = roleInfo

          if(detail){
            http({
              method: "GET",
              url: __API.FETCH_ROLE_INDEX,
              qs: {
                server: region,
                role_id: game_role_id
              },
              headers: {
                ...HEADERS,
                'DS': getDS()
              }
            })
              .then(resp => {
                resp = JSON.parse(resp)
                if (resp.retcode === 0) {
                  const { world_explorations } = resp.data
                  const percentage = Math.min((world_explorations.reduce((total, next) => total + next.exploration_percentage, 0) / world_explorations.length / 10000 * 1000).toFixed(1), 100) + '%'
                  const world_exploration = percentage

                  const data = {
                    uid: game_role_id,
                    world_exploration,
                    ...resp.data.stats,
                    ...roleInfo
                  }

                  cardCache.set(key, data)
                  resolve(data)

                } else {
                  cardCache.set(key, resp)
                  logger.error('获取角色详情接口报错 %s', resp.message)
                  reject(resp.message)
                }
              })
              .catch(err => {
                logger.warn(err)
                reject(err)
              })
          } else {
            const [ active_day_number, avatar_number, achievement_number, spiral_abyss ] = roleInfo.data

            const parsed = {
              active_day_number: active_day_number.value,
              avatar_number: avatar_number.value,
              achievement_number: achievement_number.value,
              spiral_abyss: spiral_abyss.value
            }
            
            const data = {
              uid: game_role_id,
              ...parsed,
              ...roleInfo
            }

            cardCache.set(key, data)
            resolve(data)
          }
        })
        .catch(err => {
          logger.warn(err)
          reject(err)
        })

    }
  })
}

module.exports = userInfo