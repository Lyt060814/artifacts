"use strict";

const names = {mug:"杯子", magazine_rack:"杂志架", photo_frame_3:"相框", coffee_pods:"咖啡胶囊与碗", record_player:"唱片机"};
const dialog = document.querySelector("#image-dialog");
const dialogImage = document.querySelector("#dialog-image");
const sizeButton = document.querySelector("#actual-size");

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function openImage(image, caption) {
  dialogImage.src = image.src;
  dialogImage.alt = caption;
  document.querySelector("#dialog-title").textContent = caption;
  document.querySelector(".dialog-canvas").classList.remove("actual");
  sizeButton.setAttribute("aria-pressed", "false");
  dialog.showModal();
}

document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
sizeButton.addEventListener("click", () => {
  const active = document.querySelector(".dialog-canvas").classList.toggle("actual");
  sizeButton.setAttribute("aria-pressed", String(active));
});
dialog.addEventListener("click", event => {
  if (event.target === dialog) {
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  }
});

function createFrame(object, collection, view, version) {
  const label = version === "before" ? "修改前" : "修改后";
  const frame = element("figure", "frame");
  const header = element("figcaption", "frame-heading");
  header.append(element("span", "", label), element("span", "renderer", collection.renderer));
  frame.append(header);
  const image = view[version];
  if (image === null) {
    const pending = element("div", "placeholder");
    pending.append(element("strong", "", "修改后图片待确认"), element("p", "", collection.pending_message));
    frame.append(pending);
  } else {
    const caption = `${names[object.id]} · ${view.label} · ${label} · ${collection.renderer}`;
    const button = element("button", "zoom-button");
    button.type = "button";
    button.setAttribute("aria-label", `放大：${caption}`);
    const img = element("img");
    img.src = image.src;
    img.alt = caption;
    img.loading = "lazy";
    img.decoding = "async";
    button.append(img);
    button.addEventListener("click", () => openImage(image, caption));
    frame.append(button);
  }
  return frame;
}

function createGallery(section, object) {
  const host = section.querySelector(".gallery-host");
  let collectionIndex = 0;
  let viewIndex = 0;
  let mode = "both";
  const toolbar = element("div", "gallery-toolbar");
  const controls = element("div", "view-controls");
  const sourceId = `source-${object.id}`;
  const viewId = `view-${object.id}`;
  const sourceLabel = element("label", "", "渲染来源");
  sourceLabel.htmlFor = sourceId;
  const sourceSelect = element("select");
  sourceSelect.id = sourceId;
  object.collections.forEach((collection, index) => {
    const option = element("option", "", collection.renderer);
    option.value = String(index);
    sourceSelect.append(option);
  });
  const viewLabel = element("label", "", "视角");
  viewLabel.htmlFor = viewId;
  const viewSelect = element("select");
  viewSelect.id = viewId;
  controls.append(sourceLabel, sourceSelect, viewLabel, viewSelect);
  const modes = element("div", "mode-controls");
  modes.setAttribute("role", "group");
  modes.setAttribute("aria-label", `${names[object.id]}图片显示方式`);
  const buttons = [];
  [["both", "并排对比"], ["before", "只看修改前"], ["after", "只看修改后"]].forEach(([value, title]) => {
    const button = element("button", "", title);
    button.type = "button";
    button.dataset.mode = value;
    button.addEventListener("click", () => {mode = value; render();});
    buttons.push(button);
    modes.append(button);
  });
  toolbar.append(controls, modes);
  const frames = element("div", "frames");
  const note = element("p", "gallery-note");
  host.replaceChildren(toolbar, frames, note);
  function updateViews() {
    viewSelect.replaceChildren();
    object.collections[collectionIndex].views.forEach((view, index) => {
      const option = element("option", "", view.label);
      option.value = String(index);
      viewSelect.append(option);
    });
  }
  function render() {
    const collection = object.collections[collectionIndex];
    const view = collection.views[viewIndex];
    frames.replaceChildren();
    frames.classList.toggle("single", mode !== "both");
    const versions = mode === "both" ? ["before", "after"] : [mode];
    versions.forEach(version => frames.append(createFrame(object, collection, view, version)));
    buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
    note.textContent = collection.note;
  }
  sourceSelect.addEventListener("change", () => {
    collectionIndex = Number(sourceSelect.value);
    viewIndex = 0;
    updateViews(); render();
  });
  viewSelect.addEventListener("change", () => {viewIndex = Number(viewSelect.value); render();});
  updateViews(); render();
}

function renderTextures(textures) {
  const rows = document.querySelector("#texture-rows");
  rows.replaceChildren();
  textures.maps.forEach(map => {
    const row = element("tr");
    row.append(element("td", "texture-name", map.label), element("td", "", map.before_size.join(" × ")), element("td", "", "1 × 1"));
    const cell = element("td");
    const pixel = Array.isArray(map.pixel) ? map.pixel : [map.pixel, map.pixel, map.pixel];
    const swatch = element("span", "swatch");
    swatch.style.backgroundColor = `rgb(${pixel.slice(0, 3).join(",")})`;
    swatch.setAttribute("aria-hidden", "true");
    cell.append(swatch, document.createTextNode(Array.isArray(map.pixel) ? map.pixel.join(", ") : String(map.pixel)));
    row.append(cell, element("td", "texture-state", {committed:"已提交", applied:"已写入 · 待最终验证", pending_mug:"待杯子集成"}[map.status]));
    rows.append(row);
  });
  document.querySelector("#texture-status").textContent = textures.status_label;
}

async function start() {
  const response = await fetch("metadata.json", {cache:"no-store"});
  if (!response.ok) throw new Error(`metadata.json: HTTP ${response.status}`);
  const metadata = await response.json();
  const status = document.querySelector("#status");
  status.textContent = metadata.status_label;
  status.className = `badge ${metadata.status === "ready" ? "ready" : "pending"}`;
  document.querySelector("#commit").textContent = metadata.source_commit === null ? "最终版本尚未锁定" : `版本 ${metadata.source_commit.slice(0, 10)}`;
  metadata.objects.forEach(object => {
    const section = document.querySelector(`[data-gallery="${object.id}"]`);
    createGallery(section, object);
    const metric = document.querySelector(`[data-metric="${object.id}"]`);
    if (metric) metric.textContent = `${object.before_triangles.toLocaleString("zh-CN")} 面 → ${object.after_triangles === null ? "待确认" : object.after_triangles.toLocaleString("zh-CN") + " 面"}`;
    const objectStatus = document.querySelector(`[data-object-status="${object.id}"]`);
    if (objectStatus) {objectStatus.textContent = object.status_label; objectStatus.className = `badge ${object.status === "accepted" ? "checked" : "pending"}`;}
    const note = document.querySelector(`[data-object-note="${object.id}"]`);
    if (note) note.textContent = object.note;
  });
  renderTextures(metadata.constant_textures);
  const checks = element("ul");
  metadata.validation.forEach(check => checks.append(element("li", "", check)));
  document.querySelector("#validation-list").replaceChildren(checks);
}

start().catch(error => {
  const notice = document.querySelector("#load-error");
  notice.hidden = false;
  notice.textContent = `审阅数据未能加载：${error.message}。请通过静态网页服务打开页面，并确认 metadata.json 可访问。`;
});
