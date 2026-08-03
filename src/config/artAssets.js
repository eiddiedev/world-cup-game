const FLAG_SLUGS = Object.freeze({
  '乌兹别克斯坦': 'uzbekistan',
  '乌兹别克': 'uzbekistan',
  '乌拉圭': 'uruguay',
  '伊拉克': 'iraq',
  '伊朗': 'iran',
  '佛得角': 'capeverde',
  '克罗地亚': 'croatia',
  '刚果': 'congo',
  '民主刚果': 'congo',
  '刚果民主共和国': 'congo',
  '加拿大': 'canada',
  '加纳': 'ghana',
  '南非': 'southafrica',
  '卡塔尔': 'qatar',
  '厄瓜多尔': 'ecuador',
  '哥伦比亚': 'colombia',
  '土耳其': 'turkey',
  '埃及': 'egypt',
  '塞内加尔': 'senegal',
  '墨西哥': 'mexico',
  '奥地利': 'austria',
  '巴拉圭': 'paraguay',
  '巴拿马': 'panama',
  '巴西': 'brazil',
  '库拉索': 'curacao',
  '德国': 'germany',
  '挪威': 'norway',
  '捷克': 'czech',
  '摩洛哥': 'morocco',
  '新西兰': 'newzealand',
  '日本': 'japan',
  '比利时': 'belgium',
  '沙特': 'saudi',
  '法国': 'france',
  '波黑': 'bosnia',
  '海地': 'haiti',
  '澳大利亚': 'australia',
  '瑞典': 'sweden',
  '瑞士': 'switzerland',
  '科特迪瓦': 'ivorycoast',
  '突尼斯': 'tunisia',
  '约旦': 'jordan',
  '美国': 'usa',
  '苏格兰': 'scotland',
  '英格兰': 'england',
  '荷兰': 'netherlands',
  '葡萄牙': 'portugal',
  '西班牙': 'spain',
  '阿尔及利亚': 'algeria',
  '阿根廷': 'argentina',
  '韩国': 'southkorea',
})

const CREST_SLUGS = Object.freeze({
  '佛得角': 'capeverde',
  '加拿大': 'canada',
  '哥伦比亚': 'colombia',
  '墨西哥': 'mexico',
  '巴西': 'brazil',
  '库拉索': 'curacao',
  '德国': 'germany',
  '挪威': 'norway',
  '摩洛哥': 'morocco',
  '日本': 'japan',
  '法国': 'france',
  '美国': 'usa',
  '英格兰': 'england',
  '葡萄牙': 'portugal',
  '西班牙': 'spain',
  '阿根廷': 'argentina',
})

export const BRANDING_ASSETS = Object.freeze({
  homeBackground: '/assets/branding/home-background.png',
  titleFrame1: '/assets/branding/title-frame-1.png',
  titleFrame2: '/assets/branding/title-frame-2.png',
  trophy: '/assets/branding/trophy.png',
  appointmentStamp: '/assets/branding/appointment-stamp.png',
  lockerRoom: '/assets/branding/locker-room.jpg',
})

export function flagAsset(teamName) {
  const slug = FLAG_SLUGS[teamName]
  return slug ? `/assets/flags/${slug}.png` : null
}

export function crestAsset(teamName) {
  const slug = CREST_SLUGS[teamName]
  return slug ? `/assets/crests/${slug}.png` : null
}
