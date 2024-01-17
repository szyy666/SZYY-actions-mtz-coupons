import fetch from '../fetch.js'
import { dateFormat } from '../util/index.js'
import { getTemplateData, matchMoudleData } from '../template.js'
import { ECODE } from './const.js'

function resolveRedMod(text, renderList) {
  try {
    for (const instanceId of renderList) {
      const data =
        matchMoudleData(
          text,
          `gdc-fx-v2-netunion-red-envelope-${instanceId}`,
          'isStopTJCoupon'
        ) ??
        matchMoudleData(
          text,
          `gdc-fx-new-netunion-red-envelope-${instanceId}`,
          'isStopTJCoupon'
        )

      if (data) {
        data.instanceID = instanceId
        data.isStopTJCoupon = true

        return data
      }
    }
  } catch {
    // ignore
  }

  return null
}

async function getPayload({ gundamId, gdId, appJs, renderList }) {
  const jsText = await fetch(appJs).then((res) => res.text())
  const data = resolveRedMod(jsText, renderList)

  if (!data) {
    throw new Error(`[${gundamId}] Gundam Payload 生成失败`)
  }

  return {
    actualLatitude: 0,
    actualLongitude: 0,
    app: -1,
    platform: 3,
    couponAllConfigIdOrderString: data.expandCouponIds.keys.join(','),
    couponConfigIdOrderCommaString: data.priorityCouponIds.keys.join(','),
    // 这里取 number 类型的 gdId
    gundamId: gdId,
    instanceId: data.instanceID,
    h5Fingerprint: '',
    rubikCouponKey: data.cubeToken || '',
    needTj: data.isStopTJCoupon
  }
}

function getActUrl(gundamId) {
  return new URL(
    `https://market.waimai.meituan.com/gd/single.html?el_biz=waimai&el_page=gundam.loader&gundam_id=${gundamId}`
  )
}

function formatCoupons(coupons, actName) {
  function extractNumber(text) {
    const match = text.match(/满(\d+)可用/)

    return match ? parseInt(match[1], 10) : 0
  }

  return coupons.map((item) => {
    const etime =
      typeof item.etime === 'number' ? dateFormat(item.etime) : item.etime
    const amountLimit = extractNumber(item.amountLimit)

    return {
      name: item.couponName,
      etime,
      amount: item.couponAmount,
      amountLimit,
      useCondition: item.useCondition,
      actName: actName
    }
  })
}

async function grabCoupon(cookie, gundamId, guard) {
  const actUrl = getActUrl(gundamId)
  const tmplData = await getTemplateData(cookie, gundamId, guard)
  const payload = await getPayload(tmplData)
  const res = await fetch.post(
    'https://mediacps.meituan.com/gundam/gundamGrabV4',
    payload,
    {
      cookie,
      headers: {
        Origin: actUrl.origin,
        Referer: actUrl.origin + '/'
      },
      guard
    }
  )

  if (res.code == 0) {
    return formatCoupons(res.data.coupons, tmplData.actName)
  }

  const apiInfo = {
    api: 'gundamGrabV4',
    name: tmplData.actName,
    msg: res.msg || res.message
  }

  if (res.code == 3) {
    throw { code: ECODE.AUTH, ...apiInfo }
  }

  throw { code: ECODE.API, ...apiInfo }
}

export default {
  grabCoupon,
  getActUrl,
  getPayload
}
