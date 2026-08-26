/**
 * 全量剩余场景高质重构（v2 修复中文泄漏）
 * - 仅处理未在 fixedScenes 中的剩余低质
 * - 保持 solo / thigh / 服饰多样性
 */
const fs=require('fs'), path=require('path')
const ROOT=path.resolve(__dirname,'../..')
const fixedScenes=new Set(['sc001','sc002','sc003','sc004','sc005','sc006','sc007','sc010','sc014','sc015','sc018','sc019','sc020','sc032','sc036','sc040','sc056','sc060','sc066','sc068','sc009','sc017','sc049','sc086','sc232','sc240','sc260','sc164','sc022','sc069','sc112','sc013','sc016','sc035','sc048','sc051','sc054','sc064','sc072','sc076','sc078','sc008','sc012','sc021','sc023','sc027','sc028','sc029','sc031','sc039','sc041','sc042','sc043','sc044','sc045','sc046','sc047','sc052','sc053','sc055','sc057','sc011','sc025','sc026','sc033','sc034','sc037','sc038','sc058','sc059','sc061','sc062','sc063','sc065','sc067','sc070','sc071','sc073','sc074','sc075','sc077','sc079','sc081','sc083','sc084','sc085','sc087','sc088','sc089','sc091','sc092','sc093','sc094','sc095','sc096','sc098','sc099','sc102','sc103','sc104','sc105'])
let scenes=JSON.parse(fs.readFileSync(path.join(ROOT,'data/scenes.json'),'utf8'))
function thighFor(scene, idx){
  const tags=(scene.tags||[]).join(',').toLowerCase()
  const story=scene.story||''
  const hasUniform=tags.includes('school_uniform')||story.includes('校服')||story.includes('制服')
  const hasKimono=tags.includes('kimono')||tags.includes('yukata')||story.includes('和服')||story.includes('浴衣')
  const hasSwim=tags.includes('swimsuit')||tags.includes('bikini')||story.includes('泳装')||story.includes('海边')
  const hasPajama=tags.includes('pajamas')||tags.includes('sleepwear')||story.includes('睡衣')
  const isBlack=idx%2===0
  if(hasUniform) return isBlack?{thigh:'sheer_black_thighhigh_stockings_with_matte_silky_weave', shoe:'polished_brown_loafers', extra:'thigh_gap'}:{thigh:'sheer_white_thighhigh_stockings_with_lace_trim', shoe:'white_mary_jane_shoes', extra:'thigh_gap'}
  if(hasKimono) return {thigh:'slender_bare_legs_with_smooth_thigh_lines', shoe:'white_tabi_socks', extra:'ankle_line'}
  if(hasSwim) return {thigh:'sun_kissed_bare_legs_with_smooth_thigh_contours', shoe:'barefoot_with_detailed_toes', extra:'wet_sheen'}
  if(hasPajama) return {thigh:'slender_bare_legs_with_smooth_thigh_lines', shoe:'barefoot_with_soft_toes', extra:'soft_skin'}
  if(tags.includes('maid')) return {thigh:'sheer_black_thighhigh_stockings_with_garter', shoe:'mary_jane_shoes', extra:'thigh_gap'}
  if(tags.includes('qipao')) return {thigh:'sheer_black_thighhigh_stockings_with_lace_top', shoe:'black_heels', extra:'thigh_gap'}
  return isBlack?{thigh:'sheer_black_tights_with_glossy_sheen', shoe:'ankle_boots', extra:'calf_contours'}:{thigh:'sheer_white_thighhigh_stockings_with_fleecy_texture', shoe:'cream_ankle_boots', extra:'thigh_gap'}
}
let fixed=0
scenes.forEach((s, idx)=>{
  if(fixedScenes.has(s.id)) return
  // only fix low quality: token<28 or len<750 or missing thigh detail
  const tok=s.prompt.split(',').length
  const ln=s.prompt.length
  const hasDetail=/thighhigh|stocking|tights|barefoot|entire_legs|sheer|volumetric|cinematic/i.test(s.prompt)
  if(tok>=28 && ln>=750 && hasDetail) return
  const isNene=s.char==='nene'
  const base=isNene?'ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons':'shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip'
  const lora=isNene?'ayachi_nene_v18_wd14':'shiki_natsume_v18_wd14'
  const w=isNene?'0.8':'0.85'
  const thigh=thighFor(s, idx)
  const loc=(s.location||'indoor').replace(/[^a-zA-Z0-9 ]/g,'').replace(/\s+/g,'_').toLowerCase()||'indoor'
  const cam=(s.camera||'medium_shot').replace(/[^a-zA-Z0-9 ]/g,'').replace(/\s+/g,'_').toLowerCase()||'medium_shot'
  const light=(s.lighting||'soft_light').replace(/[^a-zA-Z0-9 ]/g,'').replace(/\s+/g,'_').toLowerCase()||'soft_light'
  const prompt=`1girl, solo, ${base}, wearing_${(s.tags.find(t=>/uniform|sailor|kimono|yukata|swimsuit|pajamas|maid|qipao|cafe|dress|coat|cardigan|hoodie/.test(t))||'casual_outfit')}_with_detailed_fabric, ${thigh.thigh}_hugging_smooth_thighs_with_${thigh.extra}, entire_legs_and_feet_fully_visible_in_frame, ${thigh.shoe}_on_${loc}_floor, ${cam}_at_${loc}_during_${s.timeOfDay||'day'}, gentle_shy_blush_with_soft_smile, ${light}_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:${lora}:${w}>`.replace(/[^ -~]/g,'').replace(/__+/g,'_')
  const newTags=[...new Set([...(s.tags||[]).slice(0,3), 'smooth_thighs', thigh.thigh.includes('thighhigh')||thigh.thigh.includes('tights')?'sheer_thighhigh':'bare_legs', 'full_body','depth_of_field','volumetric_lighting'])]
  const anima=`At ${s.location} during ${s.timeOfDay||s.time}, ${isNene?'Ayachi Nene':'Shiki Natsume'} in ${(s.tags.find(t=>/uniform|sailor|kimono/.test(t))||'casual outfit').replace(/_/g,' ')} shows ${thigh.thigh.replace(/_/g,' ')} hugging smooth thighs, ${thigh.shoe.replace(/_/g,' ')} fully visible, with cinematic depth.`
  s.prompt=prompt; s.tags=newTags; s.animaCaption=anima; s.negative="worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  s.auditRevision='audit-v25-2026-08-26-full-v2'
  fixed++
})
console.log(`scenes to fix ${fixed}`)
fs.writeFileSync(path.join(ROOT,'data/scenes.json'), JSON.stringify(scenes,null,2)+'\n')

