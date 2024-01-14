import fetch from './fetch.js'

function extractAppJsUrl(text) {
  const regex = /https:\/\/[^"]*\/app[^"]*\.js/
  const match = text.match(regex)

  return match ? match[0] : null
}

async function getTemplateData(cookie, gundamId) {
  const text = await fetch(
    `https://market.waimai.meituan.com/api/template/get?env=current&el_biz=waimai&el_page=gundam.loader&gundam_id=${gundamId}`,
    { cookie }
  ).then((rep) => rep.text())
  const matchGlobal = text.match(/globalData: ({.+})/)
  const appJs = extractAppJsUrl(text)

  try {
    const globalData = JSON.parse(matchGlobal[1])

    return {
      gundamId,
      gdId: globalData.gdId,
      actName: globalData.pageInfo.title,
      appJs: appJs,
      pageId: globalData.pageId,
      renderList: getRenderListFromGlobalData(globalData)
    }
  } catch (e) {
    throw new Error(`活动配置数据获取失败: gdId: ${gundamId}, ${e}`)
  }
}

function getRenderListFromGlobalData(globalData) {
  const renderInfo = globalData.renderInfo?.componentRenderInfos

  if (!renderInfo) return []

  return formatRendeInfo(renderInfo)
}

function formatRendeInfo(renderInfo) {
  return Object.entries(renderInfo)
    .filter(([_, v]) => v.render)
    .map(([k]) => k)
}

// 通过接口获取真实的渲染列表
async function getRenderList(cookie, gdNumId, guard) {
  let data

  try {
    const res = await fetch.get(
      'https://market.waimai.meituan.com/gd/zc/renderinfo',
      {
        params: {
          el_biz: 'waimai',
          el_page: 'gundam.loader',
          gdId: gdNumId,
          tenant: 'gundam'
        },
        cookie,
        guard
      }
    )

    data = res.data
  } catch (e) {
    throw new Error('renderinfo 接口调用失败:' + e.message)
  }

  return formatRendeInfo(data)
}

function matchMoudleData(text, start, end) {
  const reg = new RegExp(`${start}.+?(?=${end})`)

  const res = text.match(reg)

  if (!res) return null

  const data = eval(`({moduleId:"${res[0]}})`)

  return data
}

export { getTemplateData, getRenderList, matchMoudleData }
