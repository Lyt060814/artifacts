'use strict';
const embeddedMetadata = JSON.parse(document.getElementById('review-metadata').textContent);
const formatter = new Intl.NumberFormat('zh-CN');
const modes = { overlay: '叠加视图', collider: '碰撞体' };
const validationNames = { gpu_cook: 'GPU cook', settle: 'Settle', source_split: '转换一致性' };
const validationValues = { pending: '待验证', passed: '通过', failed: '未通过', waived: '已豁免' };
const dialog = document.getElementById('image-dialog');
const dialogImage = document.getElementById('dialog-image');
const dialogTitle = document.getElementById('dialog-title');
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function render(metadata) {
  const ready = metadata.status === 'ready';
  const status = document.getElementById('page-status');
  status.textContent = ready ? '已更新 · 可对比' : '修改后待验证';
  status.classList.toggle('ready', ready);
  document.getElementById('pending-notice').hidden = ready;
  document.getElementById('baseline-commit').textContent = metadata.baseline_commit.slice(0, 10);
  document.getElementById('after-commit').textContent = metadata.after_commit ? `修改后 ${metadata.after_commit.slice(0, 10)}` : '修改后 尚未确认';
  document.getElementById('updated-at').textContent = metadata.updated_at ? `更新于 ${metadata.updated_at}` : '等待最终结果';
  metadata.sections.forEach((section, index) => {
    const hasAfter = ready && section.status === 'ready' && section.after !== null;
    const article = document.getElementById(section.id);
    article.replaceChildren();
    article.setAttribute('aria-labelledby', `${section.id}-title`);
    const heading = element('div', 'section-heading');
    const headingText = element('div', '');
    headingText.append(element('div', 'section-number', `0${index + 1} / 容器`));
    const title = element('h2', '', section.title);
    title.id = `${section.id}-title`;
    headingText.append(title);
    const controls = element('div', 'view-control');
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', `${section.title}图片模式`);
    let mode = 'overlay';
    const images = [];
    for (const [key, label] of Object.entries(modes)) {
      const button = element('button', '', label);
      button.type = 'button';
      button.dataset.mode = key;
      button.setAttribute('aria-pressed', String(key === mode));
      button.addEventListener('click', () => {
        mode = key;
        for (const sibling of controls.children) sibling.setAttribute('aria-pressed', String(sibling.dataset.mode === mode));
        for (const image of images) {
          image.src = `img/${image.dataset.version}/${section.stem}-${mode}.png`;
          image.alt = `${section.title} · ${image.dataset.version === 'before' ? '修改前' : '修改后'} · ${modes[mode]}`;
        }
      });
      controls.append(button);
    }
    heading.append(headingText, controls);
    article.append(heading, element('p', 'section-intro', section.description));
    const pair = element('div', 'pair');
    for (const version of ['before', 'after']) {
      const available = version === 'before' || hasAfter;
      const stats = version === 'before' ? section.before : (hasAfter ? section.after : null);
      const frame = element('div', 'frame');
      const frameHeader = element('div', 'frame-header');
      frameHeader.append(element('strong', '', version === 'before' ? '修改前' : '修改后'), element('span', '', available ? '点击图片放大' : '尚待验证'));
      frame.append(frameHeader);
      if (available) {
        const imageButton = element('button', 'image-button');
        imageButton.type = 'button';
        imageButton.setAttribute('aria-label', `放大${section.title}${version === 'before' ? '修改前' : '修改后'}视图`);
        const image = element('img', '');
        image.dataset.version = version;
        image.src = `img/${version}/${section.stem}-${mode}.png`;
        image.alt = `${section.title} · ${version === 'before' ? '修改前' : '修改后'} · ${modes[mode]}`;
        image.width = 1000; image.height = 1000; image.loading = 'lazy';
        image.addEventListener('error', () => {
          imageButton.hidden = true;
          const error = element('div', 'pending-image');
          error.append(element('strong', '', '图片尚未就绪'), element('p', '', '该视图的图片文件无法读取，请等待内容更新。'));
          frame.insertBefore(error, frame.querySelector('.metrics'));
        });
        imageButton.addEventListener('click', () => {
          dialogImage.src = image.src;
          dialogImage.alt = image.alt;
          dialogTitle.textContent = image.alt;
          dialog.showModal();
        });
        imageButton.append(image); frame.append(imageButton); images.push(image);
      } else {
        const pending = element('div', 'pending-image');
        pending.append(element('span', 'pending-icon', '…'), element('strong', '', '修改后待验证'), element('p', '', '完成检查后，在这里展示同一视角的代理与统计。'));
        frame.append(pending);
      }
      const metrics = element('div', 'metrics');
      for (const [key, label] of [['shapes', '碰撞块'], ['hull_vertices_total', '凸包顶点总数'], ['hull_vertices_max', '单块最多顶点']]) {
        const metric = element('div', 'metric');
        metric.append(element('span', `metric-value${available ? '' : ' awaiting'}`, available ? formatter.format(stats[key]) : '—'), element('span', 'metric-label', label));
        metrics.append(metric);
      }
      frame.append(metrics); pair.append(frame);
    }
    article.append(pair);
    const bottom = element('div', 'comparison-bottom');
    const delta = element('div', `delta${hasAfter ? ' ready' : ''}`);
    if (hasAfter) {
      const count = section.before.shapes - section.after.shapes;
      const fraction = count / section.before.shapes * 100;
      delta.textContent = count >= 0 ? `减少 ${formatter.format(count)} 块（${fraction.toFixed(1)}%） · 数量变化，不代表实测加速` : `增加 ${formatter.format(-count)} 块 · 数量变化，不代表实测性能`;
    } else delta.textContent = '修改后的数量变化尚未确认';
    const validation = element('div', 'validation-list');
    for (const [key, label] of Object.entries(validationNames)) {
      const value = hasAfter ? section.validation[key] : 'pending';
      validation.append(element('span', `validation ${value}`, `${label} · ${validationValues[value]}`));
    }
    bottom.append(delta, validation); article.append(bottom);
    if (hasAfter && section.review_note) article.append(element('p', 'review-note', section.review_note));
  });
  const audit = metadata.visual_audit;
  const costRows = document.getElementById('cost-rows');
  costRows.replaceChildren();
  for (const row of [
    ['mug', `${formatter.format(audit.mug_triangles)} 个基础三角面 / 单个杯子`, '首先试减面，保留杯口、把手、UV 与平滑轮廓'],
    ['magazine_rack', `${formatter.format(audit.magazine_rack_triangles)} 个基础三角面`, '评估架子和皮革片的几何密度'],
    ['恒定大贴图', `${audit.constant_large_maps} 张 ≥2K 图，全图像素相同`, '可换同值 1×1 图；保留颜色空间与通道语义'],
    ['相框法线贴图', `${audit.photo_frame_normal_resolution} / ${audit.photo_frame_normal_disk_mib} MiB 文件`, '评估 2K / 1K；近景检查木纹细节']
  ]) {
    const tr = document.createElement('tr');
    for (const text of row) tr.append(element('td', '', text));
    costRows.append(tr);
  }
  document.getElementById('texture-estimate').textContent = `全场景约 ${formatter.format(audit.scene_triangle_estimate)} 个基础三角面，未计入最终渲染细分。若把所统计纹理全部按 RGBA8 计算，基础层约 ${audit.texture_rgba8_base_gib_theoretical} GiB，加完整 mip 链约 ${audit.texture_rgba8_mips_gib_theoretical} GiB；这是理论估算，不是实测显存或加载开销。`;
}
render(embeddedMetadata);
// HTTP hosting reads the replaceable JSON; file:// still works with the embedded snapshot.
if (location.protocol === 'http:' || location.protocol === 'https:') {
  fetch('metadata.json', { cache: 'no-store' }).then(response => {
    if (!response.ok) throw new Error(`metadata HTTP ${response.status}`);
    return response.json();
  }).then(render).catch(() => {
    const notice = document.getElementById('pending-notice');
    notice.hidden = false;
    notice.querySelector('p').textContent = '最新数据未能读取，当前展示页面内嵌的统计快照。';
  });
}