// write to shards
const shards=['nene-core.json','nene-after-story.json','natsume-core.json','natsume-after-story.json','shared.json']
shards.forEach(shard=>{
  const p=path.join(ROOT,'data/scenes',shard)
  let arr=JSON.parse(fs.readFileSync(p,'utf8'))
  let cnt=0
  arr.forEach(item=>{
    const updated=scenes.find(s=>s.id===item.id)
    if(updated && updated.auditRevision==='audit-v25-2026-08-26-full-v2'){
      item.prompt=updated.prompt; item.tags=updated.tags; item.animaCaption=updated.animaCaption; item.negative=updated.negative; item.auditRevision=updated.auditRevision; cnt++
    }
  })
  if(cnt){ fs.writeFileSync(p, JSON.stringify(arr,null,2)+'\n'); console.log(`patched ${shard} ${cnt}`)}
})
const {loadSceneShards, writeAggregate}=require(path.join(ROOT,'scripts/runtime/scene-store'))
const {scenes: allScenes, sources}=loadSceneShards()
writeAggregate(allScenes)
console.log(`rebuilt ${allScenes.length}`)
let idx=JSON.parse(fs.readFileSync(path.join(ROOT,'data/scenes-index.json'),'utf8'))
let writeShard=(n,l)=>{fs.writeFileSync(path.join(ROOT,'data',n), JSON.stringify(l,null,2)+'\n'); console.log(`regen ${n} ${l.length}`)}
writeShard('scenes-nene.json', allScenes.filter(s=>s.char==='nene'))
writeShard('scenes-natsume.json', allScenes.filter(s=>s.char==='natsume'))
writeShard('scenes-shared.json', allScenes.filter(s=>s.char==='triad'||s.char==='shared'))
const coreIds=(idx.tiers&&idx.tiers.core)||[]
writeShard('scenes-core.json', coreIds.map(id=>allScenes.find(s=>s.id===id)).filter(Boolean))
require(path.join(ROOT,'scripts/maintenance/precompress'))
console.log(`DONE v2 fixed ${fixed}`)

