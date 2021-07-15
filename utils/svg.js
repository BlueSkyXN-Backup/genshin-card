const fs = require('fs')
const path = require('path')
const mimeType = require('mime-types')
const Fontmin = require('fontmin')
const b2a = require('b3b').b2a
const NodeCache = require("node-cache")
const md5 = require('md5')
const pino = require('pino');
const util = require('./index')

const skinPath = path.resolve(__dirname, '../assets/skin')
const woff2Cache = new NodeCache({ stdTTL: 60 * 60 * 24 * 365 });
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const skinList = {}

const baseGlyph = `
ABCDEFGHIJKLMNOPQRSTUVWXYZ
abcdefghijklmnopqrstuvwxyz
1234567890 
"!\`?'.,;:()[]{}<>|/@\\^$-%+=#_&~*
活跃天数角色数量成就达成深镜螺旋世界探索
`

fs.readdirSync(skinPath).forEach(img => {
  const imgPath = path.resolve(skinPath, img)
  const name = path.parse(img).name

  skinList[name] = convertToDatauri(imgPath)
})

function convertToDatauri(path) {
  const mime = mimeType.lookup(path)
  const base64 = fs.readFileSync(path).toString('base64')

  return `data:${mime};base64,${base64}`
}

const txt2woff2 = (text) => {
  const key = '__woff2__' + md5(text)

  return new Promise((resolve, reject) => {
    let cachedData = woff2Cache.get(key)
    if (cachedData) {
      logger.info('从缓存中获取子集化字体 %s', key)
      resolve(cachedData)
    } else {
      const fontmin = new Fontmin()
        .src('assets/fonts/HYWenHei-55W.ttf')
        .use(Fontmin.glyph({ 
            text: baseGlyph + text,
            hinting: false
        }))
        .use(Fontmin.ttf2woff({
            deflate: true
        }))

      fontmin.run(function (err, files) {
        if (err) {
            reject(err)
        }

        const woff2 = b2a(files[1].contents)
        // console.log(baseGlyph + text)

        woff2Cache.set(key, woff2)
        resolve(woff2)
      });
    }
  })
}

