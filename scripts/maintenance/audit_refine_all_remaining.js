/**
 * 全量剩余场景 + 热门角色蓝图 高质重构
 * - 保持 solo / 1girl
 * - 人体细化 + 黑白丝/大腿充分表达
 * - 服饰多样性最大化（校服/水手服/女仆/旗袍/浴衣/睡衣/泳装/私服等交替）
 * - 故事地点动作对齐（避免中文）
 */
const fs=require('fs'), path=require('path')
const ROOT=path.resolve(__dirname,'../..')
const fixedScenes=new Set(['sc001','sc002','sc003','sc004','sc005','sc006','sc007','sc010','sc014','sc015','sc018','sc019','sc020','sc032','sc036','sc040','sc056','sc060','sc066','sc068','sc009','sc017','sc049','sc086','sc232','sc240','sc260','sc164','sc022','sc069','sc112','sc013','sc016','sc035','sc048','sc051','sc054','sc064','sc072','sc076','sc078','sc008','sc012','sc021','sc023','sc027','sc028','sc029','sc031','sc039','sc041','sc042','sc043','sc044','sc045','sc046','sc047','sc052','sc053','sc055','sc057','sc011','sc025','sc026','sc033','sc034','sc037','sc038','sc058','sc059','sc061','sc062','sc063','sc065','sc067','sc070','sc071','sc073','sc074','sc075','sc077','sc079','sc081','sc083','sc084','sc085','sc087','sc088','sc089','sc091','sc092','sc093','sc094','sc095','sc096','sc098','sc099','sc102','sc103','sc104','sc105'])
const scenesPath=path.join(ROOT,'data/scenes.json')
let scenes=JSON.parse(fs.readFileSync(scenesPath,'utf8'))

// helper to pick thigh detail based on scene
function thighDetailFor(scene, idx){
  const tags=(scene.tags||[]).join(',').toLowerCase()
  const story=scene.story||''
  const hasUniform=tags.includes('school_uniform')||tags.includes('pleated_skirt')||story.includes('校服')||story.includes('制服')
  const hasKimono=tags.includes('kimono')||tags.includes('yukata')||story.includes('和服')||story.includes('浴衣')||story.includes('神社')
  const hasSwim=tags.includes('swimsuit')||tags.includes('bikini')||story.includes('泳装')||story.includes('海边')||story.includes('沙滩')
  const hasPajama=tags.includes('pajamas')||tags.includes('sleepwear')||story.includes('睡衣')||story.includes('被窝')
  const isBlack = idx%2===0
  if(hasUniform){
    return isBlack
      ?{thigh:'sheer_black_thighhigh_stockings_with_matte_silky_weave_hugging_smooth_thighs', shoe:'polished_brown_loafers', extra:'thigh_gap_and_faint_garter_line'}
      :{thigh:'sheer_white_thighhigh_stockings_with_lace_trim_and_silky_sheen', shoe:'white_mary_jane_shoes', extra:'thigh_gap_and_glossy_reflection'}
  }
  if(hasKimono){
    return {thigh:'slender_bare_legs_with_smooth_thigh_and_calf_lines', shoe:'white_tabi_socks_with_split_toe', extra:'delicate_ankle_line'}
  }
  if(hasSwim){
    return {thigh:'sun_kissed_bare_legs_with_smooth_thigh_contours_and_wet_sheen', shoe:'barefoot_with_detailed_toes', extra:'water_droplets_on_skin'}
  }
  if(hasPajama){
    return {thigh:'slender_bare_legs_with_smooth_thigh_lines', shoe:'barefoot_with_soft_toes', extra:'soft_skin_sheen'}
  }
  if(tags.includes('maid')){
    return {thigh:'sheer_black_thighhigh_stockings_with_garter_straps', shoe:'mary_jane_shoes', extra:'thigh_gap'}
  }
  if(tags.includes('qipao')||tags.includes('cheongsam')){
    return {thigh:'sheer_black_thighhigh_stockings_with_lace_top', shoe:'black_heels', extra:'thigh_gap'}
  }
  if(tags.includes('cafe')||tags.includes('suspender')){
    return {thigh:'sheer_black_tights_with_opaque_thigh_sheen', shoe:'brown_loafers', extra:'calf_contours'}
  }
  // casual fallback with variety
  return isBlack
    ?{thigh:'sheer_black_thighhigh_stockings_with_soft_matte_weave', shoe:'ankle_boots', extra:'knee_contours'}
    :{thigh:'sheer_white_thighhigh_stockings_with_fleecy_texture', shoe:'cream_ankle_boots', extra:'thigh_gap'}
}

function locationActionFor(scene){
  const loc=scene.location||'indoor'
  const cam=scene.camera||'medium_shot'
  const time=scene.timeOfDay||scene.time||'day'
  // sanitize loc/cam to english tokens
  const locToken=loc.replace(/[^a-zA-Z0-9]/g,'_').replace(/_+/g,'_').toLowerCase()||'indoor'
  const camToken=cam.replace(/[^a-zA-Z0-9]/g,'_').replace(/_+/g,'_').toLowerCase()||'medium_shot'
  return `${camToken}_at_${locToken}_during_${time}`
}

