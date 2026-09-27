// Favicon: a red A-shield with a random Dutch A-road number, drawn fresh on every load.
const A_ROADS = [1, 2, 4, 5, 6, 7, 8, 9, 10, 12, 13, 15, 16, 17, 18, 20, 22, 24, 27, 28, 29, 30, 31, 32, 35, 37, 38, 44, 50, 58, 59, 65, 67, 73, 74, 76, 77, 79]

function draw(ref: string): string {
  const s = 64
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  const round = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }
  // Shield: wide red plate with a white rim (so it reads on dark and light tab bars) and the white inner line.
  round(0, 12, 64, 40, 8)
  ctx.fillStyle = '#fff'
  ctx.fill()
  round(2, 14, 60, 36, 6)
  ctx.fillStyle = '#c90002'
  ctx.fill()
  round(5, 18, 54, 28, 4)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.font = `800 ${ref.length > 2 ? 22 : 26}px Overpass, "Barlow Condensed", "Arial Narrow", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(ref, 32, 33)
  return c.toDataURL('image/png')
}

export function setRandomFavicon() {
  const ref = 'A' + A_ROADS[Math.floor(Math.random() * A_ROADS.length)]
  const apply = () => {
    const url = draw(ref)
    if (!url) return
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/png"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      link.type = 'image/png'
      document.head.appendChild(link)
    }
    link.sizes.value = '64x64'
    link.href = url
  }
  apply()
  // Redraw once the signage font is in, so the number uses the real letterforms.
  document.fonts?.ready.then(apply).catch(() => {})
}