const svg = async ({ data, skin=0, detail=false }) => {
  if(skin >= Object.keys(skinList).length) skin = 0

  const woff2 = await txt2woff2(data.nickname)

  return new Promise((resolve, reject) => {
      const tpl = `<?xml version="1.0" encoding="UTF-8"?>
      <svg width="500" height="165" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <title>Genshin Impact User Card</title>
        <foreignObject width="1000" height="330" transform="scale(.5)">
          <body xmlns="http://www.w3.org/1999/xhtml">
            <style>
              * {
                margin: 0;;
                padding: 0;
                box-sizing: border-box;
                user-select: none;
              }
              body {
                width: 100%;
                height: 100%;
                font-family: HYWenHei;
                font-size: 26px;
                color: #fff;
              }
              .user-container {
                position: absolute;
                width: 100%;
                height: 100%;
                background-image: url(${skinList[skin]});
                background-size: 100%;
              }

              .top {
                position: absolute;
                display: flex;
                width: 100%;
                height: 125px;
                padding-bottom: 20px;
                background-image: inherit;
                background-size: 100%;
                text-shadow: 0px 0px 10px rgba(19, 19, 19, 50%);
              }
              
              .top::before,
              .top::after {
                content: '';
                position: absolute;
                width: 100%;
                height: 100%;
              }

              .top::before {
                background: inherit;
                filter: blur(3px);
                height: 100px;
                opacity: 0.8;
                z-index: 0;
              }

              .top::after {
                background-image: linear-gradient(to bottom, rgba(0,59,86,.35), transparent);
                z-index: 0;
              }
              
              .user-info {
                position: relative;
                display: inline-block;
                width: 50%;
                padding: 4px 20px;
                z-index: 1;
              }

              .user-info .name-wrap {
                display: flex;
              }

              .name-wrap .name {
                font-size: 46px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }

              .name-wrap .level {
                margin-top: 12px;
                margin-left: 8px;
                font-size: 20px;
                font-weight: bold;
              }

              .user-info .uid {
                font-size: 26px;
                margin-top: 2px;
                line-height: 1;
              }

              .chest-list {
                position: relative;
                display: flex;
                justify-content: flex-end;
                align-items: center;
                margin-left: auto;
                margin-right: 18px;
                height: 60px;
                z-index: 1;
              }

              .chest {
                position: relative;
                margin-left: 10px;
                padding-left: 28px;
                font-size: 26px;
              }

              .chest::before {
                content: '';
                position: absolute;
                left: 0;
                top: 4px;
                width: 26px;
                height: 26px;
                background-size: 100%;
                background-repeat: no-repeat;
              }

              .chest-1::before {
                background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 1024 1024' width='26' height='26' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M495.104 22.704l-368.88 205.072a34.72 34.72 0 000 60.64L495.04 494.688a34.72 34.72 0 0033.888 0l368.848-206.24a34.72 34.72 0 000-60.64L528.848 22.704a34.768 34.768 0 00-33.744 0z' fill='%23e2ba8a'/%3E%3Cpath d='M611.44 1004.4l344.4-204.8a34.736 34.736 0 0016.96-29.888V422.768a34.72 34.72 0 00-51.488-30.4l-345.824 190.8a34.704 34.704 0 00-17.952 30.528l1.44 361.008a34.72 34.72 0 0052.464 29.696zM51.2 423.808v345.888a34.72 34.72 0 0016.976 29.856L414.4 1005.328a34.72 34.72 0 0052.448-29.952l-1.168-358.112a34.688 34.688 0 00-17.68-30.16L102.896 393.6A34.72 34.72 0 0051.2 423.808z' fill='%23cd9a47'/%3E%3C/svg%3E");
              }

              .chest-2::before {
                background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 1024 1024' width='26' height='26' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M495.104 22.704l-368.88 205.072a34.72 34.72 0 000 60.64L495.04 494.688a34.72 34.72 0 0033.888 0l368.848-206.24a34.72 34.72 0 000-60.64L528.848 22.704a34.768 34.768 0 00-33.744 0z' fill='%23ddd'/%3E%3Cpath d='M611.44 1004.4l344.4-204.8a34.736 34.736 0 0016.96-29.888V422.768a34.72 34.72 0 00-51.488-30.4l-345.824 190.8a34.704 34.704 0 00-17.952 30.528l1.44 361.008a34.72 34.72 0 0052.464 29.696zM51.2 423.808v345.888a34.72 34.72 0 0016.976 29.856L414.4 1005.328a34.72 34.72 0 0052.448-29.952l-1.168-358.112a34.688 34.688 0 00-17.68-30.16L102.896 393.6A34.72 34.72 0 0051.2 423.808z' fill='%23b6b5b5'/%3E%3C/svg%3E");
              }

              .chest-3::before {
                background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 1024 1024' width='26' height='26' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M495.104 22.704l-368.88 205.072a34.72 34.72 0 000 60.64L495.04 494.688a34.72 34.72 0 0033.888 0l368.848-206.24a34.72 34.72 0 000-60.64L528.848 22.704a34.768 34.768 0 00-33.744 0z' fill='%23d0a791'/%3E%3Cpath d='M611.44 1004.4l344.4-204.8a34.736 34.736 0 0016.96-29.888V422.768a34.72 34.72 0 00-51.488-30.4l-345.824 190.8a34.704 34.704 0 00-17.952 30.528l1.44 361.008a34.72 34.72 0 0052.464 29.696zM51.2 423.808v345.888a34.72 34.72 0 0016.976 29.856L414.4 1005.328a34.72 34.72 0 0052.448-29.952l-1.168-358.112a34.688 34.688 0 00-17.68-30.16L102.896 393.6A34.72 34.72 0 0051.2 423.808z' fill='%23bf693b'/%3E%3C/svg%3E");
              }

              .chest-4::before {
                background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 1024 1024' width='26' height='26' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M495.104 22.704l-368.88 205.072a34.72 34.72 0 000 60.64L495.04 494.688a34.72 34.72 0 0033.888 0l368.848-206.24a34.72 34.72 0 000-60.64L528.848 22.704a34.768 34.768 0 00-33.744 0z' fill='%23808080'/%3E%3Cpath d='M611.44 1004.4l344.4-204.8a34.736 34.736 0 0016.96-29.888V422.768a34.72 34.72 0 00-51.488-30.4l-345.824 190.8a34.704 34.704 0 00-17.952 30.528l1.44 361.008a34.72 34.72 0 0052.464 29.696zM51.2 423.808v345.888a34.72 34.72 0 0016.976 29.856L414.4 1005.328a34.72 34.72 0 0052.448-29.952l-1.168-358.112a34.688 34.688 0 00-17.68-30.16L102.896 393.6A34.72 34.72 0 0051.2 423.808z' fill='%23555'/%3E%3C/svg%3E");
              }

              .bottom {
                position: absolute;
                bottom: 0;
                width: 100%;
                height: 120px;
                display: flex;
                padding-top: 22px;
                justify-content: space-around;
                align-items: center;
                background: inherit;
                background-position: bottom;
                text-shadow: 0px 0px 10px rgba(19, 19, 19, 50%);
              }
              
              .bottom::before,
              .bottom::after {
                content: '';
                position: absolute;
                bottom: 0;
                width: 100%;
                height: 100%;
              }

              .bottom::before {
                background: inherit;
                height: 100px;
                opacity: 0.8;
                filter: blur(3px);
                z-index: 0;
              }

              .bottom::after {
                background-image: linear-gradient(to top, rgba(14,114,160,.35), transparent);
                z-index: 0;
              }

              .bottom .section {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: space-around;
                min-width: 130px;
                margin-right: 12px;
                line-height: 1;
                z-index: 1;
              }

              .bottom .section:last-of-type {
                margin-right: auto;
              }

              .bottom .section .val {
                font-size: 48px;
                letter-spacing: -2px;
              }

              .bottom .section .desc {
                font-size: 20px;
                margin-top: 4px;
              }

              .user-container.less .bottom .section.world-exploration,
              .user-container.less .chest-list {
                display: none;
              }
              .user-container.less .bottom .section.spiral-abyss {
                margin-right: auto;
              }

              @font-face {
                font-family: HYWenHei;
                src: url('data:font/woff2;base64,${woff2}') format('woff2');
              }
            </style>
              <div class="user-container ${detail ? '' : 'less'}">
                <div class="top">
                  <div class="user-info">
                    <div class="name-wrap">
                      <div class="name">{{nickname}}</div>
                      <div class="level">Lv.{{level}}</div>
                    </div>
                    <div class="uid">UID: {{uid}}</div>
                  </div>
                  <div class="chest-list">
                    <div class="chest chest-1">{{luxurious_chest_number}}</div>
                    <div class="chest chest-2">{{precious_chest_number}}</div>
                    <div class="chest chest-3">{{exquisite_chest_number}}</div>
                    <div class="chest chest-4">{{common_chest_number}}</div>
                  </div>
                </div>
                <div class="bottom">
                  <div class="section active-days">
                    <div class="val">{{active_day_number}}</div>
                    <div class="desc">活跃天数</div>
                  </div>
                  <div class="section avatar-number">
                    <div class="val">{{avatar_number}}</div>
                    <div class="desc">角色数量</div>
                  </div>
                  <div class="section achievement-number">
                    <div class="val">{{achievement_number}}</div>
                    <div class="desc">成就达成</div>
                  </div>
                  <div class="section spiral-abyss">
                    <div class="val">{{spiral_abyss}}</div>
                    <div class="desc">深镜螺旋</div>
                  </div>
                  <div class="section world-exploration">
                    <div class="val">{{world_exploration}}</div>
                    <div class="desc">世界探索</div>
                  </div>
                </div>
              </div>
          </body>
        </foreignObject>
      </svg>
      `

    resolve(util.render(tpl, data))
  })
}

module.exports = svg