let sceneFixed=0
scenes.forEach((s, idx)=>{
  if(fixedScenes.has(s.id)) return
  const char=s.char
  const isNene=char==='nene'
  const baseChar=isNene
    ?'ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons'
    :'shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip'
  const lora=isNene?'ayachi_nene_v18_wd14':'shiki_natsume_v18_wd14'
  const weight=isNene?'0.8':'0.85'
  const thigh=thighDetailFor(s, idx)
  const locAct=locationActionFor(s)
  // outfit detail: keep original tags first outfit token if exists else generic
  const originalOutfit=(s.tags||[]).find(t=>/uniform|sailor|kimono|yukata|swimsuit|pajamas|maid|qipao|cafe|dress|coat|cardigan|hoodie/.test(t))|| (isNene?'casual_outfit':'casual_outfit')
  const outfitDetail=`wearing_${originalOutfit}_with_detailed_fabric_and_${thigh.thigh.split('_')[1]||'soft'}_texture`
  // build prompt
  const lighting=(s.lighting||'soft_light').replace(/[^a-zA-Z0-9 ]/g,'').replace(/\s+/g,'_').toLowerCase()
  const prompt=`1girl, solo, ${baseChar}, ${outfitDetail}, ${thigh.thigh}_hugging_smooth_thighs_with_${thigh.extra}, entire_legs_and_feet_fully_visible_in_frame, ${thigh.shoe}_on_${(s.location||'floor').replace(/[^a-zA-Z0-9]/g,'_')}_floor, ${locAct}, gentle_shy_blush_with_soft_smile, ${lighting}_with_volumetric_light_and_bokeh, cinematic_depth_of_field, delicate_collarbone_and_slender_waist, full_body, <lora:${lora}:${weight}>`
    .replace(/[^ -~]/g,'').replace(/__+/g,'_').replace(/,\s*,/g,',')
  // tags: merge original + new thigh
  const newTags=[...new Set([...(s.tags||[]).slice(0,4), 'smooth_thighs', thigh.thigh.includes('thighhigh')?'sheer_thighhigh_stockings':'bare_legs', 'full_body','depth_of_field','volumetric_lighting'])]
  const animaCaption=`At ${s.location} during ${s.timeOfDay||s.time}, ${isNene?'Ayachi Nene':'Shiki Natsume'} in ${originalOutfit.replace(/_/g,' ')} shows ${thigh.thigh.replace(/_/g,' ')} hugging smooth thighs, ${thigh.shoe.replace(/_/g,' ')} fully visible, with cinematic depth and volumetric light.`
  const negative="worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, cropped, 3d render, photorealistic, 2girls, cropped_feet, upper_body"
  s.prompt=prompt
  s.tags=newTags
  s.animaCaption=animaCaption
  s.negative=negative
  s.auditRevision='audit-v25-2026-08-26-full'
  sceneFixed++
})
console.log(`scenes fixed ${sceneFixed}`)

