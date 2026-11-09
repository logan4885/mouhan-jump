// 线下 / 线上销售入口配置（改这里就行，不用动别处）
//  price        价格文字，显示在“找 Founder 拿现货”按钮上
//  buyUrl       点按钮后打开的链接（默认是 WhatsApp 咨询；{price} 会被替换）
//  offerEndsAt  现货优惠的【真实】截止时间，例如 '2026-12-31T23:59:00+02:00'。
//               留空 = 不显示倒计时（没有真实截止时间时不要编造倒计时）
export const SHOP = {
  price: "160 EGP", // 目前按钮上不显示价格，留作备用
  buyUrl: 'https://wa.me/8619550262721?text=' + encodeURIComponent('Hi, I want the physical can toy with the VIP code'),
  offerEndsAt: '',
};