// blueprints
const bpPath=path.join(ROOT,'data/scene-blueprints.json')
let bpData=JSON.parse(fs.readFileSync(bpPath,'utf8'))
let bps=bpData.blueprints
let bpFixed=0
bps.forEach((b, idx)=>{
  // skip already high quality? enhance all where promptProse length <800 or missing thigh
  const hasThigh=/thigh|stocking|tights|bare_legs/i.test(b.promptProse||'') || /thigh|stocking/i.test((b.promptTokens||[]).join(' '))
  const needs= (b.promptProse||'').length<700 || !hasThigh
  if(!needs) return
  const isAdult=!!b.adult
  // choose thigh detail based on sceneTags
  const tags=(b.sceneTags||[]).join(',').toLowerCase()
  const hasUniform=tags.includes('school')||tags.includes('uniform')||tags.includes('pleated')
  const hasKimono=tags.includes('kimono')||tags.includes('yukata')
  const hasSwim=tags.includes('swimsuit')||tags.includes('bikini')||tags.includes('beach')
  let thighProse, thighTokens
  if(hasUniform){
    thighProse= idx%2===0 ? "sheer black thighhigh stockings hugging smooth thighs with a soft thigh gap and garter line" : "sheer white thighhigh stockings with delicate lace trim and silky thigh sheen";
    thighTokens= idx%2===0 ? ["sheer_black_thighhigh_stockings","thigh_gap","smooth_thighs"] : ["sheer_white_thighhigh_stockings","thigh_gap","smooth_thighs"];
  } else if(hasKimono){
    thighProse="slender bare legs with smooth thigh lines peeking from the kimono hem, white tabi socks with split toes";
    thighTokens=["bare_legs","smooth_thighs","white_tabi_socks"];
  } else if(hasSwim){
    thighProse="sun-kissed bare legs with smooth thigh contours and a subtle wet sheen, bare feet with detailed toes";
    thighTokens=["bare_legs","smooth_thighs","barefoot","detailed_feet"];
  } else {
    thighProse= idx%2===0 ? "sheer black tights with glossy thigh sheen and calf contours" : "sheer white thighhigh stockings with fleecy texture";
    thighTokens= idx%2===0 ? ["sheer_black_tights","smooth_thighs"] : ["sheer_white_thighhigh_stockings","smooth_thighs"];
  }
  // enhance promptProse: append thigh sentence if not present, ensure solo phrase
  let prose=b.promptProse||''
  if(!/with the whole place to herself/i.test(prose)){
    prose=prose.replace(/\.?\s*$/,' with the whole place to herself. ')
  }
  // add thigh sentence before final
  if(!hasThigh){
    prose=prose.trim().replace(/\.$/,'') + `. ${thighProse.charAt(0).toUpperCase()+thighProse.slice(1)}, entire legs and feet fully visible with cinematic depth and volumetric light.`
  }
  // ensure detailed lighting
  if(!/volumetric|cinematic|depth/i.test(prose)){
    prose=prose.replace(/\.$/,'. Cinematic volumetric light and depth of field enhance every edge.')
  }
  b.promptProse=prose
  // ensure tokens include thigh
  const existing=new Set((b.promptTokens||[]).map(t=>t.toLowerCase()))
  thighTokens.forEach(t=>{ if(!existing.has(t.toLowerCase())) b.promptTokens.push(t) })
  // ensure solo-ish: add full_body and detailed tags
  ;["full_body","entire_legs_and_feet_fully_visible","depth_of_field","volumetric_lighting","detailed_background","cinematic_lighting"].forEach(t=>{ if(!existing.has(t)) b.promptTokens.push(t) })
  // ensure negative has thigh protection where needed? keep as is
  // add outfit diversity hint: ensure krea/anima hints remain
  bpFixed++
})
console.log(`blueprints fixed ${bpFixed}`)

fs.writeFileSync(bpPath, JSON.stringify(bpData,null,2)+'\n','utf8')

// write scenes back via shards
// first write to shards
const shards=['nene-core.json','nene-after-story.json','natsume-core.json','natsume-after-story.json','shared.json']
// we need to distribute scenes back to shards based on original file? Simpler: reload shards and patch again? Instead just write aggregate and let build handle? We'll directly write aggregate and shards via load
// Actually we modified scenes array (aggregate), need to split to shards according to char and story?
// Use existing shards as template: load them and replace
shards.forEach(shard=>{
  const p=path.join(ROOT,'data/scenes',shard)
  let arr=JSON.parse(fs.readFileSync(p,'utf8'))
  let cnt=0
  arr.forEach(item=>{
    const updated=scenes.find(s=>s.id===item.id)
    if(updated){
      // if we fixed this id, update shard
      if(!fixedScenes.has(item.id) && updated.auditRevision==='audit-v25-2026-08-26-full'){
        item.prompt=updated.prompt
        item.tags=updated.tags
        item.animaCaption=updated.animaCaption
        item.negative=updated.negative
        item.auditRevision=updated.auditRevision
        cnt++
      }
    }
  })
  if(cnt){ fs.writeFileSync(p, JSON.stringify(arr,null,2)+'\n','utf8'); console.log(`patched shard ${shard} ${cnt}`) }
})
// also need to patch nene-core etc for fixedScenes that were already fixed? They are already correct from previous batches, no need
// now rebuild aggregate
const {loadSceneShards, writeAggregate}=require(path.join(ROOT,'scripts/runtime/scene-store'))
const {scenes: allScenes, sources}=loadSceneShards()
writeAggregate(allScenes)
console.log(`rebuilt aggregate ${allScenes.length} ${sources.map(s=>s.entry.file+'='+s.scenes.length).join(', ')}`)
let writeShard=(name,list)=>{fs.writeFileSync(path.join(ROOT,'data',name),JSON.stringify(list,null,2)+'\n','utf8'); console.log(`regen ${name} ${list.length}`)}
const idx=JSON.parse(fs.readFileSync(path.join(ROOT,'data/scenes-index.json'),'utf8'))
writeShard('scenes-nene.json', allScenes.filter(s=>s.char==='nene'))
writeShard('scenes-natsume.json', allScenes.filter(s=>s.char==='natsume'))
writeShard('scenes-shared.json', allScenes.filter(s=>s.char==='triad'||s.char==='shared'))
const coreIds=(idx.tiers&&idx.tiers.core)||[]
writeShard('scenes-core.json', coreIds.map(id=>allScenes.find(s=>s.id===id)).filter(Boolean))
require(path.join(ROOT,'scripts/maintenance/precompress'))
console.log(`DONE scenes ${sceneFixed} blueprints ${bpFixed}`)
